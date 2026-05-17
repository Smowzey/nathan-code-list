/* global React */
/**
 * ProjectMatrix — Pipeline projets style Kanban
 * 5 colonnes : Prospect → Design UI → Intégration → Optimisation → Livré
 */
const STATUSES = [
    { value: 'prospect',     label: 'Prospect' },
    { value: 'design',       label: 'Design UI' },
    { value: 'integration',  label: 'Intégration' },
    { value: 'optimization', label: 'Optimisation' },
    { value: 'delivered',    label: 'Livré' },
];

const ProjectCard = ({ project, onMove, onDelete }) => {
    const currentIndex = STATUSES.findIndex((s) => s.value === project.status);

    return (
        <div className="project-card">
            <div className="project-card__name">{project.name}</div>
            {project.client && (
                <div className="project-card__client">{project.client}</div>
            )}
            {project.description && (
                <div className="project-card__desc">{project.description}</div>
            )}
            <div className="project-card__actions">
                <select
                    className="project-card__move"
                    value={project.status}
                    onChange={(e) => onMove(project.id, e.target.value)}
                >
                    {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: 4 }}>
                    {currentIndex > 0 && (
                        <button
                            className="btn btn--icon"
                            title="Précédent"
                            onClick={() => onMove(project.id, STATUSES[currentIndex - 1].value)}
                        >
                            ←
                        </button>
                    )}
                    {currentIndex < STATUSES.length - 1 && (
                        <button
                            className="btn btn--icon"
                            title="Suivant"
                            onClick={() => onMove(project.id, STATUSES[currentIndex + 1].value)}
                        >
                            →
                        </button>
                    )}
                    <button
                        className="btn btn--icon btn--danger"
                        title="Supprimer"
                        onClick={() => onDelete(project.id)}
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProjectMatrix = ({ projects, onUpdate }) => {
    const [name, setName] = React.useState('');
    const [client, setClient] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [status, setStatus] = React.useState('prospect');

    const addProject = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const data = await window.eel.add_project(name, client, status, description)();
        onUpdate(data);
        setName('');
        setClient('');
        setDescription('');
        setStatus('prospect');
    };

    const moveProject = async (projectId, newStatus) => {
        const data = await window.eel.update_project(projectId, { status: newStatus })();
        onUpdate(data);
    };

    const deleteProject = async (projectId) => {
        const data = await window.eel.delete_project(projectId)();
        onUpdate(data);
    };

    const byStatus = STATUSES.reduce((acc, s) => {
        acc[s.value] = projects.filter((p) => p.status === s.value);
        return acc;
    }, {});

    return (
        <div>
            <form className="project-composer" onSubmit={addProject}>
                <input
                    className="input"
                    placeholder="Nom du projet"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <input
                    className="input"
                    placeholder="Client (optionnel)"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                />
                <select
                    className="select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
                <button type="submit" className="btn btn--primary">+ Projet</button>
                <textarea
                    className="textarea"
                    placeholder="Brief / description (optionnel)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ gridColumn: '1 / -1' }}
                />
            </form>

            <div className="matrix">
                {STATUSES.map((s) => (
                    <div className="matrix__column" key={s.value}>
                        <div className="matrix__column-header">
                            <h3>{s.label}</h3>
                            <span className="matrix__count">{byStatus[s.value].length}</span>
                        </div>
                        {byStatus[s.value].length === 0 ? (
                            <div className="empty-state" style={{ padding: 16, fontSize: 12 }}>
                                Vide
                            </div>
                        ) : (
                            byStatus[s.value].map((p) => (
                                <ProjectCard
                                    key={p.id}
                                    project={p}
                                    onMove={moveProject}
                                    onDelete={deleteProject}
                                />
                            ))
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

window.ProjectMatrix = ProjectMatrix;
