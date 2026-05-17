/* global React */
/**
 * Calendar — Module Calendrier
 * Vue agenda groupée par jour. Permet l'ajout manuel d'événements et
 * l'import en masse via un fichier Excel (.xlsx) au format "Matrice
 * d'Import Calendrier". Les événements importés apparaissent dans la
 * même liste, comme s'ils étaient ajoutés manuellement.
 */
const CALENDARS = [
    { value: 'Travail',   label: 'Travail' },
    { value: 'personnel', label: 'Personnel' },
    { value: 'Famille',   label: 'Famille' },
];

const REMINDERS = [
    'aucun',
    "à l'heure de l'événement",
    '5min avant', '15min avant', '30 min avant',
    '1h avant', '1 jour avant',
];

const RECURRENCES = [
    'Jamais',
    'Tous les jours',
    'Toutes les semaines',
    'Toutes les 2 semaines',
    'Tous les mois',
    'Tous les ans',
];

const formatDay = (iso) => {
    if (!iso) return 'Sans date';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
};

const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString('fr-FR',
        { hour: '2-digit', minute: '2-digit' });
};

const dayKey = (iso) => {
    if (!iso) return '0000-00-00';
    return iso.slice(0, 10);
};

const calClass = (cal) => {
    const v = (cal || '').toLowerCase();
    if (v.startsWith('trav')) return 'event--work';
    if (v.startsWith('fam')) return 'event--family';
    return 'event--personal';
};

const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();

const occursOn = (ev, cellDate) => {
    /* Retourne true si l'event `ev` a une occurrence le jour `cellDate`,
       en tenant compte du champ `recurrence`. */
    if (!ev.start) return false;
    const startDate = new Date(ev.start);
    if (Number.isNaN(startDate.getTime())) return false;
    if (cellDate < new Date(startDate.getFullYear(),
                            startDate.getMonth(), startDate.getDate())) {
        return false;
    }
    const rec = ev.recurrence || 'Jamais';
    if (rec === 'Jamais') return sameDay(startDate, cellDate);

    if (rec === 'Tous les jours') return true;

    if (rec === 'Toutes les semaines'
        || rec === 'Toutes les 2 semaines') {
        const interval = rec === 'Toutes les 2 semaines' ? 14 : 7;
        const startMid = new Date(startDate.getFullYear(),
            startDate.getMonth(), startDate.getDate());
        const cellMid = new Date(cellDate.getFullYear(),
            cellDate.getMonth(), cellDate.getDate());
        const diffDays = Math.round(
            (cellMid - startMid) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays % interval === 0;
    }

    if (rec === 'Tous les mois') {
        return cellDate.getDate() === startDate.getDate();
    }

    if (rec === 'Tous les ans') {
        return cellDate.getDate() === startDate.getDate()
            && cellDate.getMonth() === startDate.getMonth();
    }

    return false;
};

const buildMonthGrid = (year, month) => {
    /* Retourne un tableau de 42 dates (6 semaines × 7 jours), semaine
       commençant le lundi, incluant les jours du mois précédent/suivant. */
    const first = new Date(year, month, 1);
    const dow = (first.getDay() + 6) % 7; // 0=lundi
    const start = new Date(year, month, 1 - dow);
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        cells.push(d);
    }
    return cells;
};

const startOfWeek = (d) => {
    /* Lundi 00:00 de la semaine contenant `d`. */
    const dow = (d.getDay() + 6) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
};

