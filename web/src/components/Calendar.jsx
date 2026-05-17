/* global React */
/**
 * Calendar — vue calendrier iCloud (CalDAV).
 * Connecté au calendrier iPhone via Apple ID + mot de passe d'application.
 *
 * Trois modes :
 *  - Setup     : pas encore connecté → formulaire Apple ID / mot de passe
 *  - Semaine   : liste des événements des 7 prochains jours
 *  - Mois      : grille mensuelle classique
 */

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ---------- Helpers date ----------
const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};
const startOfMonth = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    return x;
};
const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
};
const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();

const toLocalInput = (d) => {
    // valeur pour <input type="datetime-local">
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s) => new Date(s);

const formatHour = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const formatDay = (d) =>
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- Setup ----------
const CalendarSetup = ({ onConnected }) => {
    const [appleId, setAppleId] = React.useState('');
    const [appPassword, setAppPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const res = await window.pywebview.api.connect_calendar(appleId.trim(), appPassword.trim());
        setLoading(false);
        if (!res.ok) {
            setError(res.error || 'Connexion échouée.');
            return;
        }
        onConnected(res.data);
    };

    return (
        <div className="calendar-setup">
            <div className="calendar-setup__card">
                <h2>Connecter ton calendrier iPhone</h2>
                <p className="calendar-setup__intro">
                    On utilise le compte iCloud lié à ton iPhone — les événements
                    que tu vois ici sont exactement ceux de l'app Calendrier.
                </p>

                <ol className="calendar-setup__steps">
                    <li>Va sur <strong>appleid.apple.com</strong> → Sécurité → Mots de passe pour applications.</li>
                    <li>Génère un nouveau mot de passe (intitule-le « Nathan Code List »).</li>
                    <li>Colle ton Apple ID et ce mot de passe ci-dessous.</li>
                </ol>

                <form onSubmit={submit} className="calendar-setup__form">
                    <label>
                        Apple ID (email)
                        <input
                            type="email"
                            className="input"
                            placeholder="nathan@exemple.com"
                            value={appleId}
                            onChange={(e) => setAppleId(e.target.value)}
                            required
                        />
                    </label>
                    <label>
                        Mot de passe d'application
                        <input
                            type="password"
                            className="input"
                            placeholder="xxxx-xxxx-xxxx-xxxx"
                            value={appPassword}
                            onChange={(e) => setAppPassword(e.target.value)}
                            required
                        />
                    </label>
                    {error && <div className="calendar-setup__error">{error}</div>}
                    <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={loading}
                    >
                        {loading ? 'Connexion…' : 'Connecter iCloud'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ---------- Formulaire d'événement ----------
const EventForm = ({ initial, onSave, onCancel, onDelete }) => {
    const isEdit = Boolean(initial?.uid);
    const [title, setTitle] = React.useState(initial?.title || '');
    const [start, setStart] = React.useState(
        initial?.start ? toLocalInput(new Date(initial.start)) : toLocalInput(new Date()),
    );
    const [end, setEnd] = React.useState(() => {
        if (initial?.end) return toLocalInput(new Date(initial.end));
        const d = initial?.start ? new Date(initial.start) : new Date();
        d.setHours(d.getHours() + 1);
        return toLocalInput(d);
    });
    const [location, setLocation] = React.useState(initial?.location || '');
    const [description, setDescription] = React.useState(initial?.description || '');
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        setError('');
        const startD = fromLocalInput(start);
        const endD = fromLocalInput(end);
        if (endD <= startD) {
            setError('La fin doit être après le début.');
            setSaving(false);
            return;
        }
        try {
            await onSave({
                title: title.trim(),
                start: startD.toISOString(),
                end: endD.toISOString(),
                location: location.trim(),
                description: description.trim(),
            });
        } catch (err) {
            setError(err.message || 'Erreur');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="event-modal__backdrop" onClick={onCancel}>
            <div className="event-modal" onClick={(e) => e.stopPropagation()}>
                <h3>{isEdit ? 'Modifier l\'événement' : 'Nouvel événement'}</h3>
                <form onSubmit={handleSubmit}>
                    <label>
                        Titre
                        <input
                            type="text"
                            className="input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                            required
                        />
                    </label>
                    <div className="event-modal__row">
                        <label>
                            Début
                            <input
                                type="datetime-local"
                                className="input"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Fin
                            <input
                                type="datetime-local"
                                className="input"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                required
                            />
                        </label>
                    </div>
                    <label>
                        Lieu (optionnel)
                        <input
                            type="text"
                            className="input"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </label>
                    <label>
                        Description (optionnel)
                        <textarea
                            className="textarea"
                            rows="3"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </label>
                    {error && <div className="event-modal__error">{error}</div>}
                    <div className="event-modal__actions">
                        {isEdit && (
                            <button
                                type="button"
                                className="btn btn--danger"
                                onClick={onDelete}
                                disabled={saving}
                            >
                                Supprimer
                            </button>
                        )}
                        <div style={{ flex: 1 }} />
                        <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={onCancel}
                            disabled={saving}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="btn btn--primary"
                            disabled={saving}
                        >
                            {saving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ---------- Vue Semaine (liste 7 jours) ----------
const WeekView = ({ events, onEventClick }) => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

    const byDay = days.map((d) => ({
        date: d,
        events: events.filter((e) => sameDay(new Date(e.start), d)),
    }));

    return (
        <div className="calendar-week">
            {byDay.map(({ date, events: dayEvents }) => (
                <div key={date.toISOString()} className="calendar-week__day">
                    <div className="calendar-week__date">
                        <span className="calendar-week__date-num">{date.getDate()}</span>
                        <span className="calendar-week__date-name">
                            {formatDay(date)}
                        </span>
                    </div>
                    {dayEvents.length === 0 ? (
                        <div className="calendar-week__empty">Rien de prévu</div>
                    ) : (
                        <div className="calendar-week__events">
                            {dayEvents.map((ev) => (
                                <button
                                    key={ev.uid}
                                    className="event-pill"
                                    onClick={() => onEventClick(ev)}
                                    title={ev.description}
                                >
                                    <span className="event-pill__time">
                                        {ev.allDay ? 'Toute la journée' : formatHour(new Date(ev.start))}
                                    </span>
                                    <span className="event-pill__title">{ev.title}</span>
                                    {ev.calendar && (
                                        <span className="event-pill__cal">{ev.calendar}</span>
                                    )}
                                    {ev.location && (
                                        <span className="event-pill__location">{ev.location}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ---------- Vue Mois ----------
const MonthView = ({ cursor, events, onEventClick, onCellClick }) => {
    const first = startOfMonth(cursor);
    // Lundi = 1 dans getDay (qui retourne 0=dim). On veut une grille lundi→dimanche.
    const dayOfWeek = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -dayOfWeek);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const today = startOfDay(new Date());

    const eventsByDay = {};
    events.forEach((ev) => {
        const key = startOfDay(new Date(ev.start)).toISOString();
        if (!eventsByDay[key]) eventsByDay[key] = [];
        eventsByDay[key].push(ev);
    });

    return (
        <div className="calendar-month">
            <div className="calendar-month__header">
                {WEEKDAYS.map((w) => (
                    <div key={w} className="calendar-month__weekday">{w}</div>
                ))}
            </div>
            <div className="calendar-month__grid">
                {cells.map((d) => {
                    const inMonth = d.getMonth() === cursor.getMonth();
                    const isToday = sameDay(d, today);
                    const dayEvents = eventsByDay[startOfDay(d).toISOString()] || [];
                    return (
                        <div
                            key={d.toISOString()}
                            className={`calendar-month__cell ${inMonth ? '' : 'calendar-month__cell--out'} ${isToday ? 'calendar-month__cell--today' : ''}`}
                            onClick={() => onCellClick(d)}
                        >
                            <div className="calendar-month__cell-num">{d.getDate()}</div>
                            <div className="calendar-month__cell-events">
                                {dayEvents.slice(0, 3).map((ev) => (
                                    <button
                                        key={ev.uid}
                                        className="calendar-month__chip"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEventClick(ev);
                                        }}
                                    >
                                        {!ev.allDay && (
                                            <span className="calendar-month__chip-time">
                                                {formatHour(new Date(ev.start))}
                                            </span>
                                        )}
                                        <span className="calendar-month__chip-title">{ev.title}</span>
                                    </button>
                                ))}
                                {dayEvents.length > 3 && (
                                    <span className="calendar-month__more">
                                        +{dayEvents.length - 3}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ---------- Composant principal ----------
const Calendar = ({ calendarMeta, onMetaUpdate }) => {
    const [view, setView] = React.useState('week');
    const [cursor, setCursor] = React.useState(new Date());
    const [events, setEvents] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [editing, setEditing] = React.useState(null);
    // editing = null | { mode: 'create', defaults } | { mode: 'edit', event }

    const refresh = React.useCallback(async () => {
        if (!calendarMeta?.connected) return;
        setLoading(true);
        setError('');
        // Récupère sur ~3 mois autour du curseur pour couvrir semaine + mois
        const start = addDays(startOfMonth(cursor), -7);
        const end = addDays(startOfMonth(addDays(startOfMonth(cursor), 35)), 7);
        const res = await window.pywebview.api.list_calendar_events(
            start.toISOString(),
            end.toISOString(),
        );
        setLoading(false);
        if (!res.ok) {
            setError(res.error);
            return;
        }
        setEvents(res.events || []);
    }, [calendarMeta, cursor]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const handleSave = async (payload) => {
        let res;
        if (editing?.mode === 'edit') {
            res = await window.pywebview.api.update_calendar_event(
                editing.event.uid,
                payload,
            );
        } else {
            res = await window.pywebview.api.create_calendar_event(
                payload.title,
                payload.start,
                payload.end,
                payload.description,
                payload.location,
            );
        }
        if (!res.ok) throw new Error(res.error || 'Erreur iCloud');
        setEditing(null);
        await refresh();
    };

    const handleDelete = async () => {
        if (!editing || editing.mode !== 'edit') return;
        if (!confirm('Supprimer cet événement ?')) return;
        const res = await window.pywebview.api.delete_calendar_event(editing.event.uid);
        if (!res.ok) {
            setError(res.error);
            return;
        }
        setEditing(null);
        await refresh();
    };

    const handleDisconnect = async () => {
        if (!confirm('Déconnecter le calendrier iCloud ?')) return;
        await window.pywebview.api.disconnect_calendar();
        onMetaUpdate({ ...calendarMeta, connected: false, appleId: '' });
    };

    if (!calendarMeta?.connected) {
        return <CalendarSetup onConnected={(data) => onMetaUpdate(data.calendar)} />;
    }

    return (
        <div className="calendar">
            <div className="calendar__toolbar">
                <div className="calendar__nav">
                    <button
                        className="btn btn--ghost"
                        onClick={() => {
                            const d = new Date(cursor);
                            if (view === 'month') d.setMonth(d.getMonth() - 1);
                            else d.setDate(d.getDate() - 7);
                            setCursor(d);
                        }}
                    >
                        ←
                    </button>
                    <button
                        className="btn btn--ghost"
                        onClick={() => setCursor(new Date())}
                    >
                        Aujourd'hui
                    </button>
                    <button
                        className="btn btn--ghost"
                        onClick={() => {
                            const d = new Date(cursor);
                            if (view === 'month') d.setMonth(d.getMonth() + 1);
                            else d.setDate(d.getDate() + 7);
                            setCursor(d);
                        }}
                    >
                        →
                    </button>
                    <span className="calendar__title">
                        {view === 'month'
                            ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
                            : '7 prochains jours'}
                    </span>
                </div>
                <div className="calendar__actions">
                    <div className="calendar__view-switch">
                        <button
                            className={`btn btn--ghost ${view === 'week' ? 'btn--active' : ''}`}
                            onClick={() => setView('week')}
                        >
                            Semaine
                        </button>
                        <button
                            className={`btn btn--ghost ${view === 'month' ? 'btn--active' : ''}`}
                            onClick={() => setView('month')}
                        >
                            Mois
                        </button>
                    </div>
                    <button
                        className="btn btn--primary"
                        onClick={() => setEditing({ mode: 'create', defaults: { start: new Date().toISOString() } })}
                    >
                        + Événement
                    </button>
                    <button
                        className="btn btn--ghost"
                        onClick={refresh}
                        disabled={loading}
                        title="Rafraîchir"
                    >
                        ↻
                    </button>
                    <button
                        className="btn btn--ghost"
                        onClick={handleDisconnect}
                        title="Déconnecter iCloud"
                    >
                        Déconnecter
                    </button>
                </div>
            </div>

            <div className="calendar__account">
                <span>Connecté à <strong>{calendarMeta.appleId}</strong></span>
                {calendarMeta.availableCalendars?.length > 0 && (
                    <label className="calendar__target">
                        Nouveaux événements →
                        <select
                            className="select"
                            value={calendarMeta.calendarName || ''}
                            onChange={async (e) => {
                                const res = await window.pywebview.api.set_calendar_target(e.target.value);
                                if (res.ok) onMetaUpdate(res.data.calendar);
                            }}
                        >
                            {calendarMeta.availableCalendars.map((name, i) => (
                                <option key={`${name}-${i}`} value={name}>{name}</option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            {error && <div className="calendar__error">{error}</div>}
            {loading && <div className="calendar__loading">Chargement des événements…</div>}

            {view === 'week' ? (
                <WeekView events={events} onEventClick={(ev) => setEditing({ mode: 'edit', event: ev })} />
            ) : (
                <MonthView
                    cursor={cursor}
                    events={events}
                    onEventClick={(ev) => setEditing({ mode: 'edit', event: ev })}
                    onCellClick={(d) => {
                        const start = new Date(d);
                        start.setHours(9, 0, 0, 0);
                        const end = new Date(start);
                        end.setHours(10, 0, 0, 0);
                        setEditing({
                            mode: 'create',
                            defaults: {
                                start: start.toISOString(),
                                end: end.toISOString(),
                            },
                        });
                    }}
                />
            )}

            {editing && (
                <EventForm
                    initial={editing.mode === 'edit' ? editing.event : editing.defaults}
                    onSave={handleSave}
                    onCancel={() => setEditing(null)}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
};

window.Calendar = Calendar;
