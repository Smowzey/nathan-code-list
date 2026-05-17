/* global React */
/**
 * PomodoroTimer
 *
 * L'état des sessions vit dans App.jsx pour survivre aux changements
 * de module et permettre plusieurs chronos en parallèle.
 *
 * Props :
 *   - session  : { accumulatedMs, runStartAt } | undefined
 *                runStartAt = ms timestamp → tourne ; null → en pause
 *   - onStart(taskId), onPause(taskId), onReset(taskId)
 */
const PomodoroTimer = ({ taskId, accumulatedSeconds, session,
                         onStart, onPause, onReset }) => {
    const isRunning = !!(session && session.runStartAt);

    // Force un re-render chaque seconde tant qu'on tourne : l'affichage
    // recalcule l'écoulé à partir de session.runStartAt + Date.now().
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
        if (!isRunning) return;
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [isRunning]);

    const sessionSeconds = session
        ? Math.floor(
              (session.accumulatedMs
                  + (session.runStartAt ? Date.now() - session.runStartAt : 0))
              / 1000
          )
        : 0;

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
            <span className={`pomodoro__time ${isRunning ? 'pomodoro__time--running' : ''}`}>
                {formatTime(sessionSeconds)}
            </span>
            <button
                className={`pomodoro__btn ${isRunning ? 'pomodoro__btn--running' : ''}`}
                onClick={isRunning ? () => onPause(taskId) : () => onStart(taskId)}
                title={isRunning ? 'Pause' : 'Démarrer'}
            >
                {isRunning ? '❚❚' : '▶'}
            </button>
            {session && sessionSeconds > 0 && !isRunning && (
                <button
                    className="pomodoro__btn"
                    onClick={() => onReset(taskId)}
                    title="Valider la session et remettre à zéro"
                >
                    ↺
                </button>
            )}
            <span className="pomodoro__total" title="Temps cumulé sur cette tâche">
                Σ {formatTotal(accumulatedSeconds || 0)}
            </span>
        </div>
    );
};

window.PomodoroTimer = PomodoroTimer;
