/* global React, PomodoroTimer */
/**
 * ToDoList — Module Focus Quotidien
 * Liste de tâches avec priorité + Pomodoro intégré par tâche.
 * Toute mutation est envoyée au backend Python via window.eel.
 */
const PRIORITIES = [
    { value: 'high',   label: 'Haute' },
    { value: 'medium', label: 'Moyenne' },
    { value: 'low',    label: 'Basse' },
];

const ToDoList = ({ tasks, onUpdate }) => {
    const [title, setTitle] = React.useState('');
    const [priority, setPriority] = React.useState('medium');

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const data = await window.eel.add_task(title, priority)();
        onUpdate(data);
        setTitle('');
        setPriority('medium');
    };

    const toggleComplete = async (task) => {
        const data = await window.eel.update_task(task.id, {
            completed: !task.completed,
        })();
        onUpdate(data);
    };

    const remove = async (taskId) => {
        const data = await window.eel.delete_task(taskId)();
        onUpdate(data);
    };

    const accumulate = async (taskId, seconds) => {
        const data = await window.eel.add_task_time(taskId, seconds)();
        onUpdate(data);
    };

    const sorted = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
    });

    const remaining = tasks.filter((t) => !t.completed).length;

    return (
        <div className="todo">
            <form className="todo__composer" onSubmit={handleAdd}>
                <input
                    className="input"
                    placeholder="Nouvelle tâche — ex. Refactor module auth"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <select
                    className="select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                >
                    {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                            Priorité {p.label}
                        </option>
                    ))}
                </select>
                <button type="submit" className="btn btn--primary">
                    + Ajouter
                </button>
            </form>

            <div className="section-title">
                <h2>Tâches du jour</h2>
                <small>{remaining} restantes · {tasks.length} au total</small>
            </div>

            {tasks.length === 0 ? (
                <div className="empty-state">
                    Aucune tâche pour l'instant — commence par en ajouter une ci-dessus.
                </div>
            ) : (
                <div className="task-list">
                    {sorted.map((task) => (
                        <div
                            key={task.id}
                            className={`task ${task.completed ? 'task--done' : ''}`}
                        >
                            <button
                                className={`task__check ${task.completed ? 'task__check--checked' : ''}`}
                                onClick={() => toggleComplete(task)}
                                aria-label="Marquer comme terminée"
                            />
                            <div className="task__body">
                                <span className="task__title">{task.title}</span>
                                <div className="task__meta">
                                    <span className={`priority-chip priority-chip--${task.priority}`}>
                                        {PRIORITIES.find((p) => p.value === task.priority)?.label}
                                    </span>
                                </div>
                            </div>
                            <PomodoroTimer
                                taskId={task.id}
                                accumulatedSeconds={task.timeSpent || 0}
                                onAccumulate={accumulate}
                            />
                            <button
                                className="btn btn--icon btn--danger"
                                onClick={() => remove(task.id)}
                                title="Supprimer"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

window.ToDoList = ToDoList;