const Calendar = ({ events, onUpdate }) => {
    const [view, setView] = React.useState('month'); // 'month' | 'agenda'
    const [cursor, setCursor] = React.useState(() => {
        const t = new Date();
        return { year: t.getFullYear(), month: t.getMonth() };
    });
    const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
    const [showForm, setShowForm] = React.useState(false);
    const [importing, setImporting] = React.useState(false);
    const [importMsg, setImportMsg] = React.useState(null);
    const [draft, setDraft] = React.useState({
        calendar: 'Travail', title: '',
        start: '', end: '', location: '', reminder: 'aucun',
        recurrence: 'Jamais', description: '',
    });

    // ----- Sync iCloud -----
    const [showSync, setShowSync] = React.useState(false);
    const [icloud, setIcloud] = React.useState({
        configured: false, apple_id: '', calendar_name: 'Nathan Code List',
        last_sync: '',
    });
    const [creds, setCreds] = React.useState({
        apple_id: '', app_password: '', calendar_name: 'Nathan Code List',
    });
    const [syncing, setSyncing] = React.useState(false);
    const [syncMsg, setSyncMsg] = React.useState(null);

    const refreshIcloudStatus = React.useCallback(async () => {
        const s = await window.pywebview.api.get_icloud_status();
        setIcloud(s);
        setCreds((c) => ({
            ...c,
            apple_id: s.apple_id || c.apple_id,
            calendar_name: s.calendar_name || c.calendar_name,
        }));
    }, []);

    React.useEffect(() => { refreshIcloudStatus(); }, [refreshIcloudStatus]);

    const saveCreds = async () => {
        setSyncMsg(null);
        await window.pywebview.api.save_icloud_credentials(
            creds.apple_id, creds.app_password, creds.calendar_name);
        await refreshIcloudStatus();
        setSyncMsg({ type: 'success', text: 'Identifiants enregistrés.' });
    };

    const testConnection = async () => {
        setSyncing(true); setSyncMsg(null);
        try {
            const res = await window.pywebview.api.test_icloud_connection();
            if (res.ok) {
                setSyncMsg({
                    type: 'success',
                    text: `Connexion OK — ${res.calendars.length} calendrier(s) iCloud détecté(s).`,
                });
            } else {
                setSyncMsg({ type: 'error', text: res.error });
            }
        } finally { setSyncing(false); }
    };

    const pushToIcloud = async () => {
        setSyncing(true); setSyncMsg(null);
        try {
            const res = await window.pywebview.api.sync_to_icloud();
            if (res.ok) {
                if (res.data) onUpdate(res.data);
                const errLine = res.errors && res.errors.length
                    ? ` · ${res.errors.length} erreur(s).` : '';
                const scanned = res.calendars_scanned
                    ? ` Scannés : ${res.calendars_scanned.join(', ')}.`
                    : '';
                const delLine = res.deleted
                    ? ` · ✕ ${res.deleted} supprimé(s) sur iPhone`
                    : res.tombstones_processed
                        ? ' · ✕ aucune suppression effectuée (UIDs introuvables côté iCloud)'
                        : '';
                const delDetail = res.deleted_log && res.deleted_log.length
                    ? ` Détail suppressions : ${res.deleted_log.join(' | ')}.`
                    : '';
                setSyncMsg({
                    type: 'success',
                    text: `↑ ${res.pushed} poussé(s) · ↓ ${res.pulled} récupéré(s)${delLine}.${errLine}${scanned}${delDetail}`,
                });
                await refreshIcloudStatus();
            } else {
                setSyncMsg({ type: 'error', text: res.error });
            }
        } finally { setSyncing(false); }
    };

    // ----- Navigation Mois -----
    const monthLabel = `${MONTH_NAMES[cursor.month]} ${cursor.year}`;
    const goPrev = () => setCursor((c) => {
        const m = c.month - 1;
        return m < 0
            ? { year: c.year - 1, month: 11 }
            : { year: c.year, month: m };
    });
    const goNext = () => setCursor((c) => {
        const m = c.month + 1;
        return m > 11
            ? { year: c.year + 1, month: 0 }
            : { year: c.year, month: m };
    });
    const goToday = () => {
        const t = new Date();
        setCursor({ year: t.getFullYear(), month: t.getMonth() });
    };

    const monthCells = React.useMemo(
        () => buildMonthGrid(cursor.year, cursor.month),
        [cursor.year, cursor.month]);
    const todayKey = ymd(new Date());

    // ----- Navigation Semaine (vue Agenda) -----
    const weekCells = React.useMemo(() => {
        const cells = [];
        for (let i = 0; i < 7; i += 1) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            cells.push(d);
        }
        return cells;
    }, [weekStart]);

    const weekLabel = (() => {
        const start = weekCells[0];
        const end = weekCells[6];
        const sameMonth = start.getMonth() === end.getMonth();
        const sd = start.toLocaleDateString('fr-FR',
            { day: '2-digit', month: sameMonth ? undefined : 'short' });
        const ed = end.toLocaleDateString('fr-FR',
            { day: '2-digit', month: 'short', year: 'numeric' });
        return `${sd} – ${ed}`;
    })();

    const goPrevWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        setWeekStart(d);
    };
    const goNextWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        setWeekStart(d);
    };
    const goThisWeek = () => setWeekStart(startOfWeek(new Date()));

    // Index events par jour (clé YYYY-MM-DD), avec expansion des récurrences
    // sur les jours visibles du mois.
    const eventsByDay = React.useMemo(() => {
        const map = {};
        events.forEach((ev) => {
            if (!ev.recurrence || ev.recurrence === 'Jamais') {
                const k = dayKey(ev.start);
                (map[k] = map[k] || []).push(ev);
                return;
            }
            monthCells.forEach((d) => {
                if (occursOn(ev, d)) {
                    const k = ymd(d);
                    (map[k] = map[k] || []).push(ev);
                }
            });
        });
        Object.values(map).forEach((list) =>
            list.sort((a, b) => (a.start || '').localeCompare(b.start || '')));
        return map;
    }, [events, monthCells]);

    // Vue Agenda : strictement les 7 jours de la semaine cursor, avec
    // expansion des récurrences uniquement sur ces 7 jours.
    const eventsByWeekDay = React.useMemo(() => {
        const map = {};
        weekCells.forEach((d) => { map[ymd(d)] = []; });
        const weekStartKey = ymd(weekCells[0]);
        const weekEndKey = ymd(weekCells[6]);
        events.forEach((ev) => {
            if (!ev.recurrence || ev.recurrence === 'Jamais') {
                const k = dayKey(ev.start);
                if (k >= weekStartKey && k <= weekEndKey && map[k]) {
                    map[k].push(ev);
                }
                return;
            }
            weekCells.forEach((d) => {
                if (occursOn(ev, d)) map[ymd(d)].push(ev);
            });
        });
        Object.values(map).forEach((list) =>
            list.sort((a, b) => (a.start || '').localeCompare(b.start || '')));
        return map;
    }, [events, weekCells]);

    const handleImport = async (replaceExcel) => {
        setImporting(true);
        setImportMsg(null);
        try {
            const res = await window.pywebview.api.import_events_from_excel(
                Boolean(replaceExcel));
            if (res.cancelled) {
                setImportMsg(null);
            } else if (res.error) {
                setImportMsg({ type: 'error', text: res.error });
            } else {
                onUpdate(res.data);
                setImportMsg({
                    type: 'success',
                    text: `${res.imported} événement(s) importé(s).`,
                });
            }
        } catch (e) {
            setImportMsg({ type: 'error', text: String(e) });
        } finally {
            setImporting(false);
        }
    };

    const submitDraft = async (e) => {
        e.preventDefault();
        if (!draft.title.trim() || !draft.start) return;
        const data = await window.pywebview.api.add_event(draft);
        onUpdate(data);
        setDraft({
            calendar: 'Travail', title: '', start: '', end: '',
            location: '', reminder: 'aucun',
            recurrence: 'Jamais', description: '',
        });
        setShowForm(false);
    };

    const remove = async (id) => {
        const data = await window.pywebview.api.delete_event(id);
        onUpdate(data);
    };

    const clearImported = async () => {
        if (!window.confirm(
            'Supprimer tous les événements importés depuis Excel ?')) return;
        const data = await window.pywebview.api.clear_events('excel');
        onUpdate(data);
    };

    const sorted = [...events].sort((a, b) =>
        (a.start || '').localeCompare(b.start || ''));

    const grouped = sorted.reduce((acc, ev) => {
        const k = dayKey(ev.start);
        (acc[k] = acc[k] || []).push(ev);
        return acc;
    }, {});
    const dayKeys = Object.keys(grouped).sort();

    const importedCount = events.filter((e) => e.source === 'excel').length;

    return (
        <div className="calendar">
            <div className="calendar__toolbar">
                <button
                    className="btn btn--primary"
                    onClick={() => handleImport(false)}
                    disabled={importing}
                >
                    {importing ? 'Lecture…' : '⇪ Importer un fichier Excel'}
                </button>
                <button
                    className="btn btn--ghost"
                    onClick={() => handleImport(true)}
                    disabled={importing}
                    title="Remplace tous les événements précédemment importés"
                >
                    ⟲ Remplacer l'import précédent
                </button>
                <button
                    className="btn btn--ghost"
                    onClick={() => setShowForm((v) => !v)}
                >
                    {showForm ? 'Annuler' : '+ Ajouter manuellement'}
                </button>
                {importedCount > 0 && (
                    <button
                        className="btn btn--ghost btn--danger-soft"
                        onClick={clearImported}
                        title={`${importedCount} événement(s) importé(s)`}
                    >
                        ✕ Vider les imports Excel
                    </button>
                )}
                <button
                    className={`btn ${icloud.configured ? 'btn--ghost' : 'btn--primary'}`}
                    onClick={() => setShowSync((v) => !v)}
                    title={icloud.configured
                        ? `iCloud configuré (${icloud.apple_id})`
                        : 'Configurer la sync iCloud'}
                >
                    {icloud.configured ? '☁ iCloud' : '☁ Connecter iCloud'}
                </button>
                {icloud.configured && (
                    <button
                        className="btn btn--primary"
                        onClick={pushToIcloud}
                        disabled={syncing}
                        title="Pousse les events locaux et récupère ceux ajoutés sur iPhone"
                    >
                        {syncing ? 'Synchro…' : '⇅ Synchroniser iCloud'}
                    </button>
                )}
            </div>

            <div className="calendar__viewbar">
                <div className="calendar__view-toggle">
                    <button
                        className={`btn ${view === 'month' ? 'btn--primary' : 'btn--ghost'}`}
                        onClick={() => setView('month')}
                    >
                        Mois
                    </button>
                    <button
                        className={`btn ${view === 'agenda' ? 'btn--primary' : 'btn--ghost'}`}
                        onClick={() => setView('agenda')}
                    >
                        Agenda
                    </button>
                </div>
                {view === 'month' && (
                    <div className="calendar__nav">
                        <button className="btn btn--ghost" onClick={goPrev}>‹</button>
                        <button className="btn btn--ghost" onClick={goToday}>
                            Aujourd'hui
                        </button>
                        <button className="btn btn--ghost" onClick={goNext}>›</button>
                        <h3 className="calendar__month-title">{monthLabel}</h3>
                    </div>
                )}
                {view === 'agenda' && (
                    <div className="calendar__nav">
                        <button className="btn btn--ghost" onClick={goPrevWeek}>‹</button>
                        <button className="btn btn--ghost" onClick={goThisWeek}>
                            Cette semaine
                        </button>
                        <button className="btn btn--ghost" onClick={goNextWeek}>›</button>
                        <h3 className="calendar__month-title">{weekLabel}</h3>
                    </div>
                )}
            </div>

            {showSync && (
                <div className="calendar__form">
                    <h3 className="calendar__day-title">
                        Synchronisation iCloud
                    </h3>
                    <p className="event__desc">
                        Crée un mot de passe d'app sur{' '}
                        <strong>appleid.apple.com</strong> → Connexion et
                        sécurité → Mots de passe pour applications.
                        Les événements seront poussés vers un calendrier
                        iCloud dédié, visible dans Calendrier sur ton iPhone.
                    </p>
                    <div className="calendar__form-row">
                        <input
                            className="input"
                            placeholder="Apple ID (email)"
                            value={creds.apple_id}
                            onChange={(e) => setCreds({
                                ...creds, apple_id: e.target.value })}
                        />
                        <input
                            type="password"
                            className="input"
                            placeholder="Mot de passe d'app (xxxx-xxxx-xxxx-xxxx)"
                            value={creds.app_password}
                            onChange={(e) => setCreds({
                                ...creds, app_password: e.target.value })}
                        />
                    </div>
                    <input
                        className="input"
                        placeholder="Nom du calendrier iCloud cible"
                        value={creds.calendar_name}
                        onChange={(e) => setCreds({
                            ...creds, calendar_name: e.target.value })}
                    />
                    <div className="calendar__toolbar">
                        <button
                            className="btn btn--primary"
                            onClick={saveCreds}
                        >
                            Enregistrer
                        </button>
                        <button
                            className="btn btn--ghost"
                            onClick={testConnection}
                            disabled={syncing || !icloud.configured}
                        >
                            Tester la connexion
                        </button>
                        {icloud.last_sync && (
                            <small className="event__meta">
                                Dernière synchro : {icloud.last_sync}
                            </small>
                        )}
                    </div>
                    {syncMsg && (
                        <div className={`calendar__msg calendar__msg--${syncMsg.type}`}>
                            {syncMsg.text}
                        </div>
                    )}
                </div>
            )}

            {importMsg && (
                <div className={`calendar__msg calendar__msg--${importMsg.type}`}>
                    {importMsg.text}
                </div>
            )}

            {showForm && (
                <form className="calendar__form" onSubmit={submitDraft}>
                    <div className="calendar__form-row">
                        <select
                            className="select"
                            value={draft.calendar}
                            onChange={(e) => setDraft({
                                ...draft, calendar: e.target.value })}
                        >
                            {CALENDARS.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <input
                            className="input"
                            placeholder="Titre de l'événement"
                            value={draft.title}
                            onChange={(e) => setDraft({
                                ...draft, title: e.target.value })}
                        />
                    </div>
                    <div className="calendar__form-row">
                        <input
                            type="datetime-local"
                            className="input"
                            value={draft.start}
                            onChange={(e) => setDraft({
                                ...draft, start: e.target.value })}
                        />
                        <input
                            type="datetime-local"
                            className="input"
                            value={draft.end}
                            onChange={(e) => setDraft({
                                ...draft, end: e.target.value })}
                        />
                    </div>
                    <div className="calendar__form-row">
                        <input
                            className="input"
                            placeholder="Lieu"
                            value={draft.location}
                            onChange={(e) => setDraft({
                                ...draft, location: e.target.value })}
                        />
                        <select
                            className="select"
                            value={draft.reminder}
                            onChange={(e) => setDraft({
                                ...draft, reminder: e.target.value })}
                        >
                            {REMINDERS.map((r) => (
                                <option key={r} value={r}>
                                    Alerte : {r}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="calendar__form-row">
                        <select
                            className="select"
                            value={draft.recurrence}
                            onChange={(e) => setDraft({
                                ...draft, recurrence: e.target.value })}
                        >
                            {RECURRENCES.map((r) => (
                                <option key={r} value={r}>
                                    Récurrence : {r}
                                </option>
                            ))}
                        </select>
                        <span />
                    </div>
                    <textarea
                        className="input calendar__textarea"
                        placeholder="Description (optionnel)"
                        value={draft.description}
                        onChange={(e) => setDraft({
                            ...draft, description: e.target.value })}
                    />
                    <button type="submit" className="btn btn--primary">
                        Ajouter l'événement
                    </button>
                </form>
            )}

            <div className="section-title">
                <h2>{view === 'month' ? monthLabel : `Semaine du ${weekLabel}`}</h2>
                <small>{events.length} événement(s) au total</small>
            </div>

            {view === 'month' && (
                <div className="calendar-month">
                    <div className="calendar-month__weekdays">
                        {WEEKDAYS.map((w) => (
                            <div key={w} className="calendar-month__weekday">
                                {w}
                            </div>
                        ))}
                    </div>
                    <div className="calendar-month__grid">
                        {monthCells.map((d) => {
                            const key = ymd(d);
                            const dayEvents = eventsByDay[key] || [];
                            const inMonth = d.getMonth() === cursor.month;
                            const isToday = key === todayKey;
                            return (
                                <div
                                    key={key}
                                    className={`calendar-month__cell ${inMonth ? '' : 'calendar-month__cell--muted'} ${isToday ? 'calendar-month__cell--today' : ''}`}
                                >
                                    <div className="calendar-month__day-num">
                                        {d.getDate()}
                                    </div>
                                    <div className="calendar-month__chips">
                                        {dayEvents.slice(0, 3).map((ev) => (
                                            <div
                                                key={ev.id}
                                                className={`calendar-month__chip ${calClass(ev.calendar)}`}
                                                title={`${formatTime(ev.start)} ${ev.title}`}
                                            >
                                                <span className="calendar-month__chip-time">
                                                    {formatTime(ev.start)}
                                                </span>
                                                <span className="calendar-month__chip-title">
                                                    {ev.title}
                                                </span>
                                            </div>
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <div className="calendar-month__more">
                                                + {dayEvents.length - 3} autre(s)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {view === 'agenda' && (
                <div className="calendar__list">
                    {weekCells.map((d) => {
                        const k = ymd(d);
                        const dayEvents = eventsByWeekDay[k] || [];
                        const isToday = k === todayKey;
                        return (
                        <div key={k} className={`calendar__day ${isToday ? 'calendar__day--today' : ''}`}>
                            <h3 className="calendar__day-title">
                                {d.toLocaleDateString('fr-FR', {
                                    weekday: 'long', day: '2-digit',
                                    month: 'long',
                                })}
                                {dayEvents.length === 0 && (
                                    <span className="calendar__day-empty">
                                        — rien de prévu
                                    </span>
                                )}
                            </h3>
                            {dayEvents.map((ev) => (
                                <div
                                    key={ev.id}
                                    className={`event ${calClass(ev.calendar)}`}
                                >
                                    <div className="event__time">
                                        <span>{formatTime(ev.start)}</span>
                                        <span className="event__time-sep">→</span>
                                        <span>{formatTime(ev.end)}</span>
                                    </div>
                                    <div className="event__body">
                                        <div className="event__head">
                                            <span className="event__title">
                                                {ev.title}
                                            </span>
                                            <span className="event__cal">
                                                {ev.calendar}
                                            </span>
                                            {ev.source === 'excel' && (
                                                <span className="event__tag">
                                                    Excel
                                                </span>
                                            )}
                                        </div>
                                        <div className="event__meta">
                                            {ev.location && (
                                                <span>⚲ {ev.location}</span>
                                            )}
                                            {ev.reminder
                                                && ev.reminder !== 'aucun' && (
                                                <span>⏰ {ev.reminder}</span>
                                            )}
                                            {ev.recurrence
                                                && ev.recurrence !== 'Jamais' && (
                                                <span>↻ {ev.recurrence}</span>
                                            )}
                                        </div>
                                        {ev.description && (
                                            <p className="event__desc">
                                                {ev.description}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        className="btn btn--icon btn--danger"
                                        onClick={() => remove(ev.id)}
                                        title="Supprimer"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

window.Calendar = Calendar;
