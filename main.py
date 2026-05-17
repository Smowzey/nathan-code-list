"""
Nathan Code List - Centre de commandement freelance
Backend Python avec Eel : sert l'interface web et gère le stockage JSON.

Compatible exécution directe (`python main.py`) et exécutable PyInstaller
(--onefile). Le fichier data.json est stocké dans %APPDATA%/NathanCodeList
pour persister entre les mises à jour de l'application.
"""

import eel
import json
import os
import sys
import uuid
from datetime import datetime, date

# ----------------------------------------------------------------------
# Résolution des chemins (dev + PyInstaller --onefile)
# ----------------------------------------------------------------------
def _bundle_root() -> str:
    """Racine des assets : dossier du script en dev, _MEIPASS en bundle."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS  # type: ignore[attr-defined]
    return os.path.dirname(os.path.abspath(__file__))


def _user_data_dir() -> str:
    """Dossier utilisateur où data.json est conservé entre les sessions."""
    appdata = os.environ.get("APPDATA") or os.path.expanduser("~")
    target = os.path.join(appdata, "NathanCodeList")
    os.makedirs(target, exist_ok=True)
    return target


BUNDLE_DIR = _bundle_root()
WEB_DIR = os.path.join(BUNDLE_DIR, "web")
DATA_FILE = os.path.join(_user_data_dir(), "data.json")

DEFAULT_DATA = {
    "tasks": [],
    "prospection": {
        "sent": 0,
        "viewed": 0,
        "responses": 0,
        "meetings": 0,
    },
    "productivity": {
        "codeTime": 0,            # secondes accumulées aujourd'hui
        "prospectionTime": 0,     # secondes accumulées aujourd'hui
        "dailyGoalCode": 14400,   # 4h en secondes
        "dailyGoalProspection": 3600,  # 1h en secondes
        "lastReset": str(date.today()),
    },
    "projects": [],
    "history": [],
}


# ----------------------------------------------------------------------
# Persistance JSON
# ----------------------------------------------------------------------
def _ensure_data_file() -> None:
    """Crée data.json avec les valeurs par défaut s'il n'existe pas."""
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_DATA, f, indent=2, ensure_ascii=False)


def _read() -> dict:
    _ensure_data_file()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Fusion défensive : si une clé manque (ancienne version), on la rajoute.
    for key, value in DEFAULT_DATA.items():
        if key not in data:
            data[key] = value
        elif isinstance(value, dict):
            for sub_k, sub_v in value.items():
                if sub_k not in data[key]:
                    data[key][sub_k] = sub_v

    # Reset journalier des compteurs de productivité.
    today = str(date.today())
    if data["productivity"].get("lastReset") != today:
        data["history"].append({
            "date": data["productivity"].get("lastReset", today),
            "codeTime": data["productivity"]["codeTime"],
            "prospectionTime": data["productivity"]["prospectionTime"],
        })
        data["productivity"]["codeTime"] = 0
        data["productivity"]["prospectionTime"] = 0
        data["productivity"]["lastReset"] = today
        _write(data)

    return data


def _write(data: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ----------------------------------------------------------------------
# API exposée à React via Eel
# ----------------------------------------------------------------------
@eel.expose
def get_data() -> dict:
    return _read()


@eel.expose
def save_data(data: dict) -> dict:
    _write(data)
    return data


# ---------- Tâches ----------
@eel.expose
def add_task(title: str, priority: str = "medium") -> dict:
    data = _read()
    task = {
        "id": str(uuid.uuid4()),
        "title": title.strip(),
        "priority": priority,
        "completed": False,
        "timeSpent": 0,
        "createdAt": datetime.now().isoformat(timespec="seconds"),
    }
    data["tasks"].append(task)
    _write(data)
    return data


@eel.expose
def update_task(task_id: str, patch: dict) -> dict:
    data = _read()
    for t in data["tasks"]:
        if t["id"] == task_id:
            t.update(patch)
            break
    _write(data)
    return data


@eel.expose
def add_task_time(task_id: str, seconds: int) -> dict:
    data = _read()
    for t in data["tasks"]:
        if t["id"] == task_id:
            t["timeSpent"] = t.get("timeSpent", 0) + int(seconds)
            break
    data["productivity"]["codeTime"] = (
        data["productivity"].get("codeTime", 0) + int(seconds)
    )
    _write(data)
    return data


@eel.expose
def delete_task(task_id: str) -> dict:
    data = _read()
    data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id]
    _write(data)
    return data


# ---------- Prospection ----------
@eel.expose
def update_prospection(patch: dict) -> dict:
    data = _read()
    data["prospection"].update(patch)
    _write(data)
    return data


@eel.expose
def add_prospection_time(seconds: int) -> dict:
    data = _read()
    data["productivity"]["prospectionTime"] = (
        data["productivity"].get("prospectionTime", 0) + int(seconds)
    )
    _write(data)
    return data


# ---------- Projets ----------
@eel.expose
def add_project(name: str, client: str = "", status: str = "prospect",
                description: str = "") -> dict:
    data = _read()
    project = {
        "id": str(uuid.uuid4()),
        "name": name.strip(),
        "client": client.strip(),
        "status": status,
        "description": description.strip(),
        "createdAt": datetime.now().isoformat(timespec="seconds"),
    }
    data["projects"].append(project)
    _write(data)
    return data


@eel.expose
def update_project(project_id: str, patch: dict) -> dict:
    data = _read()
    for p in data["projects"]:
        if p["id"] == project_id:
            p.update(patch)
            break
    _write(data)
    return data


@eel.expose
def delete_project(project_id: str) -> dict:
    data = _read()
    data["projects"] = [p for p in data["projects"] if p["id"] != project_id]
    _write(data)
    return data


# ----------------------------------------------------------------------
# Bootstrap : tentative Chrome → Edge → navigateur par défaut
# ----------------------------------------------------------------------
def _start(mode: str) -> bool:
    """Tente de lancer Eel dans un mode donné. Retourne True si lancé."""
    try:
        eel.start(
            "index.html",
            size=(1400, 900),
            position=(80, 40),
            mode=mode,
        )
        return True
    except (SystemExit, KeyboardInterrupt):
        return True  # fermeture normale par l'utilisateur
    except Exception:
        return False


def main() -> None:
    _ensure_data_file()
    eel.init(WEB_DIR)

    for mode in ("chrome", "edge", "default"):
        if _start(mode):
            return

    print("Impossible de lancer un navigateur — aucun de chrome/edge/default n'est disponible.")
    sys.exit(1)


if __name__ == "__main__":
    main()
