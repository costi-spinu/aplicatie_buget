import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const emptySchedule = { zi: "", suma: "", moneda: "RON", activ: true };

export default function ProfilUtilizator() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [bridgeRequests, setBridgeRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [emailForm, setEmailForm] = useState({ new_email: "", password: "", code: "" });
    const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", confirm_password: "" });
    const [statusRows, setStatusRows] = useState([]);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        try {
            await Promise.all([loadProfile(), loadUsers(), loadBridgeRequests(), loadIncomeHistory()]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadProfile = async () => {
        const res = await api.get("profile/");
        setUser({ id: res.data.id, username: res.data.username, email: res.data.email });
        setProfile({
            ...(res.data.profile || {}),
            salary_schedules: res.data.profile?.salary_schedules?.length ? res.data.profile.salary_schedules : [{ ...emptySchedule }],
        });
    };

    const loadUsers = async () => {
        const res = await api.get("users/list/");
        setAllUsers(res.data);
    };

    const loadBridgeRequests = async () => {
        const res = await api.get("bridge/requests/");
        setBridgeRequests(res.data);
    };

    const loadIncomeHistory = async () => {
        const res = await api.get("venit/status/");
        const labels = [...res.data.labels].reverse();
        const dataValues = [...res.data.data].reverse();
        setStatusRows(labels.map((label, idx) => ({ label, value: Number(dataValues[idx]) })));
    };

    const updateProfileField = (field, value) => setProfile((prev) => ({ ...prev, [field]: value }));

    const updateSchedule = (index, field, value) => {
        setProfile((prev) => ({
            ...prev,
            salary_schedules: prev.salary_schedules.map((item, idx) => idx === index ? { ...item, [field]: value } : item),
        }));
    };

    const addSchedule = () => setProfile((prev) => ({ ...prev, salary_schedules: [...prev.salary_schedules, { ...emptySchedule }] }));
    const removeSchedule = (index) => setProfile((prev) => ({ ...prev, salary_schedules: prev.salary_schedules.filter((_, idx) => idx !== index) }));

    const handlePhoto = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => updateProfileField("poza", reader.result);
        reader.readAsDataURL(file);
    };

    const updateProfile = async () => {
        try {
            const schedules = (profile.salary_schedules || [])
                .filter((item) => item.zi && item.suma)
                .map((item) => ({ ...item, zi: Number(item.zi), suma: Number(item.suma), activ: item.activ !== false }));

            const payload = {
                username: user.username,
                profile: {
                    poza: profile.poza || "",
                    data_nasterii: profile.data_nasterii || null,
                    ocupatia: profile.ocupatia || "",
                    venit_estimat: profile.venit_estimat || null,
                    venit_estimat_lunar: profile.venit_estimat_lunar || null,
                    salary_schedules: schedules,
                },
            };
            const res = await api.put("profile/", payload);
            setUser({ id: res.data.id, username: res.data.username, email: res.data.email });
            setProfile({ ...res.data.profile, salary_schedules: res.data.profile.salary_schedules.length ? res.data.profile.salary_schedules : [{ ...emptySchedule }] });
            await loadIncomeHistory();
            setMsg("✔ Profil actualizat. Datele de salariu au fost sincronizate în tabul Venit.");
        } catch {
            setMsg("❌ Eroare la actualizarea profilului");
        }
    };

    const requestEmailChange = async () => {
        try {
            await api.post("email-change/request/", emailForm);
            setMsg("✔ Am trimis linkul/codul de confirmare pe noua adresă de email.");
        } catch {
            setMsg("❌ Nu s-a putut trimite confirmarea pentru email. Verifică parola și adresa.");
        }
    };

    const confirmEmailChange = async () => {
        try {
            const res = await api.post("email-change/confirm/", { code: emailForm.code });
            setUser((prev) => ({ ...prev, email: res.data.email }));
            setEmailForm({ new_email: "", password: "", code: "" });
            setMsg("✔ Email modificat cu succes.");
        } catch {
            setMsg("❌ Cod invalid sau deja folosit.");
        }
    };

    const changePassword = async () => {
        try {
            await api.post("profile/password/", passwordForm);
            setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
            setMsg("✔ Parola a fost schimbată.");
        } catch {
            setMsg("❌ Nu s-a putut schimba parola. Verifică parola veche și repetarea parolei noi.");
        }
    };

    const deleteUser = async () => {
        if (!window.confirm("Sigur ștergi contul?")) return;
        try {
            await api.delete(`admin/users/${user.id}/delete/`);
            logout();
        } catch {
            setMsg("❌ Eroare la ștergere");
        }
    };

    const sendBridge = async () => {
        if (!selectedUser) return;
        try {
            await api.post("bridge/send/", { user_id: selectedUser });
            setMsg("✔ Cerere trimisă");
        } catch {
            setMsg("❌ Eroare la trimitere");
        }
    };

    const acceptBridge = async (id) => {
        try {
            await api.post(`bridge/accept/${id}/`);
            await loadBridgeRequests();
            setMsg("✔ Bridge acceptat");
        } catch {
            setMsg("❌ Eroare la acceptare");
        }
    };

    const logout = () => {
        localStorage.clear();
        window.location.reload();
    };

    if (loading || !user || !profile) return <div>Loading...</div>;

    const totalGeneralStatus = statusRows.reduce((acc, row) => acc + row.value, 0);

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>👤 Profil utilizator</h2>
                {msg && <div style={styles.message}>{msg}</div>}

                <h3 style={styles.sectionTitle}>Date cont și profil</h3>
                {profile.poza && <img src={profile.poza} alt="Profil" style={localStyles.avatar} />}
                <input style={styles.input} type="file" accept="image/*" onChange={handlePhoto} />
                <input style={styles.input} value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} placeholder="Username" />
                <input style={styles.input} value={user.email} disabled placeholder="Email curent" />
                <input style={styles.input} type="date" value={profile.data_nasterii || ""} onChange={(e) => updateProfileField("data_nasterii", e.target.value)} />
                <input style={styles.input} value={profile.ocupatia || ""} onChange={(e) => updateProfileField("ocupatia", e.target.value)} placeholder="Ocupația" />
                <input style={styles.input} type="number" value={profile.venit_estimat || ""} onChange={(e) => updateProfileField("venit_estimat", e.target.value)} placeholder="Venit estimat" />
                <input style={styles.input} type="number" value={profile.venit_estimat_lunar || ""} onChange={(e) => updateProfileField("venit_estimat_lunar", e.target.value)} placeholder="Venit estimat lunar" />

                <h3 style={styles.sectionTitle}>Date salariu (pot fi mai multe)</h3>
                {profile.salary_schedules.map((item, index) => (
                    <div key={index} style={localStyles.scheduleRow}>
                        <input style={localStyles.smallInput} type="number" min="1" max="31" value={item.zi} onChange={(e) => updateSchedule(index, "zi", e.target.value)} placeholder="Ziua" />
                        <input style={localStyles.smallInput} type="number" value={item.suma} onChange={(e) => updateSchedule(index, "suma", e.target.value)} placeholder="Sumă" />
                        <select style={localStyles.smallInput} value={item.moneda} onChange={(e) => updateSchedule(index, "moneda", e.target.value)}>
                            <option value="RON">RON / LEI</option>
                            <option value="EUR">EUR</option>
                        </select>
                        <button style={localStyles.iconButton} onClick={() => removeSchedule(index)}>−</button>
                    </div>
                ))}
                <button style={styles.greenButton} onClick={addSchedule}>＋ Adaugă dată salariu</button>
                <button style={styles.blueButton} onClick={updateProfile}>💾 Salvează profil</button>
            </div>

            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>Schimbare email</h3>
                <input style={styles.input} type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({ ...emailForm, new_email: e.target.value })} placeholder="Email nou" />
                <input style={styles.input} type="password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} placeholder="Parola curentă" />
                <button style={styles.blueButton} onClick={requestEmailChange}>Trimite link/cod de confirmare</button>
                <input style={styles.input} value={emailForm.code} onChange={(e) => setEmailForm({ ...emailForm, code: e.target.value })} placeholder="Cod primit pe email" />
                <button style={styles.greenButton} onClick={confirmEmailChange}>Confirmă schimbarea emailului</button>
            </div>

            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>Schimbare parolă</h3>
                <input style={styles.input} type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} placeholder="Parola veche" />
                <input style={styles.input} type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="Parola nouă" />
                <input style={styles.input} type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} placeholder="Repetă parola nouă" />
                <button style={styles.blueButton} onClick={changePassword}>🔐 Schimbă parola</button>
            </div>

            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>📋 Istoric venit</h3>
                <div style={localStyles.tableWrapper}>
                    <table style={localStyles.table}>
                        <thead><tr><th style={localStyles.th}>Luna</th><th style={{ ...localStyles.th, textAlign: "right" }}>Venit (EUR)</th></tr></thead>
                        <tbody>{statusRows.map((row, idx) => <tr key={row.label} style={idx % 2 === 0 ? localStyles.rowEven : localStyles.rowOdd}><td style={localStyles.td}>{row.label}</td><td style={{ ...localStyles.td, textAlign: "right", fontWeight: 600 }}>{row.value.toLocaleString("ro-RO")} EUR</td></tr>)}</tbody>
                        <tfoot><tr><td style={localStyles.totalCell}>TOTAL GENERAL</td><td style={{ ...localStyles.totalCell, textAlign: "right", color: "#34C759" }}>{totalGeneralStatus.toLocaleString("ro-RO")} EUR</td></tr></tfoot>
                    </table>
                </div>
            </div>

            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>🔗 Conectare utilizator</h3>
                <select style={styles.input} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                    <option value="">Selectează utilizator</option>
                    {allUsers.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <button style={styles.greenButton} onClick={sendBridge}>Trimite cerere bridge</button>
                <h3 style={{ marginTop: 40 }}>📨 Cereri primite</h3>
                {bridgeRequests.length === 0 && <p style={{ opacity: 0.6 }}>Nu ai cereri</p>}
                {bridgeRequests.map((req) => <div key={req.id} style={styles.row}><span>{req.from_user}</span><button style={styles.greenButton} onClick={() => acceptBridge(req.id)}>Acceptă</button></div>)}
            </div>

            <div style={styles.card}>
                <button style={{ ...styles.blueButton, background: "#FF3B30" }} onClick={deleteUser}>🗑 Șterge cont</button>
                <button style={{ ...styles.blueButton, background: "#8E8E93", marginTop: 10 }} onClick={logout}>🚪 Logout</button>
            </div>
        </div>
    );
}

const localStyles = {
    avatar: { width: 96, height: 96, borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto 12px" },
    scheduleRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" },
    smallInput: { padding: "9px 10px", borderRadius: 10, border: "1px solid #E5E5EA", background: "#F9F9FB", minWidth: 0 },
    iconButton: { border: "none", borderRadius: 10, background: "#FFE5E5", color: "#FF3B30", fontSize: 20, padding: "8px 12px", cursor: "pointer" },
    tableWrapper: { marginTop: 6, border: "1px solid #E5E5EA", borderRadius: 14, overflow: "hidden", background: "#fff" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
    th: { background: "#F6F6FA", color: "#3A3A3C", fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid #E5E5EA" },
    td: { padding: "11px 14px", borderBottom: "1px solid #F0F0F5" },
    rowEven: { background: "#FFFFFF" },
    rowOdd: { background: "#FAFAFD" },
    totalCell: { padding: "12px 14px", fontWeight: 700, background: "#F6FFF8" },
};
