/* global React, ReactDOM, ToDoList, Analytics, ProjectMatrix, Calendar */
/**
 * App — coquille principale Nathan Code List.
 * Charge l'état depuis Python (window.pywebview.api.get_data) puis route
 * entre les trois modules.
 *
 * L'état du Pomodoro est conservé ici (et pas dans `PomodoroTimer`) pour
 * survivre aux changements de module : démonter/remonter le composant
 * ne réinitialise plus le chrono en cours.
 */
const MODULES = [
    {
        key: 'focus',
        label: 'Focus quotidien',
        icon: '◉',
        title: 'Focus quotidien',
        subtitle: 'Tes priorités du jour. Lance le minuteur, accumule le temps de deep work.',
    },
    {
        key: 'analytics',
        label: 'Analytique',
        icon: '◑',
        title: 'Tableau de bord',
        subtitle: 'Funnel de prospection et productivité — la photographie de ton activité.',
    },
    {
        key: 'projects',
        label: 'Matrice projets',
        icon: '◰',
        title: 'Matrice des projets',
        subtitle: 'Pipeline visuel de tes missions, du premier contact à la livraison.',
    },
    {
        key: 'calendar',
        label: 'Calendrier',
        icon: '▦',
        title: 'Calendrier',
        subtitle: 'Tes événements semaine par semaine. Importe un Excel pour synchroniser ton planning.',
    },
];

const Sidebar = ({ active, onSelect }) => (
    <aside className="sidebar">
        <div className="sidebar__brand">
            <h1>Nathan Code List</h1>
            <span>Centre de commandement</span>
        </div>
        <nav className="sidebar__nav">
            {MODULES.map((m) => (
                <button
                    key={m.key}
                    className={`nav-item ${active === m.key ? 'nav-item--active' : ''}`}
                    onClick={() => onSelect(m.key)}
                >
                    <span className="nav-item__icon">{m.icon}</span>
                    {m.label}
                </button>
            ))}
        </nav>
        <div className="sidebar__footer">
            v1.0 · Local · Stockage JSON
        </div>
    </aside>
);

const App = () => {
    const [data, setData] = React.useState(null);
    const [active, setActive] = React.useState('focus');

    // pomodoros : map { [taskId]: { accumulatedMs, runStartAt } }
    //   - runStartAt = timestamp ms → la session tourne
    //   - runStartAt = null         → la session est en pause
    //   - clé absente               → pas de session sur cette tâche
    // Plusieurs tâches peuvent tourner en parallèle.
    const [pomodoros, setPomodoros] = React.useState({});

    React.useEffect(() => {
        // pywebview peut avoir déjà fini d'injecter window.pywebview.api avant
        // que Babel ait transpilé ce composant. On poll plutôt que d'écouter
        // l'événement `pywebviewready` (qui peut avoir été émis trop tôt).
        const waitForApi = () => new Promise((resolve) => {
            const check = () => {
                if (window.pywebview && window.pywebview.api
                    && window.pywebview.api.get_data) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });

        const boot = async () => {
            await waitForApi();
            const initial = await window.pywebview.api.get_data();
            setData(initial);
        };
        boot();
    }, []);

    // ---- Helpers Pomodoro (multi-timer) ----
    const startPomodoro = (taskId) => {
        setPomodoros((prev) => {
            const existing = prev[taskId];
            return {
                ...prev,
                [taskId]: {
                    accumulatedMs: existing ? existing.accumulatedMs : 0,
                    runStartAt: Date.now(),
                },
            };
        });
    };

    const pausePomodoro = (taskId) => {
        setPomodoros((prev) => {
            const p = prev[taskId];
            if (!p || !p.runStartAt) return prev;
            return {
                ...prev,
                [taskId]: {
                    accumulatedMs: p.accumulatedMs + (Date.now() - p.runStartAt),
                    runStartAt: null,
                },
            };
        });
    };

    const resetPomodoro = async (taskId) => {
        const p = pomodoros[taskId];
        if (!p) return;
        const totalMs = p.accumulatedMs
            + (p.runStartAt ? Date.now() - p.runStartAt : 0);
        const seconds = Math.floor(totalMs / 1000);
        if (seconds > 0) {
            const updated = await window.pywebview.api.add_task_time(taskId, seconds);
            setData(updated);
        }
        setPomodoros((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    };

    if (!data) {
        return <div className="loading">Chargement…</div>;
    }

    const current = MODULES.find((m) => m.key === active);

    return (
        <div className="app-shell">
            <Sidebar active={active} onSelect={setActive} />
            <main className="main">
                <header className="main__header">
                    <h1 className="main__title">{current.title}</h1>
                    <p className="main__subtitle">{current.subtitle}</p>
                </header>

                {active === 'focus' && (
                    <ToDoList
                        tasks={data.tasks}
                        onUpdate={setData}
                        pomodoros={pomodoros}
                        onPomodoroStart={startPomodoro}
                        onPomodoroPause={pausePomodoro}
                        onPomodoroReset={resetPomodoro}
                    />
                )}
                {active === 'analytics' && (
                    <Analytics
                        prospection={data.prospection}
                        productivity={data.productivity}
                        onUpdate={setData}
                    />
                )}
                {active === 'projects' && (
                    <ProjectMatrix projects={data.projects} onUpdate={setData} />
                )}
                {active === 'calendar' && (
                    <Calendar events={data.events || []} onUpdate={setData} />
                )}
            </main>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
