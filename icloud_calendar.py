"""
Connecteur CalDAV iCloud — accède au calendrier iPhone via l'Apple ID + un
mot de passe d'application (généré sur appleid.apple.com → Sécurité).

L'iPhone synchronise nativement avec iCloud, donc lire/écrire ici revient à
lire/écrire sur l'iPhone. Pas de polling, pas de tiers : Apple → directement.

Import paresseux des libs CalDAV : si elles ne sont pas installées, l'app boote
quand même et la connexion remonte une erreur propre côté UI.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytz


ICLOUD_URL = "https://caldav.icloud.com/"
_UTC = pytz.UTC


def _ensure_aware(dt: datetime) -> datetime:
    """Renvoie un datetime aware en UTC (pytz), compatible avec vobject."""
    if dt.tzinfo is None:
        return _UTC.localize(dt)
    return dt.astimezone(_UTC)


def _read_reminder(vevent) -> int | None:
    """Renvoie le rappel en minutes avant l'événement, ou None si absent."""
    alarms = vevent.contents.get("valarm", [])
    if not alarms:
        return None
    try:
        trigger = alarms[0].trigger.value
    except Exception:
        return None
    if isinstance(trigger, timedelta):
        # Négatif = avant l'événement → on renvoie une valeur positive en minutes
        total_minutes = int(round(-trigger.total_seconds() / 60))
        return total_minutes if total_minutes >= 0 else None
    return None


def _set_reminder(vevent, minutes_before: int | None) -> None:
    """Remplace les VALARM existants par un seul rappel (ou aucun)."""
    # Supprime les VALARM existants
    if "valarm" in vevent.contents:
        del vevent.contents["valarm"]
    if minutes_before is None:
        return
    valarm = vevent.add("valarm")
    valarm.add("action").value = "DISPLAY"
    valarm.add("trigger").value = timedelta(minutes=-int(minutes_before))
    valarm.add("description").value = "Rappel"


def _parse_iso(value: str) -> datetime:
    """Accepte 'YYYY-MM-DDTHH:MM' et 'YYYY-MM-DDTHH:MM:SSZ'."""
    s = value.replace("Z", "+00:00")
    return _ensure_aware(datetime.fromisoformat(s))


class CalendarError(Exception):
    """Erreur transportée jusqu'à l'UI."""


def _connect(apple_id: str, app_password: str):
    """Ouvre une session CalDAV iCloud et retourne le calendrier principal."""
    try:
        import caldav  # noqa: WPS433
    except ImportError as exc:
        raise CalendarError(
            "Bibliothèque caldav manquante. Lance : pip install caldav vobject"
        ) from exc

    if not apple_id or not app_password:
        raise CalendarError("Identifiants iCloud manquants.")

    try:
        client = caldav.DAVClient(
            url=ICLOUD_URL,
            username=apple_id,
            password=app_password,
        )
        principal = client.principal()
        calendars = principal.calendars()
    except Exception as exc:  # caldav lève des sous-classes variées
        raise CalendarError(
            f"Connexion iCloud refusée : {exc}. "
            "Vérifie l'Apple ID et le mot de passe d'application."
        ) from exc

    if not calendars:
        raise CalendarError("Aucun calendrier trouvé sur ce compte iCloud.")

    return client, calendars


def _pick_calendar(calendars, target_name: str | None):
    if target_name:
        for cal in calendars:
            if str(cal.name) == target_name:
                return cal
    return calendars[0]


def test_connection(apple_id: str, app_password: str) -> dict:
    """Vérifie les credentials et liste les calendriers disponibles."""
    _, calendars = _connect(apple_id, app_password)
    return {
        "ok": True,
        "calendars": [str(c.name) for c in calendars],
    }


def list_events(
    apple_id: str,
    app_password: str,
    start_iso: str,
    end_iso: str,
    calendar_name: str | None = None,
) -> list[dict]:
    """Renvoie les événements entre start et end, agrégés sur tous les
    calendriers iCloud du compte (le `calendar_name` n'est utilisé que pour
    la création/édition côté write). Chaque événement est tagué avec son
    calendrier d'origine dans le champ `calendar`."""
    _, calendars = _connect(apple_id, app_password)

    start = _parse_iso(start_iso)
    end = _parse_iso(end_iso)

    events: list[dict] = []
    for cal in calendars:
        cal_name = str(cal.name)
        try:
            results = cal.search(
                start=start,
                end=end,
                event=True,
                expand=True,
            )
        except Exception:
            # Un calendrier inaccessible (ex: désactivé) ne casse pas l'ensemble
            continue

        for item in results:
            try:
                for ev in _serialize_event(item):
                    ev["calendar"] = cal_name
                    events.append(ev)
            except Exception:
                continue

    events.sort(key=lambda e: e["start"])
    return events


