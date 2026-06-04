import React from 'react'
import ReactDOM from 'react-dom/client'
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Storage ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "regenOS_v2";
const defaultData = {
  workoutGoal: 200,
  workouts: [],
  cycles: { peptideStartDate: null, senolyticLastDate: null },
  checkins: [],
  biomarkers: [],
  setupComplete: false,
};

// ─── Constants ─────────────────────────────────────────────────────────────
const PEPTIDE_ON = 56, PEPTIDE_OFF = 28, SENOLYTIC_INTERVAL = 56;

// ─── Helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };
const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ─── Theme ─────────────────────────────────────────────────────────────────
const C = {
  bg: "#070b14", surface: "#0d1220", border: "#1a2038", accent: "#00e5a0",
  accentB: "#3d9eff", purple: "#a78bfa", pink: "#f472b6", orange: "#f0a500",
  red: "#ff6b6b", text: "#e2e8f0", muted: "#4a5568", subtle: "#8892a4",
};

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState(null);

  // Setup state
  const [sGoal, setSGoal] = useState("200");
  const [sPepStart, setSPepStart] = useState(todayStr());
  const [sSenLast, setSSenLast] = useState(todayStr());

  // Workout form
  const [wDate, setWDate] = useState(todayStr());
  const [wType, setWType] = useState("");
  const [wNotes, setWNotes] = useState("");

  // Check-in form
  const [ciEnergy, setCiEnergy] = useState(3);
  const [ciNotes, setCiNotes] = useState("");

  // Biomarker form
  const [bType, setBType] = useState("GlycanAge");
  const [bValue, setBValue] = useState("");
  const [bDate, setBDate] = useState(todayStr());
  const [bNotes, setBNotes] = useState("");

  // PDF upload
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfResult, setPdfResult] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    window.storage.get(STORAGE_KEY).then(r => {
      if (r?.value) setData(JSON.parse(r.value));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const persist = useCallback(d => {
    window.storage.set(STORAGE_KEY, JSON.stringify(d)).catch(() => {});
  }, []);

  const update = fn => setData(prev => {
    const next = JSON.parse(JSON.stringify(prev));
    fn(next);
    persist(next);
    return next;
  });

  const toast$ = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  // ── Cycle calcs ──
  const getPS = () => {
    if (!data.cycles.peptideStartDate) return null;
    const el = daysBetween(data.cycles.peptideStartDate, todayStr());
    if (el < 0) return null;
    const cycleLen = PEPTIDE_ON + PEPTIDE_OFF;
    const pos = el % cycleLen;
    const isOn = pos < PEPTIDE_ON;
    const dayInPhase = isOn ? pos + 1 : pos - PEPTIDE_ON + 1;
    const daysLeft = isOn ? PEPTIDE_ON - pos : PEPTIDE_OFF - (pos - PEPTIDE_ON);
    return { isOn, dayInPhase, daysLeft, cycle: Math.floor(el / cycleLen) + 1, nextDate: addDays(todayStr(), daysLeft), pos, cycleLen };
  };

  const getSS = () => {
    if (!data.cycles.senolyticLastDate) return null;
    const el = daysBetween(data.cycles.senolyticLastDate, todayStr());
    const left = Math.max(0, SENOLYTIC_INTERVAL - el);
    return { el, left, next: addDays(data.cycles.senolyticLastDate, SENOLYTIC_INTERVAL), due: left === 0 };
  };

  const ps = getPS(), ss = getSS();
  const thisYear = new Date().getFullYear().toString();
  const workoutsYTD = data.workouts.filter(w => w.date?.startsWith(thisYear));
  const pct = Math.min(100, Math.round((workoutsYTD.length / (data.workoutGoal || 200)) * 100));

  // ── Actions ──
  const logWorkout = () => {
    if (!wType.trim()) { toast$("Enter workout type", "err"); return; }
    update(d => { d.workouts = [{ id: Date.now(), date: wDate, type: wType.trim(), notes: wNotes.trim() }, ...d.workouts]; });
    setWType(""); setWNotes(""); setWDate(todayStr());
    toast$("Workout logged!");
  };

  const logCheckin = () => {
    update(d => { d.checkins = [{ id: Date.now(), date: todayStr(), energy: ciEnergy, notes: ciNotes.trim() }, ...d.checkins]; });
    setCiNotes(""); setCiEnergy(3);
    toast$("Check-in saved!");
  };

  const logBiomarker = () => {
    if (!bValue.trim()) { toast$("Enter a value", "err"); return; }
    update(d => { d.biomarkers = [{ id: Date.now(), type: bType, value: bValue.trim(), date: bDate, notes: bNotes.trim() }, ...d.biomarkers]; });
    setBValue(""); setBNotes(""); setBDate(todayStr());
    toast$("Biomarker saved!");
  };

  const completeSetup = () => {
    update(d => { d.workoutGoal = parseInt(sGoal) || 200; d.cycles.peptideStartDate = sPepStart; d.cycles.senolyticLastDate = sSenLast; d.setupComplete = true; });
    setTab("home");
  };

  // ── PDF Upload ──
  const handlePDF = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfLoading(true); setPdfResult(null);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej();
        r.readAsDataURL(file);
      });

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
              { type: "text", text: `This is a Dynacare blood test report. Extract ALL lab values and return ONLY a JSON array, no markdown, no explanation. Format: [{"name":"Test Name","value":"123.4","unit":"mmol/L","reference":"3.5-5.0","flag":"H or L or normal","date":"YYYY-MM-DD"}]. Use the collection date for date field. If date not found use today ${todayStr()}. Include every single test result you find.` }
            ]
          }]
        })
      });

      const json = await resp.json();
      const raw = json.content?.find(c => c.type === "text")?.text || "[]";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const results = JSON.parse(cleaned);
      setPdfResult(results);
    } catch (err) {
      toast$("Could not read PDF — try again", "err");
    }
    setPdfLoading(false);
    e.target.value = "";
  };

  const importPDFResults = (selected) => {
    update(d => {
      selected.forEach(r => {
        d.biomarkers = [{ id: Date.now() + Math.random(), type: r.name, value: `${r.value}${r.unit ? " " + r.unit : ""}${r.flag && r.flag !== "normal" ? " (" + r.flag + ")" : ""}`, date: r.date, notes: r.reference ? `Ref: ${r.reference}` : "" }, ...d.biomarkers];
      });
    });
    setPdfResult(null);
    toast$(`${selected.length} results imported!`);
  };

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.accent, fontSize: 16, fontFamily: "sans-serif", letterSpacing: "0.1em" }}>LOADING...</div>
    </div>
  );

  // ── Setup ──
  if (!data.setupComplete) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, color: C.accent, marginBottom: 8 }}>◈</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Regenerative OS</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Calibrate your protocol</p>
        </div>
        {[
          ["Annual workout goal (days)", "number", sGoal, setSGoal],
          ["Peptide cycle start date", "date", sPepStart, setSPepStart],
          ["Last senolytic pulse date", "date", sSenLast, setSSenLast],
        ].map(([label, type, val, set]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={Tx.label}>{label}</label>
            <input style={Tx.input} type={type} value={val} onChange={e => set(e.target.value)} />
          </div>
        ))}
        <button style={Tx.btnPrimary} onClick={completeSetup}>Initialize Protocol →</button>
      </div>
    </div>
  );

  // ── Main App ──
  const tabs = [
    { id: "home", icon: "⬡", label: "Home" },
    { id: "cycles", icon: "↻", label: "Cycles" },
    { id: "workout", icon: "◎", label: "Workout" },
    { id: "checkin", icon: "◉", label: "Check-in" },
    { id: "bio", icon: "◈", label: "Labs" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: 80 }}>
      {/* Toast */}
      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "err" ? C.red : C.accent, color: "#000", padding: "10px 22px", borderRadius: 50, fontWeight: 700, fontSize: 13, zIndex: 9999, whiteSpace: "nowrap" }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
        <span style={{ color: C.accent, fontSize: 20 }}>◈</span>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Regen OS</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

        {/* ── HOME ── */}
        {tab === "home" && (
          <div>
            {/* Bio age hero */}
            <div style={{ background: "linear-gradient(135deg,#0a1e3d,#071428)", border: `1px solid #1e3060`, borderRadius: 20, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Biological Age</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: C.accent, lineHeight: 1, letterSpacing: "-0.04em" }}>34</div>
              <div style={{ fontSize: 13, color: C.subtle, marginTop: 6 }}>Chronological 38 · <span style={{ color: C.accent, fontWeight: 700 }}>+4 year gap</span></div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>REGENERATIVE INDEX</div>
                <div style={{ height: 6, background: "#1a2038", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "72%", background: `linear-gradient(90deg,${C.accent},${C.accentB})`, borderRadius: 3 }} />
                </div>
              </div>
            </div>

            {/* Status grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <StatCard icon="↻" label="Peptides"
                val={ps ? (ps.isOn ? "ON" : "OFF") + ` D${ps.dayInPhase}` : "Not set"}
                sub={ps ? `${ps.daysLeft}d left` : "Set in Settings"}
                color={ps?.isOn ? C.accent : C.orange} />
              <StatCard icon="◎" label="Senolytics"
                val={ss ? (ss.due ? "DUE NOW" : `${ss.left}d`) : "Not set"}
                sub={ss ? fmtDate(ss.next) : "—"}
                color={ss?.due ? C.red : C.purple} />
              <StatCard icon="◈" label="Epithalon"
                val={ps ? (ps.isOn ? `In ${ps.daysLeft}d` : "ACTIVE") : "—"}
                sub={ps?.isOn ? "Off month coming" : "Run now"}
                color={C.accentB} />
              <StatCard icon="◉" label="Workouts"
                val={`${workoutsYTD.length}/${data.workoutGoal}`}
                sub={`${pct}% of goal`}
                color={C.pink} />
            </div>

            {/* Progress bar */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Annual Workout Goal</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: C.pink }}>{pct}%</span>
              </div>
              <div style={{ height: 10, background: "#1a2038", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${C.pink},${C.purple})`, borderRadius: 5, transition: "width 0.6s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{workoutsYTD.length} logged · {Math.max(0, data.workoutGoal - workoutsYTD.length)} remaining</div>
            </div>

            {/* Recent workouts */}
            <SectionTitle>Recent Workouts</SectionTitle>
            {data.workouts.length === 0
              ? <Empty>No workouts yet — log your first one</Empty>
              : data.workouts.slice(0, 4).map(w => (
                <Row key={w.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(w.date)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{w.type}</span>
                  {w.notes && <span style={{ fontSize: 12, color: C.subtle, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.notes}</span>}
                </Row>
              ))}
          </div>
        )}

        {/* ── CYCLES ── */}
        {tab === "cycles" && (
          <div>
            <PageTitle>Protocol Cycles</PageTitle>

            {/* Peptides */}
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ color: C.accent, fontSize: 18 }}>↻</span>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Foundation Peptides</span>
                <Badge color={ps?.isOn ? C.accent : C.orange}>{ps ? (ps.isOn ? "ON" : "OFF") : "—"}</Badge>
              </div>
              {ps ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[["Phase day", `D${ps.dayInPhase}`], ["Days left", ps.daysLeft], ["Cycle #", ps.cycle], ["Next phase", fmtDate(ps.nextDate)]].map(([l, v]) => (
                      <div key={l} style={{ background: "#0a0e1a", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 6, background: "#1a2038", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${(ps.pos / ps.cycleLen) * 100}%`, background: ps.isOn ? C.accent : C.orange, borderRadius: 3 }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {ps.isOn
                      ? [["BPC-157","250mcg/day"], ["TB-500","2mg 2×/wk"], ["Ipamorelin","200mcg bed"]].map(([n,d]) => <PTag key={n} name={n} dose={d} />)
                      : [["Epithalon","5mg/day×10d"], ["Pinealon","0.1mg/day×10d"]].map(([n,d]) => <PTag key={n} name={n} dose={d} color={C.accentB} />)
                    }
                  </div>
                </>
              ) : <Empty>Set peptide start date in Settings</Empty>}
            </Card>

            {/* Senolytics */}
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ color: C.purple, fontSize: 18 }}>◎</span>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Senolytic Pulse</span>
                <Badge color={ss?.due ? C.red : C.purple}>{ss ? (ss.due ? "DUE" : `${ss.left}d`) : "—"}</Badge>
              </div>
              {ss ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[["Last pulse", fmtDate(data.cycles.senolyticLastDate)], ["Next pulse", fmtDate(ss.next)]].map(([l, v]) => (
                      <div key={l} style={{ background: "#0a0e1a", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 6, background: "#1a2038", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (ss.el / SENOLYTIC_INTERVAL) * 100)}%`, background: ss.due ? C.red : C.purple, borderRadius: 3 }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    <PTag name="Fisetin" dose="1000-1500mg×2d" color={C.purple} />
                    <PTag name="Quercetin" dose="1000mg×2d" color={C.purple} />
                  </div>
                  <button style={Tx.btnSmall} onClick={() => { update(d => { d.cycles.senolyticLastDate = todayStr(); }); toast$("Pulse logged!"); }}>
                    ✓ Mark pulse completed today
                  </button>
                </>
              ) : <Empty>Set last senolytic date in Settings</Empty>}
            </Card>

            {/* Cognitive */}
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ color: C.pink, fontSize: 18 }}>◉</span>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Cognitive — On Demand</span>
                <Badge color={C.pink}>AS NEEDED</Badge>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <PTag name="Semax" dose="200-300mcg nasal" color={C.pink} />
                <PTag name="Selank" dose="250mcg nasal" color={C.pink} />
              </div>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Use on low-performance days. Flag with Jack Health re: Foquest interaction.</p>
            </Card>

            {/* Settings inline */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: C.text }}>⊙ Cycle Settings</div>
              <label style={Tx.label}>Annual workout goal</label>
              <input style={Tx.input} type="number" value={data.workoutGoal} onChange={e => update(d => { d.workoutGoal = parseInt(e.target.value) || 200; })} />
              <label style={Tx.label}>Peptide cycle start date</label>
              <input style={Tx.input} type="date" value={data.cycles.peptideStartDate || ""} onChange={e => update(d => { d.cycles.peptideStartDate = e.target.value; })} />
              <label style={Tx.label}>Last senolytic pulse date</label>
              <input style={Tx.input} type="date" value={data.cycles.senolyticLastDate || ""} onChange={e => update(d => { d.cycles.senolyticLastDate = e.target.value; })} />
            </Card>
          </div>
        )}

        {/* ── WORKOUT ── */}
        {tab === "workout" && (
          <div>
            <PageTitle>Workouts</PageTitle>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Goal: {data.workoutGoal} days</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.pink }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: "#1a2038", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${C.pink},${C.purple})`, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{workoutsYTD.length} logged · {Math.max(0, data.workoutGoal - workoutsYTD.length)} to go</div>
            </div>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Log a Workout</div>
              <label style={Tx.label}>Date</label>
              <input style={Tx.input} type="date" value={wDate} onChange={e => setWDate(e.target.value)} />
              <label style={Tx.label}>Workout type</label>
              <input style={Tx.input} placeholder="e.g. Strength, Run, Yoga, HIIT..." value={wType} onChange={e => setWType(e.target.value)} />
              <label style={Tx.label}>Notes (optional)</label>
              <textarea style={{ ...Tx.input, height: 72, resize: "vertical" }} placeholder="Duration, sets, how you felt..." value={wNotes} onChange={e => setWNotes(e.target.value)} />
              <button style={Tx.btnPrimary} onClick={logWorkout}>Log Workout</button>
            </Card>

            <SectionTitle>History</SectionTitle>
            {data.workouts.length === 0
              ? <Empty>No workouts yet</Empty>
              : data.workouts.map(w => (
                <Row key={w.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(w.date)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{w.type}</span>
                  {w.notes && <span style={{ fontSize: 12, color: C.subtle, flex: 1 }}>{w.notes}</span>}
                  <button style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "0 4px" }} onClick={() => update(d => { d.workouts = d.workouts.filter(x => x.id !== w.id); })}>×</button>
                </Row>
              ))}
          </div>
        )}

        {/* ── CHECK-IN ── */}
        {tab === "checkin" && (
          <div>
            <PageTitle>Daily Check-In</PageTitle>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>How are you today?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setCiEnergy(n)}
                    style={{ flex: 1, background: ciEnergy === n ? C.accent + "20" : "#0a0e1a", border: `1px solid ${ciEnergy === n ? C.accent + "60" : C.border}`, borderRadius: 12, padding: "12px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 22 }}>{["😴","😕","😐","😊","🔥"][n-1]}</span>
                    <span style={{ fontSize: 9, color: ciEnergy === n ? C.text : C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{["Low","Below","Avg","Good","Peak"][n-1]}</span>
                  </button>
                ))}
              </div>
              <textarea style={{ ...Tx.input, height: 90, resize: "vertical" }} placeholder="Notes — energy, mood, recovery, protocol observations..." value={ciNotes} onChange={e => setCiNotes(e.target.value)} />
              <button style={Tx.btnPrimary} onClick={logCheckin}>Save Check-In</button>
            </Card>

            <SectionTitle>Recent Check-Ins</SectionTitle>
            {data.checkins.length === 0
              ? <Empty>No check-ins yet</Empty>
              : data.checkins.slice(0, 14).map(c => (
                <Row key={c.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(c.date)}</span>
                  <span style={{ fontSize: 16 }}>{["😴","😕","😐","😊","🔥"][c.energy-1]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{["Low","Below avg","Average","Good","Peak"][c.energy-1]}</span>
                  {c.notes && <span style={{ fontSize: 12, color: C.subtle, flex: 1 }}>{c.notes}</span>}
                </Row>
              ))}
          </div>
        )}

        {/* ── BIOMARKERS / LABS ── */}
        {tab === "bio" && (
          <div>
            <PageTitle>Labs & Biomarkers</PageTitle>

            {/* PDF Upload */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Upload Dynacare PDF</div>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Upload your lab PDF and AI will extract all values automatically.</p>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handlePDF} />
              <button style={{ ...Tx.btnPrimary, background: pdfLoading ? "#1a2038" : `linear-gradient(135deg,${C.accentB},${C.accent})` }}
                onClick={() => !pdfLoading && fileRef.current.click()}
                disabled={pdfLoading}>
                {pdfLoading ? "Reading PDF..." : "📄 Upload Blood Test PDF"}
              </button>
            </Card>

            {/* PDF Results Preview */}
            {pdfResult && pdfResult.length > 0 && (
              <PDFResultsPanel results={pdfResult} onImport={importPDFResults} onDismiss={() => setPdfResult(null)} />
            )}

            {/* Manual entry */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Manual Entry</div>
              <label style={Tx.label}>Test type</label>
              <select style={Tx.input} value={bType} onChange={e => setBType(e.target.value)}>
                {["GlycanAge","TruAge","Biological Age (Oura)","DEXA — Body Fat %","DEXA — Lean Mass (kg)","Testosterone (nmol/L)","Free Testosterone","Estradiol","SHBG","HRV (ms)","B1","B12","B5","Copper","Cortisol","Thyroid (TSH)","Other"].map(o => <option key={o}>{o}</option>)}
              </select>
              <label style={Tx.label}>Value</label>
              <input style={Tx.input} placeholder="e.g. 34 or 5.2 mmol/L" value={bValue} onChange={e => setBValue(e.target.value)} />
              <label style={Tx.label}>Date</label>
              <input style={Tx.input} type="date" value={bDate} onChange={e => setBDate(e.target.value)} />
              <label style={Tx.label}>Notes (optional)</label>
              <input style={Tx.input} placeholder="Reference range, context..." value={bNotes} onChange={e => setBNotes(e.target.value)} />
              <button style={Tx.btnPrimary} onClick={logBiomarker}>Save Result</button>
            </Card>

            <SectionTitle>History</SectionTitle>
            {data.biomarkers.length === 0
              ? <Empty>No results yet — upload a PDF or add manually</Empty>
              : data.biomarkers.map(b => (
                <Row key={b.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(b.date)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{b.type}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{b.value}</span>
                  <button style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "0 4px" }} onClick={() => update(d => { d.biomarkers = d.biomarkers.filter(x => x.id !== b.id); })}>×</button>
                </Row>
              ))}
          </div>
        )}

      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 env(safe-area-inset-bottom,8px)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === t.id ? C.accent : C.muted }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 500, letterSpacing: "0.04em" }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── PDF Results Panel ─────────────────────────────────────────────────────
