"""
Nathan Code List - Centre de commandement freelance
Backend Python avec pywebview : vraie fenêtre desktop native (WebView2).

Compatible exécution directe (`python main.py`) et exécutable PyInstaller
(--onefile). Le fichier data.json est stocké dans %APPDATA%/NathanCodeList
pour persister entre les mises à jour de l'application.
"""

import json
import os
import sys
import uuid
from datetime import datetime, date

import webview


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
INDEX_FILE = os.path.join(BUNDLE_DIR, "web", "index.html")
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
        "codeTime": 0,
        "prospectionTime": 0,
        "dailyGoalCode": 14400,
        "dailyGoalProspection": 3600,
        "lastReset": str(date.today()),
    },
    "projects": [],
    "history": [],
}


# ----------------------------------------------------------------------
# Persistance JSON
# ----------------------------------------------------------------------
def _ensure_data_file() -> None:
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_DATA, f, indent=2, ensure_ascii=False)


def _read() -> dict:
    _ensure_data_file()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Fusion défensive
    for key, value in DEFAULT_DATA.items():
        if key not in data:
            data[key] = value
        elif isinstance(value, dict):
            for sub_k, sub_v in value.items():
                if sub_k not in data[key]:
                    data[key][sub_k] = sub_v

    # Reset journalier
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
# API exposée à React via pywebview (window.pywebview.api.*)
# ----------------------------------------------------------------------
class Api:
    # ---------- Lecture / écriture brute ----------
    def get_data(self) -> dict:
        return _read()

    def save_data(self, data: dict) -> dict:
        _write(data)
        return data

    # ---------- Tâches ----------
    def add_task(self, title: str, priority: str = "medium") -> dict:
        data = _read()
        data["tasks"].append({
            "id": str(uuid.uuid4()),
            "title": (title or "").strip(),
            "priority": priority,
            "completed": False,
            "timeSpent": 0,
            "createdAt": datetime.now().isoformat(timespec="seconds"),
        })
        _write(data)
        return data

    def update_task(self, task_id: str, patch: dict) -> dict:
        data = _read()
        for t in data["tasks"]:
            if t["id"] == task_id:
                t.update(patch)
                break
        _write(data)
        return data

    def add_task_time(self, task_id: str, seconds: int) -> dict:
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

    def delete_task(self, task_id: str) -> dict:
        data = _read()
        data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id]
        _write(data)
        return data

    # ---------- Prospection ----------
    def update_prospection(self, patch: dict) -> dict:
        data = _read()
        data["prospection"].update(patch)
        _write(data)
        return data

    def add_prospection_time(self, seconds: int) -> dict:
        data = _read()
        data["productivity"]["prospectionTime"] = (
            data["productivity"].get("prospectionTime", 0) + int(seconds)
        )
        _write(data)
        return data

    # ---------- Projets ----------
    def add_project(self, name: str, client: str = "",
                    status: str = "prospect", description: str = "") -> dict:
        data = _read()
        data["projects"].append({
            "id": str(uuid.uuid4()),
            "name": (name or "").strip(),
            "client": (client or "").strip(),
            "status": status,
            "description": (description or "").strip(),
            "createdAt": datetime.now().isoformat(timespec="seconds"),
        })
        _write(data)
        return data

    def update_project(self, project_id: str, patch: dict) -> dict:
        data = _read()
        for p in data["projects"]:
            if p["id"] == project_id:
                p.update(patch)
                break
        _write(data)
        return data

    def delete_project(self, project_id: str) -> dict:
        data = _read()
        data["projects"] = [p for p in data["projects"] if p["id"] != project_id]
        _write(data)
        return data


# ----------------------------------------------------------------------
# Bootstrap : crée une vraie fenêtre native (WebView2 sur Windows 11)
# ----------------------------------------------------------------------
def main() -> None:
    _ensure_data_file()

    webview.create_window(
        title="Nathan Code List",
        url=INDEX_FILE,
        js_api=Api(),
        width=1400,
        height=900,
        x=80,
        y=40,
        min_size=(1000, 700),
        background_color="#E0F3E1",  # cohérent avec le light mode au boot
    )
    # gui="edgechromium" → WebView2 (livré avec Windows 10/11, aucune install)
    # debug=True → DevTools accessibles via F12 / clic droit → Inspecter
    webview.start(gui="edgechromium", debug=True)


if __name__ == "__main__":
    main()
