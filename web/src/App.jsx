/* global React, ReactDOM, ToDoList, Analytics, ProjectMatrix */
/**
 * App — coquille principale Nathan Code List.
 * Charge l'état depuis Python (window.pywebview.api.get_data) puis route
 * entre les trois modules.
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

    React.useEffect(() => {
        const boot = async () => {
            // pywebview injecte window.pywebview.api après le chargement.
            // On attend l'événement `pywebviewready` si ce n'est pas encore prêt.
            if (!window.pywebview || !window.pywebview.api) {
                await new Promise((resolve) => {
                    window.addEventListener('pywebviewready', resolve, { once: true });
                });
            }
            const initial = await window.pywebview.api.get_data();
            setData(initial);
        };
        boot();
    }, []);

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
                    <ToDoList tasks={data.tasks} onUpdate={setData} />
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
            </main>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