function PDFResultsPanel({ results, onImport, onDismiss }) {
  const [selected, setSelected] = useState(new Set(results.map((_, i) => i)));
  const toggle = i => setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  const flagColor = f => f === "H" ? "#ff8c42" : f === "L" ? "#60a5fa" : C.subtle;

  return (
    <div style={{ background: "#0a1428", border: `1px solid ${C.accentB}40`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>PDF Results Found</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{results.length} values extracted · {selected.size} selected</div>
        </div>
        <button style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }} onClick={onDismiss}>×</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
        {results.map((r, i) => (
          <div key={i} onClick={() => toggle(i)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, marginBottom: 6, background: selected.has(i) ? "#0d2040" : "#0a0e1a", border: `1px solid ${selected.has(i) ? C.accentB + "40" : C.border}`, cursor: "pointer" }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: selected.has(i) ? C.accentB : "transparent", border: `2px solid ${selected.has(i) ? C.accentB : C.muted}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {selected.has(i) && <span style={{ color: "#000", fontSize: 11, fontWeight: 900 }}>✓</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.name}</div>
              {r.reference && <div style={{ fontSize: 11, color: C.muted }}>Ref: {r.reference}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: r.flag && r.flag !== "normal" ? flagColor(r.flag) : C.accent }}>{r.value} {r.unit}</div>
              {r.flag && r.flag !== "normal" && <div style={{ fontSize: 10, fontWeight: 700, color: flagColor(r.flag) }}>{r.flag === "H" ? "HIGH" : "LOW"}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ ...Tx.btnSmall, flex: 1 }} onClick={() => setSelected(new Set(results.map((_, i) => i)))}>Select all</button>
        <button style={{ ...Tx.btnPrimary, flex: 2 }} onClick={() => onImport(results.filter((_, i) => selected.has(i)))}>
          Import {selected.size} results
        </button>
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────
function StatCard({ icon, label, val, sub, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 18, color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginBottom: 3 }}>{val}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
    </div>
  );
}

function Badge({ color, children }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: color + "20", color, border: `1px solid ${color}40`, letterSpacing: "0.05em" }}>{children}</span>;
}

function PTag({ name, dose, color = C.accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "7px 12px", borderRadius: 8, background: color + "15", border: `1px solid ${color}30`, color }}>
      <span style={{ fontWeight: 700, fontSize: 12 }}>{name}</span>
      <span style={{ fontSize: 10, opacity: 0.8 }}>{dose}</span>
    </div>
  );
}

function Card({ children }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 14 }}>{children}</div>;
}

function Row({ children }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>{children}</div>;
}

function PageTitle({ children }) {
  return <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 16px", letterSpacing: "-0.02em" }}>{children}</h1>;
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 14, fontWeight: 700, color: C.subtle, margin: "20px 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</h2>;
}

function Empty({ children }) {
  return <p style={{ color: C.muted, fontSize: 13, fontStyle: "italic", padding: "8px 0" }}>{children}</p>;
}

const Tx = {
  label: { display: "block", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, marginTop: 12 },
  input: { display: "block", width: "100%", background: "#0a0e1a", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "11px 14px", fontSize: 14, marginBottom: 8, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  btnPrimary: { background: `linear-gradient(135deg,${C.accent},${C.accentB})`, color: "#000", border: "none", borderRadius: 10, padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", letterSpacing: "0.02em" },
  btnSmall: { background: "#1a2038", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" },
  
};
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
