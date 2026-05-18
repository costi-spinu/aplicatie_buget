import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const STORAGE_KEY = "realizari_targets_by_month_v1";

const categoryLabelMap = {
    alimente: "🍎 Alimente",
    sanatate: "🏥 Sănătate",
    transport: "🚗 Transport",
    cultura: "🎭 Cultură",
    shopping: "🛍 Shopping",
    neprevazute: "⚠️ Neprevăzute",
    animalute: "🐾 Animăluțe",
    vacanta: "✈️ Vacanță",
    divertisment: "🍽 Ieșiri / Restaurante / Diverse",
    investitii: "📈 Investiții",
};

const categoryKeys = Object.keys(categoryLabelMap);

const getMonthKey = (value) => {
    const date = value ? new Date(value) : new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const toUiCategory = (cat) => (cat === "auto" ? "transport" : cat);
const buildEmptyCategoryTargets = () => categoryKeys.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
const normalizeCategoryTargets = (values = {}) => categoryKeys.reduce((acc, key) => ({ ...acc, [key]: Number(values[key] || 0) || 0 }), {});
const sumValues = (obj) => Object.values(obj || {}).reduce((acc, value) => acc + Number(value || 0), 0);
const computeProgress = (actual, target) => (!target || target <= 0 ? 0 : Math.round((actual / target) * 100));

export default function Realizari() {
    const [activeTab, setActiveTab] = useState("curent");
    const [monthKey, setMonthKey] = useState(getMonthKey());
    const [fixedTargetInput, setFixedTargetInput] = useState("");
    const [categoryTargetInputs, setCategoryTargetInputs] = useState(buildEmptyCategoryTargets());
    const [targetsByMonth, setTargetsByMonth] = useState({});
    const [fixe, setFixe] = useState([]);
    const [variabile, setVariabile] = useState([]);
    const [msg, setMsg] = useState("");

    const currentMonthKey = getMonthKey();

    const normalizeApiTargets = (items = []) => items.reduce((acc, item) => {
        acc[item.luna] = {
            id: item.id,
            fixedTarget: Number(item.fixed_target || 0),
            categoryTargets: item.category_targets || {},
            updatedAt: item.updated_at,
        };
        return acc;
    }, {});

    const migrateLocalTargets = async (remoteTargets) => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return remoteTargets;

        try {
            const localTargets = JSON.parse(raw) || {};
            const missingEntries = Object.entries(localTargets).filter(([key]) => !remoteTargets[key]);
            if (missingEntries.length === 0) return remoteTargets;

            await Promise.all(missingEntries.map(([luna, target]) => api.post("realizari-targets/", {
                luna,
                fixed_target: Number(target.fixedTarget || 0),
                category_targets: target.categoryTargets || {},
            })));

            localStorage.removeItem(STORAGE_KEY);
            const res = await api.get("realizari-targets/");
            return normalizeApiTargets(res.data || []);
        } catch (error) {
            console.warn("Migrarea țintelor locale a eșuat:", error);
            return remoteTargets;
        }
    };

    const loadTargets = async () => {
        const res = await api.get("realizari-targets/");
        const remoteTargets = normalizeApiTargets(res.data || []);
        setTargetsByMonth(await migrateLocalTargets(remoteTargets));
    };

    const loadExpenses = async () => {
        const [f, v] = await Promise.all([api.get("cheltuieli-fixe/"), api.get("cheltuieli-variabile/")]);
        setFixe(f.data || []);
        setVariabile(v.data || []);
    };

    useEffect(() => {
        Promise.all([loadTargets(), loadExpenses()]).catch(() => setMsg("❌ Eroare la încărcarea datelor"));
    }, []);

    const actualByMonth = useMemo(() => {
        const fixed = {};
        const variableByCategory = {};

        fixe.forEach((item) => {
            const key = getMonthKey(item.data);
            fixed[key] = (fixed[key] || 0) + Number(item.suma || 0);
        });

        variabile.filter((item) => item.categorie !== "vacanta_cheltuita").forEach((item) => {
            const key = getMonthKey(item.data);
            const category = toUiCategory(item.categorie || "neprevazute");
            variableByCategory[key] = variableByCategory[key] || {};
            variableByCategory[key][category] = (variableByCategory[key][category] || 0) + Number(item.suma || 0);
        });

        return { fixed, variableByCategory };
    }, [fixe, variabile]);

    const monthTarget = targetsByMonth[monthKey] || null;

    useEffect(() => {
        if (!monthTarget) {
            setFixedTargetInput("");
            setCategoryTargetInputs(buildEmptyCategoryTargets());
            return;
        }

        setFixedTargetInput(String(monthTarget.fixedTarget || ""));
        setCategoryTargetInputs(categoryKeys.reduce((acc, key) => ({
            ...acc,
            [key]: monthTarget.categoryTargets?.[key] ? String(monthTarget.categoryTargets[key]) : "",
        }), {}));
    }, [monthKey, monthTarget]);

    const buildMonthSummary = (key) => {
        const target = targetsByMonth[key];
        if (!target) return null;

        const variableTargets = normalizeCategoryTargets(target.categoryTargets);
        const variableActuals = normalizeCategoryTargets(actualByMonth.variableByCategory[key]);
        const fixedActual = Number(actualByMonth.fixed[key] || 0);
        const fixedTarget = Number(target.fixedTarget || 0);
        const totalVariableTarget = sumValues(variableTargets);
        const totalVariableActual = sumValues(variableActuals);
        const totalTarget = fixedTarget + totalVariableTarget;
        const totalActual = fixedActual + totalVariableActual;

        return { key, fixedActual, fixedTarget, variableTargets, variableActuals, totalTarget, totalActual, totalProgress: computeProgress(totalActual, totalTarget) };
    };

    const currentSummary = buildMonthSummary(currentMonthKey);
    const historySummaries = Object.keys(targetsByMonth).filter((key) => key !== currentMonthKey).sort((a, b) => b.localeCompare(a)).map(buildMonthSummary).filter(Boolean);

    const saveMonthTarget = async () => {
        const categoryTargets = categoryKeys.reduce((acc, key) => ({ ...acc, [key]: Number(categoryTargetInputs[key] || 0) }), {});
        try {
            await api.post("realizari-targets/", {
                luna: monthKey,
                fixed_target: Number(fixedTargetInput || 0),
                category_targets: categoryTargets,
            });
            await loadTargets();
            setMsg("✔ Țintele lunare au fost salvate pe server și vor apărea pe toate dispozitivele.");
        } catch {
            setMsg("❌ Eroare la salvarea țintelor");
        }
    };

    const deleteMonthTarget = async (key) => {
        if (!window.confirm("Sigur vrei să ștergi această țintă lunară?")) return;
        try {
            await api.delete(`realizari-targets/${targetsByMonth[key].id}/`);
            await loadTargets();
            if (key === monthKey) {
                setFixedTargetInput("");
                setCategoryTargetInputs(buildEmptyCategoryTargets());
            }
        } catch {
            setMsg("❌ Eroare la ștergere");
        }
    };

    const renderProgressBar = (actual, target) => {
        const progress = computeProgress(actual, target);
        return <div style={localStyles.progressWrapper}><div style={{ ...localStyles.progressFill, width: `${Math.min(progress, 100)}%`, background: progress > 100 ? "#FF3B30" : "#34C759" }} /></div>;
    };

    const renderSummaryCard = (summary, showActions = false) => {
        const totalRemaining = summary.totalTarget - summary.totalActual;
        return (
            <div key={summary.key} style={styles.card}>
                <div style={localStyles.cardHeader}>
                    <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>📅 {summary.key}</h3>
                    {showActions && <button style={localStyles.deleteBtn} onClick={() => deleteMonthTarget(summary.key)}>Șterge</button>}
                </div>
                <div style={localStyles.rowBetween}><span>Țintă totală</span><strong>{summary.totalTarget.toFixed(2)} EUR</strong></div>
                <div style={localStyles.rowBetween}><span>Cheltuit total</span><strong>{summary.totalActual.toFixed(2)} EUR</strong></div>
                {renderProgressBar(summary.totalActual, summary.totalTarget)}
                <div style={localStyles.caption}>{summary.totalProgress}% din țintă • {totalRemaining >= 0 ? "rămași" : "depășiți"}: {Math.abs(totalRemaining).toFixed(2)} EUR</div>
                <div style={localStyles.block}>
                    <div style={localStyles.rowBetween}><span>🏠 Fixe</span><strong>{summary.fixedActual.toFixed(2)} / {summary.fixedTarget.toFixed(2)} EUR</strong></div>
                    {renderProgressBar(summary.fixedActual, summary.fixedTarget)}
                </div>
                <div style={localStyles.block}>
                    <div style={{ ...styles.date, marginBottom: 8 }}>Cheltuieli variabile (subcategorii)</div>
                    {categoryKeys.map((category) => {
                        const actual = Number(summary.variableActuals[category] || 0);
                        const target = Number(summary.variableTargets[category] || 0);
                        const progress = computeProgress(actual, target);
                        return <div key={`${summary.key}-${category}`} style={localStyles.subRow}>
                            <div style={localStyles.rowBetween}><span>{categoryLabelMap[category]}</span><span style={localStyles.smallValue}>{actual.toFixed(2)} / {target.toFixed(2)} EUR</span></div>
                            <div style={localStyles.subProgressTrack}><div style={{ ...localStyles.subProgressFill, width: `${Math.min(progress, 100)}%`, background: progress > 100 ? "#FF3B30" : "#0A84FF" }} /></div>
                        </div>;
                    })}
                </div>
            </div>
        );
    };

    const renderTargetForm = (title) => <div style={styles.card}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        <input type="month" style={styles.input} value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
        <input style={styles.input} type="number" min="0" placeholder="Țintă totală cheltuieli fixe" value={fixedTargetInput} onChange={(e) => setFixedTargetInput(e.target.value)} />
        {categoryKeys.map((key) => <div key={key} style={localStyles.inputRow}>
            <label style={localStyles.inputLabel}>{categoryLabelMap[key]}</label>
            <input style={localStyles.smallInput} type="number" min="0" placeholder="0" value={categoryTargetInputs[key]} onChange={(e) => setCategoryTargetInputs((prev) => ({ ...prev, [key]: e.target.value }))} />
        </div>)}
        <button style={styles.blueButton} onClick={saveMonthTarget}>💾 Salvează pe server</button>
        {targetsByMonth[monthKey] && <button style={localStyles.deleteMonthBtn} onClick={() => deleteMonthTarget(monthKey)}>🗑 Șterge luna selectată</button>}
    </div>;

    return <div style={styles.container}>
        <div style={styles.card}>
            <h2 style={styles.title}>🎯 Realizări</h2>
            {msg && <div style={styles.message}>{msg}</div>}
            <div style={localStyles.tabWrap}>
                <button onClick={() => { setActiveTab("curent"); setMonthKey(currentMonthKey); }} style={{ ...localStyles.tabBtn, ...(activeTab === "curent" ? localStyles.tabBtnActive : {}) }}>Luna curentă</button>
                <button onClick={() => setActiveTab("istoric")} style={{ ...localStyles.tabBtn, ...(activeTab === "istoric" ? localStyles.tabBtnActive : {}) }}>Istoric</button>
            </div>
            {activeTab === "curent" && <>{renderTargetForm(`Setează țintele pentru ${currentMonthKey}`)}{!currentSummary && <div style={styles.message}>Nu există încă ținte salvate pentru luna curentă.</div>}{currentSummary && renderSummaryCard(currentSummary)}</>}
            {activeTab === "istoric" && <>{renderTargetForm("Administrare ținte lunare")}{historySummaries.length === 0 && <div style={styles.message}>Nu există încă luni în istoric.</div>}{historySummaries.map((summary) => renderSummaryCard(summary, true))}</>}
        </div>
    </div>;
}

