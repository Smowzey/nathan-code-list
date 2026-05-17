/* global React */
/**
 * PomodoroTimer
 * Minuteur attaché à une tâche. À chaque pause/stop, on envoie les
 * secondes écoulées au backend Python pour cumul persistant.
 */
const PomodoroTimer = ({ taskId, accumulatedSeconds, onAccumulate }) => {
    const [running, setRunning] = React.useState(false);
    const [elapsed, setElapsed] = React.useState(0); // secondes session courante
    const intervalRef = React.useRef(null);

    React.useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setElapsed((s) => s + 1);
            }, 1000);
        }
        return () => clearInterval(intervalRef.current);
    }, [running]);

    const flush = React.useCallback(async () => {
        if (elapsed > 0) {
            await onAccumulate(taskId, elapsed);
            setElapsed(0);
        }
    }, [elapsed, onAccumulate, taskId]);

    const toggle = async () => {
        if (running) {
            setRunning(false);
            await flush();
        } else {
            setRunning(true);
        }
    };

    const reset = async () => {
        setRunning(false);
        await flush();
    };

    const formatTime = (sec) => {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `${m}:${s}`;
    };

    const formatTotal = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <div className="pomodoro">
            <span className={`pomodoro__time ${running ? 'pomodoro__time--running' : ''}`}>
                {formatTime(elapsed)}
            </span>
            <button
                className={`pomodoro__btn ${running ? 'pomodoro__btn--running' : ''}`}
                onClick={toggle}
                title={running ? 'Pause' : 'Démarrer'}
            >
                {running ? '❚❚' : '▶'}
            </button>
            {elapsed > 0 && !running && (
                <button className="pomodoro__btn" onClick={reset} title="Réinitialiser">
                    ↺
                </button>
            )}
            <span className="pomodoro__total" title="Temps cumulé">
                Σ {formatTotal(accumulatedSeconds || 0)}
            </span>
        </div>
    );
};

window.PomodoroTimer = PomodoroTimer;