def _serialize_event(item) -> list[dict]:
    """Un VEVENT peut contenir plusieurs occurrences expanded → liste."""
    vobj = item.vobject_instance
    out: list[dict] = []
    for ve in vobj.contents.get("vevent", []):
        uid = str(ve.uid.value) if hasattr(ve, "uid") else str(uuid.uuid4())
        summary = str(ve.summary.value) if hasattr(ve, "summary") else "(sans titre)"
        description = str(ve.description.value) if hasattr(ve, "description") else ""
        location = str(ve.location.value) if hasattr(ve, "location") else ""

        dtstart = ve.dtstart.value
        dtend = ve.dtend.value if hasattr(ve, "dtend") else None

        all_day = not isinstance(dtstart, datetime)

        if isinstance(dtstart, datetime):
            start_iso = _ensure_aware(dtstart).isoformat()
        else:
            start_iso = dtstart.isoformat()

        if dtend is None:
            end_iso = start_iso
        elif isinstance(dtend, datetime):
            end_iso = _ensure_aware(dtend).isoformat()
        else:
            end_iso = dtend.isoformat()

        out.append({
            "uid": uid,
            "title": summary,
            "description": description,
            "location": location,
            "start": start_iso,
            "end": end_iso,
            "allDay": all_day,
            "reminderMinutes": _read_reminder(ve),
            "href": getattr(item, "url", None) and str(item.url) or "",
        })
    return out


def create_event(
    apple_id: str,
    app_password: str,
    title: str,
    start_iso: str,
    end_iso: str,
    description: str = "",
    location: str = "",
    calendar_name: str | None = None,
    reminder_minutes: int | None = None,
) -> dict:
    """Crée un VEVENT. Retourne l'objet sérialisé."""
    try:
        import vobject  # noqa: WPS433
    except ImportError as exc:
        raise CalendarError(
            "Bibliothèque vobject manquante. Lance : pip install vobject"
        ) from exc

    _, calendars = _connect(apple_id, app_password)
    cal = _pick_calendar(calendars, calendar_name)

    start = _parse_iso(start_iso)
    end = _parse_iso(end_iso) if end_iso else start + timedelta(hours=1)

    uid = f"{uuid.uuid4()}@nathan-code-list"

    vcal = vobject.iCalendar()
    vcal.add("prodid").value = "-//Nathan Code List//FR"
    vevent = vcal.add("vevent")
    vevent.add("uid").value = uid
    vevent.add("summary").value = title or "(sans titre)"
    vevent.add("dtstart").value = start
    vevent.add("dtend").value = end
    vevent.add("dtstamp").value = datetime.now(_UTC)
    if description:
        vevent.add("description").value = description
    if location:
        vevent.add("location").value = location
    _set_reminder(vevent, reminder_minutes)

    try:
        cal.save_event(vcal.serialize())
    except Exception as exc:
        raise CalendarError(f"Création de l'événement échouée : {exc}") from exc

    return {
        "uid": uid,
        "title": vevent.summary.value,
        "description": description,
        "location": location,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "allDay": False,
        "reminderMinutes": reminder_minutes,
    }


def _find_event_by_uid(cal, uid: str):
    try:
        return cal.event_by_uid(uid)
    except Exception:
        # Fallback : scan
        for ev in cal.events():
            try:
                ve = ev.vobject_instance.vevent
                if str(ve.uid.value) == uid:
                    return ev
            except Exception:
                continue
        return None


def update_event(
    apple_id: str,
    app_password: str,
    uid: str,
    patch: dict[str, Any],
    calendar_name: str | None = None,
) -> dict:
    _, calendars = _connect(apple_id, app_password)
    cal = _pick_calendar(calendars, calendar_name)

    target = _find_event_by_uid(cal, uid)
    if target is None:
        raise CalendarError("Événement introuvable.")

    vobj = target.vobject_instance
    vevent = vobj.vevent

    if "title" in patch:
        vevent.summary.value = patch["title"] or "(sans titre)"
    if "description" in patch:
        if hasattr(vevent, "description"):
            vevent.description.value = patch["description"]
        else:
            vevent.add("description").value = patch["description"]
    if "location" in patch:
        if hasattr(vevent, "location"):
            vevent.location.value = patch["location"]
        else:
            vevent.add("location").value = patch["location"]
    if "start" in patch and patch["start"]:
        vevent.dtstart.value = _parse_iso(patch["start"])
    if "end" in patch and patch["end"]:
        vevent.dtend.value = _parse_iso(patch["end"])
    if "reminderMinutes" in patch:
        rm = patch["reminderMinutes"]
        _set_reminder(vevent, None if rm in (None, "") else int(rm))

    try:
        target.data = vobj.serialize()
        target.save()
    except Exception as exc:
        raise CalendarError(f"Mise à jour échouée : {exc}") from exc

    return _serialize_event(target)[0]


def delete_event(
    apple_id: str,
    app_password: str,
    uid: str,
    calendar_name: str | None = None,
) -> bool:
    _, calendars = _connect(apple_id, app_password)
    cal = _pick_calendar(calendars, calendar_name)

    target = _find_event_by_uid(cal, uid)
    if target is None:
        raise CalendarError("Événement introuvable.")

    try:
        target.delete()
    except Exception as exc:
        raise CalendarError(f"Suppression échouée : {exc}") from exc
    return True