const localStyles = {
    tabWrap: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
    tabBtn: { border: "1px solid #E5E5EA", borderRadius: 12, padding: "10px 12px", background: "#fff", fontWeight: 600, cursor: "pointer" },
    tabBtnActive: { background: "#E5F0FF", color: "#0A84FF", borderColor: "#C7DDFF" },
    inputRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
    inputLabel: { fontSize: 14, color: "#1C1C1E" },
    smallInput: { width: 130, padding: "8px 10px", borderRadius: 10, border: "1px solid #E5E5EA", background: "#F9F9FB" },
    progressWrapper: { width: "100%", height: 10, background: "#E5E5EA", borderRadius: 999, overflow: "hidden", marginTop: 8, marginBottom: 8 },
    progressFill: { height: "100%", borderRadius: 999 },
    caption: { fontSize: 13, color: "#636366", marginBottom: 12 },
    rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, marginBottom: 6 },
    block: { marginTop: 12, paddingTop: 10, borderTop: "1px solid #F0F0F5" },
    subRow: { marginBottom: 8 },
    smallValue: { fontSize: 12, color: "#636366" },
    subProgressTrack: { marginTop: 4, width: "100%", height: 6, background: "#E5E5EA", borderRadius: 999, overflow: "hidden" },
    subProgressFill: { height: "100%", borderRadius: 999 },
    deleteMonthBtn: { width: "95%", marginTop: 10, padding: "10px 14px", borderRadius: 12, border: "none", background: "#FFE5E5", color: "#FF3B30", fontWeight: 600, cursor: "pointer" },
    cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    deleteBtn: { border: "none", background: "transparent", color: "#FF3B30", fontWeight: 600, cursor: "pointer" },
};
