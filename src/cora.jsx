import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

// ═══════════════════════════════════════════════════════════════
// DESIGN: Academic paper site with interactive demo
// Aesthetic: Clean editorial with deep navy/teal accents
// Font: DM Serif Display (headers) + Source Sans 3 (body)
// ═══════════════════════════════════════════════════════════════

const font = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Source+Sans+3:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

const C = {
  navy: "#0a1628", deep: "#0e1f3d", teal: "#0891b2", mint: "#06d6a0",
  amber: "#f59e0b", coral: "#ef4444", text: "#e8ecf1", muted: "#8b9ab5",
  dim: "#3d5278", card: "rgba(14,31,61,0.7)", border: "rgba(8,145,178,0.18)",
  bg: "#060d18", white: "#f8fafc",
};

// ═══════════════════════════════════════════════════════════════
// INTERACTIVE CONSENSUS DEMO
// ═══════════════════════════════════════════════════════════════

const REPLICAS = [
  { id: "R1", x: 400, y: 120, weight: 7.53, label: "R1 (w=7.53)" },
  { id: "R2", x: 580, y: 200, weight: 5.38, label: "R2 (w=5.38)" },
  { id: "R3", x: 580, y: 360, weight: 3.84, label: "R3 (w=3.84)" },
  { id: "R4", x: 400, y: 440, weight: 2.74, label: "R4 (w=2.74)" },
  { id: "R5", x: 220, y: 360, weight: 1.96, label: "R5 (w=1.96)" },
  { id: "R6", x: 220, y: 200, weight: 1.40, label: "R6 (w=1.40)" },
  { id: "R7", x: 400, y: 280, weight: 1.00, label: "R7 (Leader)" },
];
const THRESHOLD = 11.43;

