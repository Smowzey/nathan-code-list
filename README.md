# Nathan Code List

Centre de commandement freelance — application bureau locale (Python Eel + React + CSS pur), distribuée en `.exe` portable via GitHub Releases.

---

## Installation utilisateur (.exe)

1. Aller sur la [page Releases](../../releases/latest) du repo.
2. Télécharger `NathanCodeList.exe`.
3. Double-cliquer pour lancer. Aucune installation nécessaire.

Les données sont stockées dans `%APPDATA%\NathanCodeList\data.json` (elles survivent aux mises à jour de l'app).

---

## Architecture

```
Nathan Code List/
├── main.py                  # Backend Eel + persistance JSON
├── build.spec               # Recette PyInstaller (--onefile, --noconsole)
├── requirements.txt         # eel + setuptools<81
├── .gitignore
├── .github/
│   └── workflows/
│       └── build.yml        # CI : build l'.exe sur tag `v*`
└── web/
    ├── index.html
    ├── style.css            # Design system "Luxury Dark Mode"
    ├── vendor/              # React, ReactDOM, Recharts, Babel, Inter (offline-first)
    │   ├── react.production.min.js
    │   ├── react-dom.production.min.js
    │   ├── prop-types.min.js
    │   ├── Recharts.js
    │   ├── babel.min.js
    │   └── fonts/Inter.woff2
    └── src/
        ├── App.jsx
        └── components/
            ├── PomodoroTimer.jsx
            ├── ToDoList.jsx
            ├── Analytics.jsx
            └── ProjectMatrix.jsx
```

---

## Développement local

```powershell
pip install -r requirements.txt
python main.py
```

Tu peux modifier les `.jsx` / `style.css` puis recharger la fenêtre (Ctrl+R).

---

## Build local d'un .exe

```powershell
pip install pyinstaller
pyinstaller build.spec
```

→ `dist\NathanCodeList.exe` (un seul fichier, ~30-50 Mo).

---

## Publier une nouvelle version (automatique via GitHub Actions)

Tout le pipeline tourne sur GitHub Actions gratuit (repo public = minutes illimitées).

```powershell
# 1. Commit tes changements
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push

# 2. Crée et pousse un tag versionné
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions va automatiquement :
1. Builder l'exe sur une VM Windows
2. Créer une Release publique
3. Y attacher `NathanCodeList.exe` téléchargeable

Tu peux aussi déclencher un build manuel sans tag depuis l'onglet **Actions** → workflow "Build & Release Windows .exe" → **Run workflow**.

---

## Setup du repo GitHub (première fois)

```powershell
# Dans le dossier du projet
git init
git add .
git commit -m "Initial commit"

# Crée le repo sur github.com (public, sans README/gitignore puisque déjà fournis)
git branch -M main
git remote add origin https://github.com/<TON_USER>/nathan-code-list.git
git push -u origin main
```

---

## Stack

- **Python 3.12** + **Eel 0.16** (pont WebSocket Python ↔ navigateur)
- **React 18** + **Recharts 2.12** (UMD, servis depuis `web/vendor/`)
- **Babel Standalone** (transpile les `.jsx` au runtime → aucun build front)
- **CSS Vanilla** avec variables CSS (luxury dark mode)
- **PyInstaller** pour le packaging .exe portable
- **GitHub Actions** pour la CI/CD (build + release automatique)

---

## Modules

1. **Focus quotidien** — Tâches priorisées + Pomodoro par tâche, temps cumulé qui alimente la jauge de productivité.
2. **Analytique** — Funnel de prospection (Contacts → Vus → Réponses → RDV) + jauges journalières (code, prospection).
3. **Matrice projets** — Kanban 5 colonnes : Prospect → Design UI → Intégration → Optimisation → Livré.

---

## Coût total : 0 €

- Hébergement code : GitHub (gratuit, repo public)
- CI/CD : GitHub Actions (gratuit, illimité sur repos publics)
- Distribution : GitHub Releases (gratuit, illimité)
- Stockage utilisateur : local (%APPDATA%)
