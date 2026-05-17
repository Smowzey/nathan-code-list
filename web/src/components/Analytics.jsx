/* global React, Recharts */
/**
 * Analytics — Dashboard freelance
 *  - Funnel de prospection (Recharts BarChart horizontal)
 *  - Jauges de productivité (Recharts RadialBarChart)
 *  - KPI editables (envoyés à Python)
 */
const {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    RadialBarChart, RadialBar, PolarAngleAxis,
} = Recharts;

const STAGE_KEYS = [
    { key: 'sent',      label: 'Contacts envoyés', color: '#4A9CA8' },
    { key: 'viewed',    label: 'Vus',              color: '#2E7A85' },
    { key: 'responses', label: 'Réponses',         color: '#1A535C' },
    { key: 'meetings',  label: 'RDV fixés',        color: '#0F2F33' },
];

const ProspectionEditor = ({ prospection, onChange }) => (
    <div className="funnel-actions">
        {STAGE_KEYS.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--color-text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {s.label}
                </span>
                <button className="btn btn--ghost" onClick={() => onChange(s.key, -1)}>−</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
                    {prospection[s.key]}
                </span>
                <button className="btn btn--ghost" onClick={() => onChange(s.key, +1)}>+</button>
            </div>
        ))}
    </div>
);

const Funnel = ({ prospection }) => {
    const data = STAGE_KEYS.map((s) => ({
        name:  s.label,
        value: prospection[s.key] || 0,
        color: s.color,
    }));

    const conversion = prospection.sent > 0
        ? Math.round((prospection.meetings / prospection.sent) * 100)
        : 0;

    return (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="section-title">
                <h2>Funnel de prospection</h2>
                <small>Taux de conversion global : {conversion}%</small>
            </div>
            <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                        <XAxis type="number" stroke="#1A535C" tick={{ fill: '#1A535C', fontSize: 12 }} />
                        <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#050505"
                            width={140}
                            tick={{ fill: '#050505', fontSize: 12 }}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(26,83,92,0.08)' }}
                            contentStyle={{
                                background: '#FFFFFF',
                                border: '1px solid rgba(26,83,92,0.3)',
                                borderRadius: 8,
                                color: '#050505',
                                boxShadow: '0 4px 16px rgba(26,83,92,0.15)',
                            }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                            {data.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const Gauge = ({ label, value, goal, color, onGoalChange }) => {
    const pct = Math.min(100, goal > 0 ? Math.round((value / goal) * 100) : 0);
    const data = [{ name: label, value: pct, fill: color }];

    const fmt = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h > 0 ? `${h}h ${String(m).padStart(2, '0')}` : `${m}m`;
    };

    return (
        <div className="card">
            <div className="gauge">
                <div className="gauge__chart">
                    <ResponsiveContainer>
                        <RadialBarChart
                            innerRadius="70%"
                            outerRadius="100%"
                            data={data}
                            startAngle={90}
                            endAngle={-270}
                        >
                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                            <RadialBar background={{ fill: 'rgba(26,83,92,0.10)' }} dataKey="value" cornerRadius={20} />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>
                <div className="gauge__info">
                    <span className="gauge__label">{label}</span>
                    <span className="gauge__value">{fmt(value)}</span>
                    <span className="gauge__goal">{pct}% de l'objectif ({fmt(goal)})</span>
                    <div className="kpi__editor">
                        <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Objectif (h)</span>
                        <input
                            type="number"
                            min="1"
                            max="16"
                            step="0.5"
                            value={(goal / 3600).toString()}
                            onChange={(e) => onGoalChange(Math.round(parseFloat(e.target.value || '0') * 3600))}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const Analytics = ({ prospection, productivity, onUpdate }) => {
    const stepProspection = async (key, delta) => {
        const next = Math.max(0, (prospection[key] || 0) + delta);
        const data = await window.pywebview.api.update_prospection({ [key]: next });
        onUpdate(data);
    };

    const updateGoal = async (key, seconds) => {
        const patch = {};
        patch[key] = Math.max(0, seconds);
        // mutation directe via save_data
        const full = await window.pywebview.api.get_data();
        full.productivity = { ...full.productivity, ...patch };
        const data = await window.pywebview.api.save_data(full);
        onUpdate(data);
    };

    const addProspectTime = async (delta) => {
        const data = await window.pywebview.api.add_prospection_time(delta);
        onUpdate(data);
    };

    return (
        <div className="analytics">
            <div className="analytics__row">
                {STAGE_KEYS.map((s) => (
                    <div className="kpi" key={s.key}>
                        <div className="kpi__label">{s.label}</div>
                        <div className="kpi__value">{prospection[s.key] || 0}</div>
                        <div className="kpi__editor">
                            <button className="btn btn--ghost" onClick={() => stepProspection(s.key, -1)}>−</button>
                            <button className="btn btn--ghost" onClick={() => stepProspection(s.key, +1)}>+</button>
                        </div>
                    </div>
                ))}
            </div>

            <Funnel prospection={prospection} />

            <Gauge
                label="Temps de code aujourd'hui"
                value={productivity.codeTime || 0}
                goal={productivity.dailyGoalCode || 14400}
                color="#1A535C"
                onGoalChange={(s) => updateGoal('dailyGoalCode', s)}
            />
            <div className="card">
                <div className="gauge">
                    <div className="gauge__chart">
                        <ResponsiveContainer>
                            <RadialBarChart
                                innerRadius="70%"
                                outerRadius="100%"
                                data={[{
                                    name: 'prosp',
                                    value: Math.min(100, productivity.dailyGoalProspection > 0
                                        ? Math.round((productivity.prospectionTime / productivity.dailyGoalProspection) * 100)
                                        : 0),
                                    fill: '#2E7A85',
                                }]}
                                startAngle={90}
                                endAngle={-270}
                            >
                                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                <RadialBar background={{ fill: 'rgba(26,83,92,0.10)' }} dataKey="value" cornerRadius={20} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="gauge__info">
                        <span className="gauge__label">Temps de prospection</span>
                        <span className="gauge__value">
                            {(() => {
                                const sec = productivity.prospectionTime || 0;
                                const h = Math.floor(sec / 3600);
                                const m = Math.floor((sec % 3600) / 60);
                                return h > 0 ? `${h}h ${String(m).padStart(2, '0')}` : `${m}m`;
                            })()}
                        </span>
                        <span className="gauge__goal">
                            Objectif : {Math.round((productivity.dailyGoalProspection || 0) / 60)} min
                        </span>
                        <div className="kpi__editor">
                            <button className="btn btn--ghost" onClick={() => addProspectTime(-15 * 60)}>−15 min</button>
                            <button className="btn btn--ghost" onClick={() => addProspectTime(-30 * 60)}>−30 min</button>
                            <button className="btn btn--ghost" onClick={() => addProspectTime(15 * 60)}>+15 min</button>
                            <button className="btn btn--ghost" onClick={() => addProspectTime(30 * 60)}>+30 min</button>
                            <input
                                type="number"
                                min="0.25"
                                max="8"
                                step="0.25"
                                value={(productivity.dailyGoalProspection / 3600).toString()}
                                onChange={(e) => updateGoal('dailyGoalProspection', Math.round(parseFloat(e.target.value || '0') * 3600))}
                                title="Objectif (h)"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

window.Analytics = Analytics;