function ConsensusDemo() {
  const [mode, setMode] = useState("idle");
  const [step, setStep] = useState(0);
  const [log, setLog] = useState(["System ready. Choose a scenario to begin."]);
  const [activeReplicas, setActiveReplicas] = useState({});
  const [messages, setMessages] = useState([]);
  const [accWeight, setAccWeight] = useState(0);
  const [path, setPath] = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setMode("idle"); setStep(0); setActiveReplicas({});
    setMessages([]); setAccWeight(0); setPath(null); setCoordinator(null);
    setLog(["System reset. Choose a scenario."]);
  }, []);

  const addLog = useCallback((msg) => setLog(p => [...p.slice(-8), msg]), []);

  const runFastPath = useCallback(() => {
    reset();
    setMode("fast"); setPath("fast");
    const coord = "R1";
    setCoordinator(coord);

    const steps = [
      () => { addLog("Client → R1: Write(ObjA, value=42)"); setActiveReplicas({ R1: "coordinator" }); },
      () => { addLog("R1: No conflict detected. Starting fast path."); setActiveReplicas({ R1: "coordinator" }); setAccWeight(7.53); },
      () => { addLog("R1 broadcasts PROPOSE to all replicas..."); setMessages([{from:"R1",to:"R2"},{from:"R1",to:"R3"},{from:"R1",to:"R4"},{from:"R1",to:"R5"},{from:"R1",to:"R6"},{from:"R1",to:"R7"}]); },
      () => { addLog("R2 replies (w=5.38). Accumulated: 7.53+5.38=12.91"); setActiveReplicas({ R1:"coordinator", R2:"voted" }); setAccWeight(12.91); setMessages([{from:"R2",to:"R1",color:C.mint}]); },
      () => { addLog(`Weight 12.91 ≥ threshold ${THRESHOLD}. QUORUM REACHED!`); setActiveReplicas({ R1:"committed", R2:"committed" }); setMessages([]); },
      () => { addLog("Early termination signal sent. ObjA committed via FAST PATH in 1 RTT!"); setActiveReplicas({ R1:"committed", R2:"committed", R3:"notified", R4:"notified", R5:"notified", R6:"notified", R7:"notified" }); },
    ];

    let i = 0;
    const run = () => {
      if (i < steps.length) { steps[i](); setStep(i + 1); i++; timerRef.current = setTimeout(run, 1400); }
      else setMode("done");
    };
    timerRef.current = setTimeout(run, 400);
  }, [reset, addLog]);

  const runSlowPath = useCallback(() => {
    reset();
    setMode("slow"); setPath("slow");

    const steps = [
      () => { addLog("Client1 → R2: Write(ObjA, value=10)"); setActiveReplicas({ R2: "coordinator" }); },
      () => { addLog("Client2 → R6: Write(ObjA, value=20)"); setActiveReplicas({ R2: "coordinator", R6: "coordinator" }); },
      () => { addLog("CONFLICT detected on ObjA! Both forwarded to Leader R7."); setActiveReplicas({ R2: "forwarding", R6: "forwarding", R7: "leader" }); setMessages([{from:"R2",to:"R7",color:C.coral},{from:"R6",to:"R7",color:C.coral}]); },
      () => { addLog("R7 (Leader) enqueues ops. Processing Client1's write first..."); setActiveReplicas({ R7: "leader" }); setMessages([]); },
      () => { addLog("R7 broadcasts PROPOSE(ObjA=10) with priority weights..."); setMessages([{from:"R7",to:"R1"},{from:"R7",to:"R2"},{from:"R7",to:"R3"},{from:"R7",to:"R4"},{from:"R7",to:"R5"},{from:"R7",to:"R6"}]); },
      () => { addLog("Collecting priority-weighted votes... pSum accumulating."); setActiveReplicas({ R7:"leader", R1:"voted", R2:"voted" }); setAccWeight(13.5); setMessages([{from:"R1",to:"R7",color:C.amber},{from:"R2",to:"R7",color:C.amber}]); },
      () => { addLog("pSum > T^N. Client1's write COMMITTED via slow path."); setActiveReplicas({ R7:"committed", R1:"committed", R2:"committed" }); setMessages([]); },
      () => { addLog("Now processing Client2's write(ObjA=20)... same procedure."); setActiveReplicas({ R7:"leader" }); },
      () => { addLog("Client2's write also committed. Both ops serialized by leader. Done!"); setActiveReplicas({ R7:"committed", R1:"committed", R2:"committed", R3:"notified", R4:"notified", R5:"notified", R6:"notified" }); },
    ];

    let i = 0;
    const run = () => {
      if (i < steps.length) { steps[i](); setStep(i + 1); i++; timerRef.current = setTimeout(run, 1400); }
      else setMode("done");
    };
    timerRef.current = setTimeout(run, 400);
  }, [reset, addLog]);

  const runParallel = useCallback(() => {
    reset();
    setMode("parallel"); setPath("parallel");

    const steps = [
      () => { addLog("Client1 → R1: Write(ObjA). Client2 → R5: Write(ObjB)."); setActiveReplicas({ R1:"coordinator", R5:"coordinator" }); },
      () => { addLog("ObjA and ObjB are INDEPENDENT — no conflict!"); },
      () => { addLog("R1 broadcasts for ObjA, R5 broadcasts for ObjB — in PARALLEL!"); setMessages([{from:"R1",to:"R2"},{from:"R1",to:"R3"},{from:"R5",to:"R4"},{from:"R5",to:"R6"}]); },
      () => { addLog("R1 gets R2's vote → w=12.91 ≥ 11.43. ObjA quorum!"); setActiveReplicas({ R1:"committed", R2:"committed", R5:"coordinator" }); setMessages([{from:"R5",to:"R4"},{from:"R4",to:"R5",color:C.mint}]); },
      () => { addLog("R5 gets R4's + R6's votes → ObjB quorum too!"); setActiveReplicas({ R1:"committed", R2:"committed", R5:"committed", R4:"committed", R6:"committed" }); setMessages([]); },
      () => { addLog("Both objects committed in 1 RTT each, in PARALLEL! This is CORA's key advantage over Cabinet."); setActiveReplicas({ R1:"committed", R2:"committed", R3:"notified", R4:"committed", R5:"committed", R6:"committed", R7:"notified" }); },
    ];

    let i = 0;
    const run = () => {
      if (i < steps.length) { steps[i](); setStep(i + 1); i++; timerRef.current = setTimeout(run, 1500); }
      else setMode("done");
    };
    timerRef.current = setTimeout(run, 400);
  }, [reset, addLog]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const getNodeColor = (status) => {
    if (!status) return C.dim;
    if (status === "coordinator") return C.teal;
    if (status === "leader") return C.amber;
    if (status === "voted") return "#6ee7b7";
    if (status === "committed") return C.mint;
    if (status === "forwarding") return C.coral;
    if (status === "notified") return "#4ade80";
    return C.dim;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={runFastPath} disabled={mode !== "idle" && mode !== "done"} style={btnStyle(C.mint, mode === "fast")}>
          Fast Path Demo
        </button>
        <button onClick={runSlowPath} disabled={mode !== "idle" && mode !== "done"} style={btnStyle(C.amber, mode === "slow")}>
          Slow Path (Conflict)
        </button>
        <button onClick={runParallel} disabled={mode !== "idle" && mode !== "done"} style={btnStyle(C.teal, mode === "parallel")}>
          Parallel Objects
        </button>
        <button onClick={reset} style={btnStyle("#94a3b8", false)}>Reset</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* SVG Visualization */}
        <div style={{ background: "rgba(6,13,24,0.8)", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", position: "relative" }}>
          <svg viewBox="0 0 800 540" style={{ width: "100%", height: "auto" }}>
            {/* Message arrows */}
            {messages.map((m, i) => {
              const from = REPLICAS.find(r => r.id === m.from);
              const to = REPLICAS.find(r => r.id === m.to);
              if (!from || !to) return null;
              return (
                <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={m.color || C.teal} strokeWidth={2} strokeDasharray="6 4" opacity={0.7}>
                  <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite" />
                </line>
              );
            })}
            {/* Replica nodes */}
            {REPLICAS.map(r => {
              const status = activeReplicas[r.id];
              const color = getNodeColor(status);
              const isActive = !!status;
              return (
                <g key={r.id}>
                  <circle cx={r.x} cy={r.y} r={isActive ? 32 : 28} fill={color} opacity={isActive ? 1 : 0.3}
                    stroke={isActive ? "#fff" : "transparent"} strokeWidth={isActive ? 2 : 0}>
                    {isActive && <animate attributeName="r" values="28;33;28" dur="1.5s" repeatCount="indefinite" />}
                  </circle>
                  <text x={r.x} y={r.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fill={isActive ? C.navy : C.muted} fontSize={14} fontWeight={700} fontFamily="JetBrains Mono">
                    {r.id}
                  </text>
                  <text x={r.x} y={r.y + 50} textAnchor="middle" fill={C.muted} fontSize={10} fontFamily="Source Sans 3">
                    w={r.weight.toFixed(2)}
                  </text>
                  {status && (
                    <text x={r.x} y={r.y - 40} textAnchor="middle" fill={color} fontSize={10} fontWeight={600} fontFamily="JetBrains Mono">
                      {status.toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Weight accumulator */}
            {accWeight > 0 && (
              <g>
                <rect x={580} y={460} width={190} height={50} rx={8} fill="rgba(6,214,160,0.15)" stroke={C.mint} strokeWidth={1} />
                <text x={675} y={478} textAnchor="middle" fill={C.muted} fontSize={11} fontFamily="Source Sans 3">Accumulated Weight</text>
                <text x={675} y={498} textAnchor="middle" fill={accWeight >= THRESHOLD ? C.mint : C.amber} fontSize={18} fontWeight={700} fontFamily="JetBrains Mono">
                  {accWeight.toFixed(2)} / {THRESHOLD}
                </text>
              </g>
            )}
            {/* Path label */}
            {path && (
              <text x={400} y={30} textAnchor="middle" fill={path === "fast" || path === "parallel" ? C.mint : C.amber}
                fontSize={16} fontWeight={700} fontFamily="DM Serif Display" letterSpacing={1}>
                {path === "fast" ? "FAST PATH — Object-Weighted Consensus (1 RTT)" :
                 path === "slow" ? "SLOW PATH — Leader-Coordinated Consensus (2 RTT)" :
                 "PARALLEL EXECUTION — Independent Objects"}
              </text>
            )}
          </svg>
        </div>

        {/* Event Log */}
        <div style={{ background: "rgba(6,13,24,0.9)", borderRadius: 12, border: `1px solid ${C.border}`, padding: 14, display: "flex", flexDirection: "column" }}>
          <div style={{ color: C.teal, fontSize: 12, fontWeight: 700, fontFamily: "JetBrains Mono", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Event Log
          </div>
          <div style={{ flex: 1, overflow: "auto", fontSize: 12, fontFamily: "JetBrains Mono", lineHeight: 1.6 }}>
            {log.map((l, i) => (
              <div key={i} style={{ color: i === log.length - 1 ? C.white : C.muted, padding: "4px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <span style={{ color: C.dim, marginRight: 6 }}>[{i + 1}]</span>{l}
              </div>
            ))}
          </div>
          {mode === "done" && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(6,214,160,0.1)", borderRadius: 6, color: C.mint, fontSize: 11, fontFamily: "Source Sans 3" }}>
              Demo complete. Click Reset to try another scenario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function btnStyle(color, active) {
  return {
    padding: "8px 18px", borderRadius: 8, border: `1.5px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
    background: active ? `${color}22` : "transparent", color: active ? color : C.muted,
    cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Source Sans 3",
    transition: "all 0.2s",
  };
}

// ═══════════════════════════════════════════════════════════════
// EVALUATION CHARTS (compact)
// ═══════════════════════════════════════════════════════════════
const tptData = [
  { n: "n=3", CORA: 9547, Cabinet: 1508 },
  { n: "n=5", CORA: 9021, Cabinet: 1663 },
  { n: "n=7", CORA: 8114, Cabinet: 1539 },
  { n: "n=11", CORA: 5195, Cabinet: 1497 },
];
const conflictData = [
  { rate: "0%", CORA: 9.0, Cabinet: 1.42 },
  { rate: "5%", CORA: 8.5, Cabinet: 1.42 },
  { rate: "25%", CORA: 6.4, Cabinet: 1.42 },
  { rate: "50%", CORA: 5.2, Cabinet: 1.42 },
  { rate: "75%", CORA: 3.0, Cabinet: 1.55 },
  { rate: "100%", CORA: 1.15, Cabinet: 1.55 },
];
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontFamily: "JetBrains Mono" }}>
      <div style={{ color: C.muted, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {p.value.toLocaleString()}</div>)}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function CORAWebsite() {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "architecture", label: "Architecture" },
    { id: "demo", label: "Interactive Demo" },
    { id: "algorithms", label: "Algorithms" },
    { id: "evaluation", label: "Evaluation" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Source Sans 3', sans-serif", color: C.text }}>
      <style>{font}</style>

      {/* ─── HEADER ─── */}
      <header style={{ borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50, background: "rgba(6,13,24,0.92)", backdropFilter: "blur(16px)" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: "'DM Serif Display'", fontSize: 24, color: C.white, letterSpacing: -0.5 }}>CORA</span>
            <span style={{ color: C.muted, fontSize: 13 }}>Adaptive Object Weighted Consensus</span>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            {sections.map(s => (
              <button key={s.id} onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" }); }}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
                  background: activeSection === s.id ? "rgba(8,145,178,0.15)" : "transparent",
                  color: activeSection === s.id ? C.teal : C.muted, fontFamily: "'Source Sans 3'" }}>
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section style={{ maxWidth: 1060, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: `radial-gradient(circle, rgba(8,145,178,0.06) 0%, transparent 70%)`, pointerEvents: "none" }} />
        <h1 style={{ fontFamily: "'DM Serif Display'", fontSize: 56, fontWeight: 400, color: C.white, margin: "0 0 16px", lineHeight: 1.1, letterSpacing: -1 }}>
          CORA
        </h1>
        <p style={{ fontFamily: "'DM Serif Display'", fontSize: 22, color: C.muted, margin: "0 0 28px", fontStyle: "italic" }}>
          Adaptive Object Weighted Consensus made Efficient
        </p>
        <p style={{ maxWidth: 680, margin: "0 auto 36px", color: C.muted, fontSize: 16, lineHeight: 1.7 }}>
          A dual-path consensus protocol that combines <strong style={{ color: C.teal }}>weighted quorums</strong> with{" "}
          <strong style={{ color: C.mint }}>object-level parallelism</strong>, achieving up to 12× throughput improvement
          while maintaining sub-millisecond latency and full linearizability.
        </p>
        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {[
            { num: "5–8×", desc: "Throughput Gain", color: C.teal },
            { num: "<1ms", desc: "Fast-Path Latency", color: C.mint },
            { num: "1 RTT", desc: "Fast Commit", color: C.amber },
            { num: "18×", desc: "Peak Speedup", color: "#a78bfa" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 28, fontWeight: 700, color: s.color }}>{s.num}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── OVERVIEW ─── */}
      <section id="overview" style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 24px" }}>
        <SectionTitle>The Problem</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
          <Card title="Global Consensus is Wasteful" color={C.coral}>
            <p style={pStyle}>Classical protocols like Paxos, Raft, and Cabinet enforce a <strong>single global ordering</strong> for all operations — even when operations are completely independent. A deposit to Account A and a withdrawal from Account B don't need global coordination, yet existing systems force them through one leader.</p>
          </Card>
          <Card title="Two Orthogonal Optimizations" color={C.teal}>
            <p style={pStyle}><strong>Weighted consensus</strong> (Cabinet) optimizes <em>who</em> participates — faster replicas get more voting power. <strong>Object-aware consensus</strong> (EPaxos) optimizes <em>what</em> needs coordination — independent objects skip global ordering. No prior protocol combines both.</p>
          </Card>
        </div>

        <SectionTitle>CORA's Solution</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { title: "Dual-Path Architecture", desc: "Independent objects use a leaderless fast path (1 RTT). Conflicting objects use a leader-coordinated slow path (2 RTT). The Object Manager routes dynamically.", color: C.teal, icon: "⚡" },
            { title: "Object-Weighted Quorums", desc: "Each object has its own weight vector across replicas. Replica R1 may be fast for ObjA but slow for ObjB — weights are per-object, not per-node.", color: C.mint, icon: "⚖️" },
            { title: "Adaptive Routing", desc: "Objects are classified as Independent, Common, or Hot based on live access patterns. Classification adapts continuously — no manual tuning needed.", color: C.amber, icon: "🔀" },
          ].map((c, i) => (
            <Card key={i} title={c.title} color={c.color}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
              <p style={pStyle}>{c.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── ARCHITECTURE ─── */}
      <section id="architecture" style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 24px" }}>
        <SectionTitle>System Architecture</SectionTitle>
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 28, marginBottom: 24 }}>
          <ArchitectureDiagram />
        </div>

        {/* Weight Example */}
        <SectionTitle sub>Object-Weighted Quorum Example</SectionTitle>
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
          <p style={{ ...pStyle, marginBottom: 16 }}>
            For 7 replicas with geometric ratio R=1.40, weights are assigned as <code style={codeStyle}>w_i = R^(n-1-i)</code>. 
            The threshold T = Σw/2 = 11.43. Since R1 + R2 = 12.91 &gt; 11.43, <strong style={{ color: C.mint }}>consensus needs only the 2 fastest replicas</strong> instead of 4 for majority.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[7.53,5.38,3.84,2.74,1.96,1.40,1.00].map((w, i) => (
              <div key={i} style={{ textAlign: "center", padding: "10px 14px", borderRadius: 8, background: i < 2 ? "rgba(6,214,160,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${i < 2 ? C.mint + "44" : "transparent"}`, minWidth: 60 }}>
                <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 16, color: i < 2 ? C.mint : C.muted }}>R{i + 1}</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: i < 2 ? C.mint : C.dim, marginTop: 4 }}>{w.toFixed(2)}</div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", padding: "0 12px" }}>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: C.amber }}>T = 11.43</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DEMO ─── */}
      <section id="demo" style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 24px" }}>
        <SectionTitle>Interactive Consensus Demo</SectionTitle>
        <p style={{ ...pStyle, marginBottom: 20, maxWidth: 720 }}>
          Watch CORA's dual-path consensus in action. Try all three scenarios to see how independent objects execute in parallel on the fast path, while conflicting operations are serialized through the leader on the slow path.
        </p>
        <ConsensusDemo />
      </section>

      {/* ─── ALGORITHMS ─── */}
      <section id="algorithms" style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 24px" }}>
        <SectionTitle>Protocol Algorithms</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
          <Card title="Fast Path — Object-Weighted Consensus" color={C.mint}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, lineHeight: 1.8, color: C.muted }}>
              {["1. Conflict Check — is object in-flight?","2. Self-Vote — add coordinator's object weight","3. Broadcast — send PROPOSE to all replicas","4. Accumulate — add each replica's object weight","5. Early Commit — weight ≥ threshold → commit!","↳ Fallback to slow path if timeout/conflict"].map((s, i) => (
                <div key={i} style={{ padding: "3px 0", borderLeft: `2px solid ${i < 5 ? C.mint + "44" : C.coral + "44"}`, paddingLeft: 10, marginBottom: 2 }}>
                  {s}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(6,214,160,0.08)", borderRadius: 6, fontSize: 12, color: C.mint }}>
              Any replica can coordinate. Completes in 1 RTT. No leader bottleneck.
            </div>
          </Card>
          <Card title="Slow Path — Node-Weighted Consensus" color={C.amber}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, lineHeight: 1.8, color: C.muted }}>
              {["1. Conflict Detection — shared in-flight map","2. Forward to Leader — if not leader, forward","3. FIFO Queue — leader enqueues for ordering","4. Priority Broadcast — send with node weights","5. Weighted Voting — accumulate priority sums","6. Commit & Update — commit + rotate priorities"].map((s, i) => (
                <div key={i} style={{ padding: "3px 0", borderLeft: `2px solid ${C.amber}44`, paddingLeft: 10, marginBottom: 2 }}>
                  {s}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(245,158,11,0.08)", borderRadius: 6, fontSize: 12, color: C.amber }}>
              Leader-coordinated. 2 RTT. Guarantees linearizability for shared objects.
            </div>
          </Card>
        </div>

        {/* Correctness */}
        <SectionTitle sub>Correctness Guarantees</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { t: "Thm 1", d: "Fast-Path Quorum Intersection", c: "Any two fast-path quorums on the same object must overlap." },
            { t: "Thm 2", d: "Cross-Path Consistency", c: "Same-object ops cannot commit via different paths simultaneously." },
            { t: "Thm 3", d: "Linearizability", c: "All operations admit a total order consistent with real-time precedence." },
            { t: "Thm 4", d: "Liveness", c: "If top t+1 replicas are responsive, every operation eventually commits." },
          ].map((th, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 12px" }}>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.teal, fontWeight: 600 }}>{th.t}</div>
              <div style={{ fontFamily: "'DM Serif Display'", fontSize: 14, color: C.white, margin: "4px 0 6px" }}>{th.d}</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{th.c}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── EVALUATION ─── */}
      <section id="evaluation" style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 24px 80px" }}>
        <SectionTitle>Evaluation Results</SectionTitle>
        <p style={{ ...pStyle, marginBottom: 20, maxWidth: 720 }}>
          Evaluated on Compute Canada Cloud (4 vCPU, 8GB RAM, 10 Gbps) against Cabinet across 7 dimensions.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Throughput by Cluster Size */}
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 14px" }}>
            <div style={{ fontFamily: "'DM Serif Display'", fontSize: 16, color: C.white, marginBottom: 4 }}>Throughput by Cluster Size</div>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 14 }}>Fig 9a: c=2, 95% independent, 512B</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tptData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.4)" />
                <XAxis dataKey="n" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.dim }} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.dim }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="CORA" fill={C.teal} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cabinet" fill={C.dim} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Conflict Rate */}
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 14px" }}>
            <div style={{ fontFamily: "'DM Serif Display'", fontSize: 16, color: C.white, marginBottom: 4 }}>Conflict Rate Sensitivity</div>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 14 }}>Fig 8a: n=7, c=2, 512B</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={conflictData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.4)" />
                <XAxis dataKey="rate" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.dim }} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.dim }} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="CORA" stroke={C.teal} strokeWidth={2.5} dot={{ r: 4, fill: C.teal }} />
                <Line type="monotone" dataKey="Cabinet" stroke={C.dim} strokeWidth={2.5} dot={{ r: 4, fill: C.dim }} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Performance Table */}
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 20px", marginTop: 20 }}>
          <div style={{ fontFamily: "'DM Serif Display'", fontSize: 16, color: C.white, marginBottom: 12 }}>Peak Pipelined Performance (Table 3)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "JetBrains Mono", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.dim}` }}>
                {["Cluster", "Max-Inflight", "CORA (kTx/s)", "Latency (ms)", "Cabinet (kTx/s)", "Speedup"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: C.muted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { n: "n=3", inf: 50, cora: "24.74", lat: "3.91", cab: "1.38", sp: "18.0×" },
                { n: "n=5", inf: 40, cora: "18.07", lat: "3.92", cab: "1.52", sp: "11.9×" },
                { n: "n=7", inf: 45, cora: "15.38", lat: "4.89", cab: "1.50", sp: "10.3×" },
                { n: "n=11", inf: 40, cora: "10.81", lat: "6.20", cab: "1.46", sp: "7.4×" },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid rgba(61,82,120,0.3)` }}>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: C.white, fontWeight: 600 }}>{r.n}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: C.muted }}>{r.inf}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: C.teal, fontWeight: 600 }}>{r.cora}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: C.muted }}>{r.lat}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: C.dim }}>{r.cab}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <span style={{ background: "rgba(6,214,160,0.12)", color: C.mint, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{r.sp}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "24px", textAlign: "center", color: C.dim, fontSize: 12 }}>
        <div style={{ fontFamily: "'DM Serif Display'", fontSize: 16, color: C.muted, marginBottom: 4 }}>CORA</div>
        Adaptive Object Weighted Consensus made Efficient · 2026
      </footer>
    </div>
  );
}

// ─── Helpers ───
function SectionTitle({ children, sub }) {
  return (
    <h2 style={{ fontFamily: "'DM Serif Display'", fontSize: sub ? 20 : 28, color: C.white, margin: `0 0 ${sub ? 14 : 20}px`,
      paddingBottom: sub ? 0 : 12, borderBottom: sub ? "none" : `1px solid ${C.border}` }}>
      {children}
    </h2>
  );
}

function Card({ title, color, children }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "18px 16px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontFamily: "'DM Serif Display'", fontSize: 16, color: C.white, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

const pStyle = { color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 };
const codeStyle = { fontFamily: "JetBrains Mono", fontSize: 12, background: "rgba(8,145,178,0.1)", padding: "2px 6px", borderRadius: 4, color: C.teal };

function ArchitectureDiagram() {
  const boxStyle = (color, w = 160) => ({
    display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${color}44`, background: `${color}11`,
    minWidth: w, textAlign: "center",
  });
  return (
    <div style={{ textAlign: "center" }}>
      {/* Clients */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 6, fontFamily: "JetBrains Mono", textTransform: "uppercase", letterSpacing: 1 }}>Client Layer</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          {["C1", "C2", "C3", "...Cn"].map(c => (
            <div key={c} style={{ padding: "6px 16px", borderRadius: 6, background: "rgba(139,154,181,0.1)", border: `1px solid ${C.dim}44`, fontFamily: "JetBrains Mono", fontSize: 12, color: C.muted }}>
              {c}
            </div>
          ))}
        </div>
      </div>
      <div style={{ color: C.dim, fontSize: 20, marginBottom: 12 }}>↓</div>
      {/* Consensus Layer */}
      <div style={{ background: "rgba(8,145,178,0.04)", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20, display: "inline-block" }}>
        <div style={{ color: C.teal, fontSize: 11, marginBottom: 12, fontFamily: "JetBrains Mono", textTransform: "uppercase", letterSpacing: 1 }}>Consensus Layer</div>
        <div style={{ marginBottom: 14 }}>
          <div style={boxStyle(C.amber, 240)}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.amber }}>Object Manager</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Classifies & routes objects</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          <div style={boxStyle(C.mint, 200)}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.mint }}>Fast Path</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Object-Weighted Quorums</div>
            <div style={{ fontSize: 10, color: C.mint, marginTop: 2 }}>Parallel · Leaderless · 1 RTT</div>
          </div>
          <div style={boxStyle(C.amber, 200)}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.amber }}>Slow Path</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Node-Weighted Quorums</div>
            <div style={{ fontSize: 10, color: C.amber, marginTop: 2 }}>Leader-Coordinated · 2 RTT</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={boxStyle("#8b5cf6", 200)}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: "#8b5cf6" }}>Commit Manager → RSM</div>
          </div>
        </div>
      </div>
      <div style={{ color: C.dim, fontSize: 20, marginBottom: 12 }}>↓</div>
      {/* Apps */}
      <div>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 6, fontFamily: "JetBrains Mono", textTransform: "uppercase", letterSpacing: 1 }}>Applications</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {["Databases", "Blockchain", "File Systems", "KV Stores", "ML Params"].map(a => (
            <div key={a} style={{ padding: "5px 14px", borderRadius: 6, background: "rgba(139,154,181,0.06)", border: `1px solid ${C.dim}33`, fontSize: 11, color: C.dim }}>
              {a}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}