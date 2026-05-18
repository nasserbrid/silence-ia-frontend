// ============================================================
// Nicolas IA - Coach IA de prise de parole (organisme Silence)
// Version responsive — mobile-only overrides, desktop intact
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import { applyMob, transformSession, extractScore, extractCitation, extractSynthese, fmtTime } from "./src/utils.js";

// La clé API est gérée côté serveur
const STORAGE_KEY = "nicolas-ia-history";
const USER_KEY = "nicolas-ia-user";
const MIN_RECORDING_SEC = 60;

// ============================================================
// HOOK — détection mobile (≤ 768px), sans effet sur desktop
// ============================================================
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// ============================================================
// MEDIAPIPE
// ============================================================
let mediapipeVision = null;
let mediapipeLoadAttempted = false;

const loadMediaPipe = async () => {
  if (mediapipeVision) return mediapipeVision;
  if (mediapipeLoadAttempted) return null;
  mediapipeLoadAttempted = true;
  try {
    const loadPromise = (async () => {
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9");
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
      );
      const faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
        outputFaceBlendshapes: true, runningMode: "VIDEO", numFaces: 1,
      });
      const handLandmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO", numHands: 2,
      });
      const poseLandmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate: "GPU" },
        runningMode: "VIDEO", numPoses: 1,
      });
      mediapipeVision = { faceLandmarker, handLandmarker, poseLandmarker };
      return mediapipeVision;
    })();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("MediaPipe timeout")), 10000));
    return await Promise.race([loadPromise, timeoutPromise]);
  } catch (e) { console.warn("MediaPipe non disponible:", e.message); return null; }
};

const COLOR_DARK = "#000000";
const COLOR_DARK_2 = "#0f0f0f";
const COLOR_GOLD = "#c9a961";
const COLOR_GOLD_LIGHT = "#e0c896";
const COLOR_GOLD_DARK = "#a8893f";
const COLOR_TEXT = "#f5f1e8";
const COLOR_TEXT_MUTED = "#9ba3b4";

// ============================================================
// ICONES SVG
// ============================================================
const Icon = ({ size, color, children }) => (
  <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Mic = (p) => (<Icon {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></Icon>);
const Square = (p) => (<svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill={p.color || "currentColor"}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>);
const RotateCcw = (p) => (<Icon {...p}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></Icon>);
const Sparkles = (p) => (<Icon {...p}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" /></Icon>);
const Loader2 = (p) => (<Icon {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></Icon>);
const AlertCircle = (p) => (<Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>);
const Clock = (p) => (<Icon {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Icon>);
const MessageSquare = (p) => (<Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>);
const Download = (p) => (<Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Icon>);
const CheckCircle = (p) => (<Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Icon>);
const ArrowRight = (p) => (<Icon {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Icon>);
const Award = (p) => (<Icon {...p}><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></Icon>);
const HistoryIcon = (p) => (<Icon {...p}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></Icon>);
const TrashIcon = (p) => (<Icon {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /></Icon>);
const ChevronLeft = (p) => (<Icon {...p}><polyline points="15 18 9 12 15 6" /></Icon>);
const HeadphonesIcon = (p) => (<Icon {...p}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></Icon>);

// ============================================================
// STYLES DESKTOP (identiques à la version précédente — inchangés)
// ============================================================
const styles = {
  app: { minHeight: "100vh", background: "radial-gradient(ellipse at top, #1a1a1a 0%, #000000 70%)", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", color: COLOR_TEXT, display: "flex", flexDirection: "column" },
  container: { maxWidth: 1100, margin: "0 auto", padding: "32px 24px", width: "100%", boxSizing: "border-box", flex: 1, display: "flex", flexDirection: "column" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 },
  logoTitle: { fontSize: 22, fontWeight: 700, margin: 0, color: COLOR_TEXT, cursor: "pointer" },
  btn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "1px solid transparent", cursor: "pointer", fontFamily: "inherit", touchAction: "manipulation" },
  btnPrimary: { background: "linear-gradient(135deg, #c9a961, #a8893f)", color: COLOR_DARK, padding: "14px 28px", fontWeight: 600 },
  btnSecondary: { background: "transparent", color: COLOR_TEXT, border: "1px solid #c9a96166" },
  btnDanger: { background: "#dc2626", color: "white", padding: "14px 28px", fontWeight: 600 },
  videoWrap: { position: "relative", background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "16/9", border: "1px solid #c9a96133" },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  card: { maxWidth: 520, margin: "0 auto", background: "#0f0f0fcc", border: "1px solid #c9a96133", borderRadius: 12, padding: 36 },
  input: { width: "100%", padding: 12, fontSize: 14, background: COLOR_DARK_2, color: COLOR_TEXT, border: "1px solid #c9a96166", borderRadius: 8, marginBottom: 12, boxSizing: "border-box", fontFamily: "inherit" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: COLOR_GOLD, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, marginTop: 20 },
  selectGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 12 },
  selectOption: { padding: "12px 14px", background: COLOR_DARK_2, border: "1px solid #c9a96133", borderRadius: 8, color: COLOR_TEXT, fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
  selectOptionActive: { background: "#c9a96122", borderColor: COLOR_GOLD, color: COLOR_GOLD },
  error: { padding: 12, background: "#dc262611", border: "1px solid #dc262666", borderRadius: 8, fontSize: 13, color: "#fca5a5", marginBottom: 16 },
  resultsBox: { background: "#fafaf7", color: "#1a1a1a", border: "2px solid " + COLOR_GOLD, borderRadius: 12, padding: 40 },
  featureCard: { background: "#0f0f0fcc", border: "1px solid #c9a96122", borderRadius: 12, padding: 20 },
};

// ============================================================
// CSS GLOBAL — animations + viewport meta (critique pour mobile)
// ============================================================
if (typeof document !== "undefined" && !document.getElementById("nicolas-ia-anim")) {
  if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
    document.head.appendChild(meta);
  }
  const styleEl = document.createElement("style");
  styleEl.id = "nicolas-ia-anim";
  styleEl.innerHTML =
    "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}" +
    "@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}" +
    "@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,169,97,.3)}50%{box-shadow:0 0 30px rgba(201,169,97,.6)}}" +
    "@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}" +
    "html,body{background:#000;margin:0;padding:0;min-height:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;}" +
    "#root{min-height:100vh;}" +
    ".fade-in-up{animation:fadeInUp .5s ease-out;}" +
    // Tableaux résultats : scroll horizontal sur mobile
    "@media(max-width:768px){" +
    ".nia-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}" +
    ".nia-table-wrap table{min-width:480px;font-size:12px;}" +
    "input,select,textarea{font-size:16px!important;}" + // évite le zoom auto iOS
    "}";
  document.head.appendChild(styleEl);
}

const TYPES_DISCOURS = [
  { id: "pitch", label: "Pitch", icon: "🎯", desc: "Convaincre, présenter un projet" },
  { id: "presentation_pro", label: "Présentation pro", icon: "💼", desc: "Présentation interne, comité" },
  { id: "reunion", label: "Réunion", icon: "🤝", desc: "Prise de parole en réunion d'équipe" },
  { id: "storytelling", label: "Storytelling", icon: "📖", desc: "Récit personnel, parcours" },
  { id: "officiel", label: "Officiel", icon: "🏛️", desc: "Discours institutionnel, cérémonie" },
  { id: "eloquence", label: "Éloquence", icon: "🎤", desc: "Performance oratoire, joute verbale" },
];

const ANALYZING_STEPS = [
  { label: "Transcription du discours", icon: "📝", duration: 1500 },
  { label: "Analyse du langage non-verbal", icon: "👁️", duration: 1800 },
  { label: "Évaluation rhétorique", icon: "💬", duration: 2000 },
  { label: "Génération du rapport", icon: "✨", duration: 2500 },
];


// ============================================================
// COMPOSANT : BANNIÈRE MICRO
// ============================================================
function MicBanner({ isMobile }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{
      background: "linear-gradient(135deg, #1a0d00 0%, #0f0a00 100%)",
      border: "1.5px solid " + COLOR_GOLD,
      borderRadius: isMobile ? 10 : 12,
      padding: isMobile ? "11px 12px" : "16px 20px",
      marginBottom: isMobile ? 16 : 24,
      display: "flex", alignItems: "flex-start", gap: isMobile ? 10 : 14,
      position: "relative", boxShadow: "0 0 24px " + COLOR_GOLD + "22",
    }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: COLOR_GOLD + "22", border: "1.5px solid " + COLOR_GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <HeadphonesIcon size={17} color={COLOR_GOLD} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, color: COLOR_GOLD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          🎧 Équipez-vous avant de commencer
        </div>
        <div style={{ fontSize: isMobile ? 12 : 13, color: COLOR_TEXT, lineHeight: 1.55 }}>
          Portez des <strong style={{ color: COLOR_GOLD_LIGHT }}>écouteurs avec micro</strong> ou un <strong style={{ color: COLOR_GOLD_LIGHT }}>micro USB</strong>. Le micro intégré capte mal la voix à distance.
        </div>
      </div>
      <button onClick={() => setDismissed(true)} style={{ background: "transparent", border: "none", color: COLOR_TEXT_MUTED, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 2px", flexShrink: 0, touchAction: "manipulation" }}>×</button>
    </div>
  );
}

// ============================================================
// COMPOSANT : ÉCRAN ANALYSE ANIMÉE
// ============================================================
function AnalyzingScreen({ isMobile }) {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const timers = [];
    let cumulative = 0;
    ANALYZING_STEPS.forEach((step, i) => {
      cumulative += step.duration;
      timers.push(setTimeout(() => setStepIdx(i + 1), cumulative));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fade-in-up" style={{ textAlign: "center", padding: isMobile ? "20px 8px" : "40px 20px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ width: isMobile ? 60 : 80, height: isMobile ? 60 : 80, margin: "0 auto " + (isMobile ? "18px" : "28px"), borderRadius: "50%", background: "radial-gradient(circle,#c9a96133 0%,transparent 70%)", display: "flex", alignItems: "center", justifyContent: "center", animation: "float 2.5s ease-in-out infinite" }}>
        <Sparkles size={isMobile ? 28 : 40} color={COLOR_GOLD} />
      </div>
      <h2 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, margin: "0 0 8px" }}>Nicolas analyse votre prestation</h2>
      <p style={{ color: COLOR_TEXT_MUTED, fontSize: isMobile ? 13 : 14, marginBottom: isMobile ? 20 : 36 }}>Quelques secondes pour décortiquer chaque détail…</p>
      <div style={{ background: "#0f0f0fcc", border: "1px solid #c9a96133", borderRadius: 14, padding: isMobile ? "14px 14px" : "24px 28px", textAlign: "left" }}>
        {ANALYZING_STEPS.map((step, i) => {
          const isDone = i < stepIdx, isActive = i === stepIdx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, padding: isMobile ? "9px 0" : "12px 0", borderBottom: i < ANALYZING_STEPS.length - 1 ? "1px solid #c9a96111" : "none", opacity: i > stepIdx ? 0.4 : 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? "#c9a96122" : isActive ? "#c9a96133" : "transparent", border: "1.5px solid " + (isDone || isActive ? COLOR_GOLD : "#9ba3b444"), fontSize: 16, animation: isActive ? "glow 1.5s ease-in-out infinite" : "none", flexShrink: 0 }}>
                {isDone ? <CheckCircle size={15} color={COLOR_GOLD} /> : isActive ? <Loader2 size={15} color={COLOR_GOLD} /> : <span>{step.icon}</span>}
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: isActive ? 600 : 500, color: isActive ? COLOR_GOLD : isDone ? COLOR_TEXT : COLOR_TEXT_MUTED }}>{step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// COMPOSANT : SCORE EN POURCENTAGE
// ============================================================
function GlobalScoreBanner({ score, syntheseLine, isMobile }) {
  if (score === null || score === undefined) return null;
  const pct = Math.round(score);
  let color = "#dc2626", qualifier = "À reconstruire ensemble", bgGradient = "linear-gradient(135deg,#1a0a0a 0%,#0f0f0f 100%)";
  if (pct >= 90) { color = "#10b981"; qualifier = "Performance exceptionnelle"; bgGradient = "linear-gradient(135deg,#0a1a0f 0%,#0f0f0f 100%)"; }
  else if (pct >= 75) { color = "#22c55e"; qualifier = "Très belle prestation"; bgGradient = "linear-gradient(135deg,#0a1a0f 0%,#0f0f0f 100%)"; }
  else if (pct >= 60) { color = COLOR_GOLD; qualifier = "Bonne prestation à enrichir"; bgGradient = "linear-gradient(135deg,#1a1505 0%,#0f0f0f 100%)"; }
  else if (pct >= 45) { color = "#f59e0b"; qualifier = "Socle correct, axes de progrès"; bgGradient = "linear-gradient(135deg,#1a1005 0%,#0f0f0f 100%)"; }
  else if (pct >= 30) { color = "#ef4444"; qualifier = "Plusieurs leviers à activer"; bgGradient = "linear-gradient(135deg,#1a0a0a 0%,#0f0f0f 100%)"; }

  const sz = isMobile ? 110 : 140;
  const r = isMobile ? 44 : 56;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{
      background: bgGradient,
      borderRadius: isMobile ? 12 : 16,
      padding: isMobile ? "18px 16px" : "32px 36px",
      marginBottom: isMobile ? 14 : 28,
      display: "flex",
      // Mobile : colonne centrée / Desktop : ligne (aucun changement desktop)
      flexDirection: isMobile ? "column" : "row",
      alignItems: "center",
      gap: isMobile ? 12 : 36,
      textAlign: isMobile ? "center" : "left",
      border: "2px solid " + color + "66",
      boxShadow: "0 0 40px " + color + "22",
    }}>
      <div style={{ position: "relative", width: sz, height: sz, flexShrink: 0 }}>
        <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.5s ease-out", filter: "drop-shadow(0 0 8px " + color + "88)" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: isMobile ? 30 : 38, fontWeight: 700, color, lineHeight: 1 }}>{pct}<span style={{ fontSize: isMobile ? 16 : 22, marginLeft: 1 }}>%</span></div>
          <div style={{ fontSize: 10, color: COLOR_TEXT_MUTED, marginTop: 3, letterSpacing: "0.05em", textTransform: "uppercase" }}>Score global</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6, justifyContent: isMobile ? "center" : "flex-start" }}>
          <Award size={13} color={color} /> Votre prestation
        </div>
        <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: "0 0 6px", color: COLOR_TEXT }}>{qualifier}</h2>
        {syntheseLine && <p style={{ fontSize: isMobile ? 12 : 14, color: COLOR_TEXT_MUTED, margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>{syntheseLine}</p>}
      </div>
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function App() {
  const isMobile = useIsMobile();
  const M = (desktop, extra) => applyMob(isMobile, desktop, extra); // alias local

  const [phase, setPhase] = useState("login");
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMode, setLoginMode] = useState("login");
  // apiKey gérée côté serveur
  const [stream, setStream] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [soundDetected, setSoundDetected] = useState(false);
  const [liveWordCount, setLiveWordCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [permissionError, setPermissionError] = useState(false);
  const [dureeMin, setDureeMin] = useState("");
  const [typeDiscours, setTypeDiscours] = useState(null);
  const [history, setHistory] = useState([]);
  const [viewingSession, setViewingSession] = useState(null);
  const [liveVisual, setLiveVisual] = useState({ regard: 0, posture: 0, gestuelle: 0, sourire: 0 });
  const [mediapipeReady, setMediapipeReady] = useState(false);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const capturedFramesRef = useRef([]);
  const frameIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const audioLevelHistoryRef = useRef([]);
  const audioAnalyserRef = useRef(null);
  const audioMonitorIntervalRef = useRef(null);
  const indicatorHistoryRef = useRef({ regard: [], posture: [], gestuelle: [], sourire: [] });
  const liveVisualRef = useRef({ regard: 0, posture: 0, gestuelle: 0, sourire: 0 });
  const animationFrameRef = useRef(null);
  const transcriptStateRef = useRef({ recording: false });

  useEffect(() => {
    const token = localStorage.getItem("nicolas-ia-token");
    if (!token) return;
    fetch("/auth/me", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { localStorage.removeItem("nicolas-ia-token"); return; }
        setUser(u); setPhase("welcome");
        fetch("/api/history", { headers: { Authorization: "Bearer " + token } })
          .then(r => r.ok ? r.json() : [])
          .then(sessions => setHistory(sessions.map(transformSession)));
      })
      .catch(() => localStorage.removeItem("nicolas-ia-token"));
  }, []);


  const handleLogin = async () => {
    setError("");
    if (!loginEmail || !loginPassword) { setError("Email et mot de passe requis."); return; }
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.detail || "Identifiants incorrects."); return; }
      const { access_token } = await res.json();
      localStorage.setItem("nicolas-ia-token", access_token);
      const meRes = await fetch("/auth/me", { headers: { Authorization: "Bearer " + access_token } });
      const u = await meRes.json();
      setUser(u);
      const hRes = await fetch("/api/history", { headers: { Authorization: "Bearer " + access_token } });
      const sessions = hRes.ok ? await hRes.json() : [];
      setHistory(sessions.map(transformSession));
      setLoginEmail(""); setLoginPassword(""); setPhase("welcome");
    } catch (err) { setError("Erreur de connexion. Veuillez réessayer."); }
  };

  const handleLogout = () => {
    if (!window.confirm("Se déconnecter ?")) return;
    localStorage.removeItem("nicolas-ia-token");
    setUser(null); setHistory([]); setPhase("login");
  };

  const saveHistory = async (session) => {
    const token = localStorage.getItem("nicolas-ia-token");
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(session),
      });
      if (res.ok) { const saved = await res.json(); setHistory(prev => [transformSession(saved), ...prev]); }
    } catch (e) {}
  };
  const deleteSession = async (id) => {
    if (!window.confirm("Supprimer cette analyse ?")) return;
    const token = localStorage.getItem("nicolas-ia-token");
    try {
      await fetch("/api/history/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      setHistory(prev => prev.filter(s => s.id !== id));
      if (viewingSession?.id === id) setViewingSession(null);
    } catch (e) {}
  };
  const clearAllHistory = async () => {
    if (!window.confirm("Supprimer TOUTES les analyses ?")) return;
    const token = localStorage.getItem("nicolas-ia-token");
    try {
      await Promise.all(history.map(s => fetch("/api/history/" + s.id, { method: "DELETE", headers: { Authorization: "Bearer " + token } })));
      setHistory([]); setViewingSession(null);
    } catch (e) {}
  };

  const submitSetup = () => {
    if (!typeDiscours) { setError("Choisissez un type de discours."); return; }
    if (!dureeMin || parseFloat(dureeMin) <= 0) { setError("Indiquez une durée valide."); return; }
    setError(""); requestPermissions();
  };

  const requestPermissions = async () => {
    setPermissionError(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setError("Navigateur non compatible. Utilisez Chrome ou Safari."); setPermissionError(true); setPhase("setup"); return; }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1, sampleSize: 16 } });
      setStream(mediaStream); setPhase("ready");
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = mediaStream; videoRef.current.play().catch(() => {}); } setupAudio(mediaStream); initSpeechRecognition(); }, 100);
    } catch (err) {
      let msg = "Impossible d'accéder à la caméra/micro.";
      if (err.name === "NotAllowedError") msg = "Accès refusé. Autorisez caméra + micro dans les réglages.";
      else if (err.name === "NotFoundError") msg = "Aucune caméra ou micro détecté.";
      else if (err.name === "NotReadableError") msg = "Caméra utilisée par une autre application.";
      setError(msg); setPermissionError(true); setPhase("setup");
    }
  };

  const setupAudio = async (mediaStream) => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(mediaStream);
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 80;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 9000;
      const gn = ac.createGain(); gn.gain.value = 15;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -50; comp.knee.value = 40; comp.ratio.value = 12; comp.attack.value = 0; comp.release.value = 0.25;
      const an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.3;
      src.connect(hp); hp.connect(lp); lp.connect(gn); gn.connect(comp); comp.connect(an);
      audioAnalyserRef.current = an;
    } catch (e) { console.warn("Audio setup:", e); }
    const mp = await loadMediaPipe();
    if (mp) { setMediapipeReady(true); startVisualAnalysis(mp); } else setMediapipeReady(false);
  };

  const startVisualAnalysis = (mp) => {
    indicatorHistoryRef.current = { regard: [], posture: [], gestuelle: [], sourire: [] };
    let rS = 0, pS = 0, gS = 0, sS = 0;
    const SM = 0.3;
    let fc = 0, hh = [];
    let tF = 0, fEA = 0, fSm = 0, fHV = 0, fGP = 0;
    const tick = () => {
      let re = 0, po = 0, ge = 0, so = 0, fd = false;
      if (videoRef.current?.videoWidth > 0) {
        try {
          const now = performance.now();
          const fr = mp.faceLandmarker.detectForVideo(videoRef.current, now);
          if (fr.faceLandmarks?.length) {
            fd = true; tF++;
            const lm = fr.faceLandmarks[0], bs = fr.faceBlendshapes?.[0]?.categories || [];
            const bv = (n) => (bs.find((b) => b.categoryName === n) || {}).score || 0;
            const yaw = Math.abs(lm[1].x - (lm[33].x + lm[263].x) / 2);
            const ff = yaw < 0.015 ? 1 : Math.max(0, 1 - (yaw - 0.015) * 30);
            const gi = Math.max(bv("eyeLookOutLeft"), bv("eyeLookOutRight"), bv("eyeLookInLeft"), bv("eyeLookInRight"), bv("eyeLookDownLeft"), bv("eyeLookDownRight"), bv("eyeLookUpLeft"), bv("eyeLookUpRight"));
            if (gi > 0.5) fEA++;
            re = (ff * 0.4 + (1 - fEA / tF) * 0.6) * 100;
            if (ff > 0.8 && gi < 0.3) re = Math.min(100, re * 1.1);
            const sa = (bv("mouthSmileLeft") + bv("mouthSmileRight")) / 2, ca = (bv("cheekSquintLeft") + bv("cheekSquintRight")) / 2;
            if (sa > 0.25 && (ca > 0.05 || sa > 0.5) && bv("jawOpen") < 0.4) fSm++;
            so = Math.min(100, (fSm / tF) * 333);
          }
          if (mp.poseLandmarker) {
            const pr = mp.poseLandmarker.detectForVideo(videoRef.current, now);
            if (pr.landmarks?.[0]) {
              const p = pr.landmarks[0], ls = p[11], rs = p[12], ns = p[0];
              if (ls?.visibility > 0.5) {
                const sl = Math.abs(ls.y - rs.y) < 0.04 ? 1 : Math.max(0, 1 - (Math.abs(ls.y - rs.y) - 0.04) * 15);
                const hc = Math.abs(ns.x - (ls.x + rs.x) / 2) < 0.05 ? 1 : Math.max(0, 1 - (Math.abs(ns.x - (ls.x + rs.x) / 2) - 0.05) * 12);
                const sw = Math.abs(ls.x - rs.x), gd = sw > 0.2 && sw < 0.5 ? 1 : sw >= 0.15 && sw <= 0.6 ? 0.7 : 0.4;
                if (sl * 0.4 + hc * 0.35 + gd * 0.25 > 0.7) fGP++;
                po = tF > 0 ? (fGP / tF) * 100 : 0;
              }
            }
          }
          const hr = mp.handLandmarker.detectForVideo(videoRef.current, now);
          if (hr.landmarks?.length) {
            fHV++;
            hh.push(hr.landmarks.map((h) => ({ x: h[9].x, y: h[9].y })));
            if (hh.length > 90) hh.shift();
            const rec = hh.slice(-30); let tm = 0, cp = 0;
            for (let i = 1; i < rec.length; i++) { const ml = Math.min(rec[i - 1].length, rec[i].length); for (let j = 0; j < ml; j++) { tm += Math.hypot(rec[i][j].x - rec[i - 1][j].x, rec[i][j].y - rec[i - 1][j].y); cp++; } }
            ge = (Math.min(1, (tF > 0 ? fHV / tF : 0) * 1.6) * 0.5 + Math.min(1, (cp > 0 ? tm / cp : 0) * 50) * 0.5) * 100;
          } else { hh.push([]); if (hh.length > 90) hh.shift(); ge = Math.min(60, tF > 0 ? (fHV / tF) * 100 : 0); }
        } catch (e) {}
      }
      rS = rS * (1 - SM) + re * SM; pS = pS * (1 - SM) + po * SM; gS = gS * (1 - SM) + ge * SM; sS = sS * (1 - SM) + so * SM;
      const nv = { regard: Math.round(rS), posture: Math.round(pS), gestuelle: Math.round(gS), sourire: Math.round(sS) };
      liveVisualRef.current = nv; setLiveVisual(nv);
      fc++;
      if (fc % 5 === 0 && fd && transcriptStateRef.current.recording) {
        indicatorHistoryRef.current.regard.push(nv.regard); indicatorHistoryRef.current.posture.push(nv.posture);
        indicatorHistoryRef.current.gestuelle.push(nv.gestuelle); indicatorHistoryRef.current.sourire.push(nv.sourire);
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const initSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 3; rec.lang = "fr-FR";
    rec.onresult = (event) => {
      let interim = ""; const final = [];
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) { let b = r[0].transcript, bc = r[0].confidence || 0; for (let j = 1; j < r.length; j++) if ((r[j].confidence || 0) > bc) { bc = r[j].confidence; b = r[j].transcript; } final.push(b.trim()); }
        else if (i >= event.resultIndex) interim += r[0].transcript + " ";
      }
      if (!transcriptStateRef.current.recording) return;
      const full = final.join(" ") + (interim.trim() ? " " + interim.trim() : "");
      transcriptRef.current = full; setLiveWordCount(full.split(/\s+/).filter(Boolean).length);
    };
    rec.onerror = (e) => { const d = e.error === "network" ? 2000 : e.error === "no-speech" ? 500 : 300; if (e.error !== "audio-capture" && e.error !== "not-allowed") setTimeout(() => { try { rec.start(); } catch (_) {} }, d); };
    rec.onend = () => { setTimeout(() => { try { rec.start(); } catch (_) {} }, 100); };
    try { rec.start(); } catch (e) {}
    recognitionRef.current = rec;
  };

  const startRecording = () => {
    if (!stream) return;
    setCountdown(3); setTimeout(() => setCountdown(2), 1000); setTimeout(() => setCountdown(1), 2000); setTimeout(() => { setCountdown(0); doStartRecording(); }, 3000);
  };

  const doStartRecording = () => {
    chunksRef.current = []; capturedFramesRef.current = []; audioLevelHistoryRef.current = [];
    transcriptRef.current = ""; transcriptStateRef.current.recording = true;
    setSoundDetected(false); setLiveWordCount(0);
    try { recognitionRef.current?.start(); } catch (e) {}
    const rec = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start(); mediaRecorderRef.current = rec; setRecordingTime(0); setPhase("recording");
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 288;
    const ctx = canvas.getContext("2d");
    frameIntervalRef.current = setInterval(() => { if (videoRef.current?.videoWidth > 0) try { ctx.drawImage(videoRef.current, 0, 0, 512, 288); capturedFramesRef.current.push(canvas.toDataURL("image/jpeg", 0.6).split(",")[1]); } catch (e) {} }, 1000);
    if (audioAnalyserRef.current) {
      const da = new Uint8Array(audioAnalyserRef.current.frequencyBinCount);
      audioMonitorIntervalRef.current = setInterval(() => { audioAnalyserRef.current.getByteFrequencyData(da); const avg = da.reduce((a, b) => a + b, 0) / da.length; audioLevelHistoryRef.current.push(avg); if (avg > 0.8) setSoundDetected(true); }, 200);
    }
    const maxSec = Math.round(parseFloat(dureeMin) * 60) + 5;
    timerRef.current = setInterval(() => setRecordingTime((t) => { if (t + 1 >= maxSec) setTimeout(() => stopRecording(), 100); return t + 1; }), 1000);
  };

  const stopRecording = async () => {
    if (recordingTime < MIN_RECORDING_SEC) { alert("Encore " + (MIN_RECORDING_SEC - recordingTime) + "s minimum (1 minute requise)."); return; }
    transcriptStateRef.current.recording = false;
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop();
    setTimeout(() => { try { recognitionRef.current?.stop(); } catch (e) {} }, 400);
    [timerRef, frameIntervalRef, audioMonitorIntervalRef].forEach((r) => { if (r.current) clearInterval(r.current); });
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setPhase("analyzing");
    await new Promise((r) => setTimeout(r, 1500));
    stream?.getTracks().forEach((t) => t.stop());
    await analyzeRecording();
  };

  const analyzeRecording = async () => {
    try {
      const allF = capturedFramesRef.current;
      if (!allF.length) { setError("Aucune image capturée."); setPhase("welcome"); return; }
      const NB = 4;
      const sel = allF.length <= NB ? allF : Array.from({ length: NB }, (_, i) => allF[Math.floor(i * allF.length / NB)]);
      const transcript = transcriptRef.current.trim() || "[Transcription vide]";
      const typeLabel = TYPES_DISCOURS.find((t) => t.id === typeDiscours)?.label || "Non précisé";
      const lv = audioLevelHistoryRef.current;
      let audioStats = {};
      if (lv.length) {
        const dur = (lv.length / 5).toFixed(0), avg = lv.reduce((a, b) => a + b, 0) / lv.length;
        const wc = transcript.split(/\s+/).filter(Boolean).length, wpm = dur > 0 ? Math.round((wc / dur) * 60) : 0;
        audioStats = { duree_sec: parseInt(dur), wc, debit: wpm < 100 ? "posé" : wpm < 170 ? "fluide" : "rapide", volume: avg < 15 ? "doux" : avg > 70 ? "puissant" : "posé" };
      }
      const vh = indicatorHistoryRef.current;
      const av = (a) => a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0;
      const visualStats = vh.regard.length ? { regard: av(vh.regard), posture: av(vh.posture), gestuelle: av(vh.gestuelle), sourire: av(vh.sourire) } : {};

      const token = localStorage.getItem("nicolas-ia-token");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ type_discours: typeDiscours, type_discours_label: typeLabel, duree_min: dureeMin, transcript, images: sel, audio_stats: audioStats, visual_stats: visualStats }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "HTTP " + res.status); }
      const data = await res.json();
      const text = data.analyse;
      setAnalysis(text);
      await saveHistory({ type_discours: typeDiscours, type_discours_label: typeLabel, duree_prevue_min: parseFloat(dureeMin), duree_effective_sec: recordingTime, transcription: transcript, analyse: text, word_count: transcript.split(/\s+/).filter(Boolean).length });
      setPhase("results");
    } catch (err) { setError("Erreur : " + err.message); setPhase("welcome"); }
  };

  const reset = () => {
    stream?.getTracks().forEach((t) => t.stop());
    [timerRef, frameIntervalRef, audioMonitorIntervalRef].forEach((r) => { if (r.current) clearInterval(r.current); });
    try { recognitionRef.current?.stop(); } catch (e) {}
    setStream(null); setAnalysis(""); setRecordingTime(0); setError(""); setTypeDiscours(null); setDureeMin(""); setPhase("welcome");
  };


  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split("\n"); const out = []; let tR = [], inT = false;
    const inl = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
    const flushT = () => {
      if (!tR.length) return;
      const hdr = tR[0], rows = tR.slice(2);
      out.push(
        <div key={"t" + out.length} className="nia-table-wrap" style={{ margin: "20px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13 }}>
            <thead><tr>{hdr.map((c, i) => (<th key={i} style={{ background: COLOR_DARK, color: COLOR_GOLD, padding: isMobile ? "7px 8px" : 12, textAlign: "left", fontSize: isMobile ? 11 : 12, textTransform: "uppercase", whiteSpace: "nowrap" }}>{c}</th>))}</tr></thead>
            <tbody>{rows.map((r, ri) => (<tr key={ri} style={{ background: ri % 2 === 0 ? "white" : "#faf8f1" }}>{r.map((c, ci) => (<td key={ci} style={{ padding: isMobile ? "7px 8px" : 12, borderBottom: "1px solid #e8e2d4", verticalAlign: "top" }} dangerouslySetInnerHTML={{ __html: inl(c) }} />))}</tr>))}</tbody>
          </table>
        </div>
      );
      tR = [];
    };
    lines.forEach((line, i) => {
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) { tR.push(line.split("|").slice(1, -1).map((c) => c.trim())); inT = true; return; }
      else if (inT) { flushT(); inT = false; }
      if (line.startsWith("# ")) out.push(<h1 key={i} style={{ fontSize: isMobile ? 17 : 26, fontWeight: 700, marginTop: isMobile ? 22 : 36, marginBottom: isMobile ? 10 : 18, paddingBottom: isMobile ? 7 : 10, borderBottom: "2px solid " + COLOR_GOLD, color: COLOR_DARK }}>{line.slice(2)}</h1>);
      else if (line.startsWith("## ")) out.push(<h2 key={i} style={{ fontSize: isMobile ? 14 : 19, marginTop: isMobile ? 16 : 28, color: COLOR_DARK }}>{line.slice(3)}</h2>);
      else if (line.startsWith("### ")) out.push(<h3 key={i} style={{ fontSize: isMobile ? 13 : 16, marginTop: isMobile ? 12 : 20, color: COLOR_DARK }}>{line.slice(4)}</h3>);
      else if (line.startsWith("- ")) out.push(<div key={i} style={{ margin: isMobile ? "4px 0 4px 8px" : "6px 0 6px 16px", display: "flex", gap: 8 }}><span style={{ color: COLOR_GOLD_DARK, flexShrink: 0 }}>◆</span><span style={{ fontSize: isMobile ? 12 : undefined }} dangerouslySetInnerHTML={{ __html: inl(line.slice(2)) }} /></div>);
      else if (!line.trim()) out.push(<div key={i} style={{ height: isMobile ? 4 : 8 }} />);
      else out.push(<p key={i} style={{ margin: "5px 0", lineHeight: 1.65, fontSize: isMobile ? 12 : undefined }} dangerouslySetInnerHTML={{ __html: inl(line) }} />);
    });
    if (inT) flushT();
    return out;
  };

  const downloadPDF = (sessionData) => {
    const analyseText = sessionData ? sessionData.analyse : analysis;
    const typeLabel = sessionData ? sessionData.typeDiscoursLabel : (TYPES_DISCOURS.find((t) => t.id === typeDiscours)?.label || "");
    const dureeLabel = sessionData ? sessionData.dureeMinPrevue : dureeMin;
    const dateObj = sessionData ? new Date(sessionData.date) : new Date();
    const date = dateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const heure = dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const inl = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
    const lines = analyseText.split("\n"); let html = "", tR = [], inT = false;
    const flushT = () => { if (!tR.length) return; html += "<table><thead><tr>" + tR[0].map((c) => "<th>" + inl(c) + "</th>").join("") + "</tr></thead><tbody>" + tR.slice(2).map((r) => "<tr>" + r.map((c) => "<td>" + inl(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>"; tR = []; };
    lines.forEach((line) => {
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) { tR.push(line.split("|").slice(1, -1).map((c) => c.trim())); inT = true; return; }
      else if (inT) { flushT(); inT = false; }
      if (line.startsWith("# ")) html += "<h1>" + inl(line.slice(2)) + "</h1>";
      else if (line.startsWith("## ")) html += "<h2>" + inl(line.slice(3)) + "</h2>";
      else if (line.startsWith("### ")) html += "<h3>" + inl(line.slice(4)) + "</h3>";
      else if (line.startsWith("- ")) html += '<div class="bullet">◆ ' + inl(line.slice(2)) + "</div>";
      else if (!line.trim()) html += "<br/>";
      else html += "<p>" + inl(line) + "</p>";
    });
    if (inT) flushT();
    const css = "@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;line-height:1.6;margin:0;padding:24px 32px}.header{border-bottom:3px solid " + COLOR_GOLD + ";padding-bottom:18px;margin-bottom:28px}.header .brand{font-size:28px;font-weight:700}.header .gold{color:" + COLOR_GOLD + "}.header .meta{color:#666;font-size:13px;margin-top:6px}h1{font-size:22px;border-bottom:2px solid " + COLOR_GOLD + ";padding-bottom:8px;margin-top:32px}h2{font-size:17px;margin-top:22px}h3{font-size:15px;margin-top:18px}p{margin:8px 0}.bullet{margin:5px 0 5px 14px}strong{font-weight:600}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}th{background:#000;color:" + COLOR_GOLD + ";padding:10px;text-align:left}td{padding:10px;border-bottom:1px solid #e8e2d4;vertical-align:top}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e8e2d4;font-size:11px;color:#888;text-align:center}";
    const fullHtml = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>Analyse Nicolas IA</title><style>' + css + '</style></head><body><div class="header"><div class="brand">Nicolas <span class="gold">IA</span></div><div class="meta">' + typeLabel + ' &middot; ' + dureeLabel + ' min &middot; ' + date + ' à ' + heure + '</div></div>' + html + '<div class="footer">Analyse générée par Nicolas IA — Organisme Silence</div></body></html>';
    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "NicolasIA_" + typeLabel.replace(/\s+/g, "_") + "_" + date.replace(/\s+/g, "_") + ".html";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  useEffect(() => () => {
    stream?.getTracks().forEach((t) => t.stop());
    [timerRef, frameIntervalRef, audioMonitorIntervalRef].forEach((r) => { if (r.current) clearInterval(r.current); });
  }, []);

  const curType = TYPES_DISCOURS.find((t) => t.id === typeDiscours)?.label;

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================
  return (
    <div style={styles.app}>
      <div style={M(styles.container, { padding: "14px 14px" })}>

        {/* ===== HEADER ===== */}
        {phase !== "login" && (
          <header style={M(styles.header, { marginBottom: 12, gap: 8 })}>
            <h1 style={M(styles.logoTitle, { fontSize: 18 })} onClick={() => { if (phase !== "recording" && phase !== "analyzing") { setViewingSession(null); setPhase("welcome"); } }}>
              Nicolas <span style={{ color: COLOR_GOLD }}>IA</span>
            </h1>
            <div style={{ display: "flex", gap: isMobile ? 6 : 10, flexWrap: "wrap", alignItems: "center" }}>
              {user && !isMobile && <span style={{ fontSize: 12, color: COLOR_TEXT_MUTED }}>{user.email}</span>}
              {phase !== "recording" && phase !== "analyzing" && phase !== "history" && phase !== "welcome" && (
                <button style={M({ ...styles.btn, ...styles.btnSecondary }, { padding: "8px 10px", fontSize: 13, gap: 5 })} onClick={() => { setViewingSession(null); setPhase("history"); }}>
                  <HistoryIcon size={15} />{isMobile ? (history.length > 0 ? history.length : "") : (" Historique" + (history.length > 0 ? " (" + history.length + ")" : ""))}
                </button>
              )}
              {phase === "results" && (<>
                <button style={M({ ...styles.btn, ...styles.btnSecondary }, { padding: "8px 10px" })} onClick={() => downloadPDF(null)}><Download size={15} />{!isMobile && " PDF"}</button>
                <button style={M({ ...styles.btn, ...styles.btnPrimary, padding: "10px 16px" }, { padding: "8px 10px", fontSize: 13 })} onClick={reset}><RotateCcw size={15} />{!isMobile && " Nouvelle session"}</button>
              </>)}
              {phase === "history" && (
                <button style={M({ ...styles.btn, ...styles.btnSecondary }, { padding: "8px 10px", fontSize: 13 })} onClick={() => { setViewingSession(null); setPhase("welcome"); }}>
                  <ChevronLeft size={15} />{!isMobile && " Retour"}
                </button>
              )}
              {user && phase === "welcome" && (
                <button style={{ ...styles.btn, background: "transparent", color: COLOR_TEXT_MUTED, fontSize: isMobile ? 11 : 12, padding: isMobile ? "6px 8px" : undefined }} onClick={handleLogout}>
                  {isMobile ? "Quitter" : "Déconnexion"}
                </button>
              )}
            </div>
          </header>
        )}

        {/* ===== LOGIN ===== */}
        {phase === "login" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "6px 0" : 0 }}>
            <div style={M({ ...styles.card, width: "100%" }, { padding: "20px 16px" })} className="fade-in-up">
              <div style={{ textAlign: "center", marginBottom: isMobile ? 16 : 24 }}>
                <div style={{ width: isMobile ? 60 : 80, height: isMobile ? 60 : 80, borderRadius: "50%", margin: "0 auto " + (isMobile ? "12px" : "20px"), background: "linear-gradient(135deg,#c9a961,#a8893f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 24 : 32, fontWeight: 700, color: COLOR_DARK }}>N</div>
                <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, margin: "0 0 5px" }}>Nicolas <span style={{ color: COLOR_GOLD }}>IA</span></h1>
                <p style={{ fontSize: isMobile ? 13 : 14, color: COLOR_TEXT_MUTED, margin: 0 }}>{loginMode === "login" ? "Connectez-vous à votre espace" : "Créez votre compte"}</p>
              </div>
              <label style={styles.label}>Email</label>
              {/* fontSize 16px : évite le zoom automatique sur iOS */}
              <input type="email" placeholder="vous@exemple.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={{ ...styles.input, fontSize: isMobile ? 16 : 14 }} />
              <label style={styles.label}>Mot de passe</label>
              <input type="password" placeholder="Minimum 4 caractères" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={{ ...styles.input, fontSize: isMobile ? 16 : 14 }} />
              {error && <div style={styles.error}><AlertCircle size={14} /> {error}</div>}
              <button style={{ ...styles.btn, ...styles.btnPrimary, width: "100%", justifyContent: "center", marginTop: 8, fontSize: isMobile ? 15 : 14 }} onClick={handleLogin}>
                {loginMode === "login" ? "Se connecter" : "Créer mon compte"} <ArrowRight size={14} />
              </button>
              <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: COLOR_TEXT_MUTED }}>
                {loginMode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
                <button style={{ background: "transparent", border: "none", color: COLOR_GOLD, cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, textDecoration: "underline" }} onClick={() => { setLoginMode(loginMode === "login" ? "signup" : "login"); setError(""); }}>
                  {loginMode === "login" ? "Créer un compte" : "Se connecter"}
                </button>
              </div>
              <p style={{ fontSize: 11, color: COLOR_TEXT_MUTED, textAlign: "center", marginTop: 18, opacity: 0.7 }}>Vos données restent dans votre navigateur.</p>
            </div>
          </div>
        )}

        {/* ===== WELCOME ===== */}
        {phase === "welcome" && (
          <div className="fade-in-up" style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: isMobile ? "8px 0" : "20px 0" }}>
            <MicBanner isMobile={isMobile} />
            <h1 style={{ fontSize: isMobile ? 36 : 56, fontWeight: 700, margin: "0 0 8px", letterSpacing: isMobile ? "-0.02em" : "-0.03em" }}>Bienvenue<span style={{ color: COLOR_GOLD }}>.</span></h1>
            <p style={{ fontSize: isMobile ? 15 : 18, color: COLOR_TEXT_MUTED, margin: "0 auto 6px", maxWidth: 560 }}>
              Bonjour <strong style={{ color: COLOR_GOLD }}>{user?.email?.split("@")[0]}</strong>
            </p>
            <p style={{ fontSize: isMobile ? 13 : 15, color: COLOR_TEXT_MUTED, margin: "0 auto " + (isMobile ? "24px" : "40px"), maxWidth: 520, lineHeight: 1.6, padding: isMobile ? "0 2px" : 0 }}>
              Prêt à perfectionner votre prise de parole ? Enregistrez votre discours et recevez une analyse complète en quelques secondes.
            </p>
            <div style={{ display: "flex", gap: isMobile ? 10 : 12, justifyContent: "center", flexDirection: isMobile ? "column" : "row", alignItems: "center" }}>
              <button style={{ ...styles.btn, ...styles.btnPrimary, fontSize: 15, padding: isMobile ? "14px 24px" : "16px 32px", width: isMobile ? "100%" : undefined, justifyContent: "center" }} onClick={() => setPhase("setup")}>
                Démarrer une session <ArrowRight size={16} />
              </button>
              {history.length > 0 && (
                <button style={{ ...styles.btn, ...styles.btnSecondary, fontSize: 14, padding: isMobile ? "12px 20px" : "16px 24px", width: isMobile ? "100%" : undefined, justifyContent: "center" }} onClick={() => setPhase("history")}>
                  <HistoryIcon size={16} /> Mes {history.length} analyse{history.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== SETUP ===== */}
        {phase === "setup" && (
          <div style={{ flex: 1, display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "center" }}>
            <div style={M({ ...styles.card, width: "100%" }, { padding: "18px 14px" })} className="fade-in-up">
              <div style={{ background: COLOR_GOLD + "11", border: "1px solid " + COLOR_GOLD + "44", borderRadius: 10, padding: isMobile ? "9px 12px" : "12px 16px", marginBottom: isMobile ? 12 : 20, display: "flex", alignItems: "center", gap: 10 }}>
                <HeadphonesIcon size={17} color={COLOR_GOLD} />
                <div style={{ fontSize: isMobile ? 11 : 12, color: COLOR_TEXT_MUTED, lineHeight: 1.5 }}>
                  <strong style={{ color: COLOR_GOLD }}>Rappel :</strong> portez vos écouteurs avec micro avant de lancer.
                </div>
              </div>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <h2 style={{ fontSize: isMobile ? 19 : 26, fontWeight: 700, margin: "0 0 5px" }}>Préparons votre session</h2>
                <p style={{ fontSize: isMobile ? 12 : 14, color: COLOR_TEXT_MUTED, margin: 0 }}>Quelques détails pour personnaliser l'analyse</p>
              </div>
              <label style={styles.label}><MessageSquare size={12} /> Type de discours</label>
              {/* Mobile : 2 colonnes / Desktop : auto-fill — seul le gridTemplateColumns change */}
              <div style={{ ...styles.selectGrid, ...(isMobile ? { gridTemplateColumns: "1fr 1fr", gap: 8 } : {}) }}>
                {TYPES_DISCOURS.map((t) => (
                  <button key={t.id} onClick={() => setTypeDiscours(t.id)}
                    style={{ ...styles.selectOption, ...(typeDiscours === t.id ? styles.selectOptionActive : {}), ...(isMobile ? { padding: "10px 8px", fontSize: 12 } : {}) }}
                    title={t.desc}>
                    <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
              <label style={styles.label}><Clock size={12} /> Durée prévue</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: isMobile ? 6 : 8, marginBottom: 12 }}>
                {[{ val: "1", label: "1 min" }, { val: "2", label: "2 min" }, { val: "5", label: "5 min" }, { val: "10", label: "10 min" }].map((d) => (
                  <button key={d.val} onClick={() => setDureeMin(d.val)}
                    style={{ ...styles.selectOption, ...(dureeMin === d.val ? styles.selectOptionActive : {}), textAlign: "center", ...(isMobile ? { padding: "10px 4px", fontSize: 12 } : {}) }}>
                    {d.label}
                  </button>
                ))}
              </div>
              {error && <div style={styles.error}><AlertCircle size={14} /> {error}</div>}
              {permissionError && (
                <div style={{ padding: 12, background: "#c9a96111", border: "1px solid #c9a96133", borderRadius: 8, marginBottom: 14, fontSize: isMobile ? 12 : 13, color: COLOR_TEXT_MUTED, lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 700, color: COLOR_GOLD, marginBottom: 5, fontSize: 11, textTransform: "uppercase" }}>💡 Astuce</div>
                  {isMobile ? "Autorisez caméra + micro dans les réglages de votre navigateur." : "Si la caméra reste inaccessible, ouvrez l'app dans un nouvel onglet."}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button style={{ ...styles.btn, ...styles.btnSecondary, justifyContent: "center", ...(isMobile ? { padding: "12px 12px" } : {}) }} onClick={() => { setPermissionError(false); setError(""); setPhase("welcome"); }}>
                  <ChevronLeft size={16} />{!isMobile && " Retour"}
                </button>
                <button style={{ ...styles.btn, ...styles.btnPrimary, flex: 1, justifyContent: "center", fontSize: isMobile ? 15 : 14 }} onClick={submitSetup}>
                  Continuer <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== READY / RECORDING ===== */}
        {(phase === "ready" || phase === "recording") && (
          <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
            {/* Vidéo : aspect-ratio 16/9 desktop intact, 4/3 + hauteur max sur mobile */}
            <div style={M(styles.videoWrap, { aspectRatio: "4/3", maxHeight: "44vh" })}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
              {phase === "recording" && (
                <div style={{ position: "absolute", top: isMobile ? 8 : 16, left: isMobile ? 8 : 16, display: "flex", alignItems: "center", gap: 6, background: "#dc2626", color: "white", padding: isMobile ? "4px 10px" : "6px 14px", borderRadius: 999, fontSize: isMobile ? 11 : 13, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "white", animation: "pulse 1s ease-in-out infinite" }} /> REC · {fmtTime(recordingTime)}
                </div>
              )}
              <div style={{ position: "absolute", bottom: isMobile ? 8 : 16, left: isMobile ? 8 : 16, background: "rgba(0,0,0,0.85)", color: COLOR_GOLD, padding: isMobile ? "3px 9px" : "6px 14px", borderRadius: 8, fontSize: isMobile ? 11 : 12 }}>
                {curType} · {dureeMin} min
              </div>
              {countdown > 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)" }}>
                  <div style={{ fontSize: isMobile ? 80 : 120, fontWeight: 700, color: COLOR_GOLD }}>{countdown}</div>
                </div>
              )}
            </div>

            {phase === "recording" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 8 : 12, marginTop: isMobile ? 8 : 16 }}>
                <div style={{ padding: isMobile ? 9 : 12, borderRadius: 10, background: soundDetected ? "#22c55e1a" : "#dc26261a", border: "1px solid " + (soundDetected ? "#22c55e66" : "#dc262666"), display: "flex", alignItems: "center", gap: 8 }}>
                  <Mic size={15} color={soundDetected ? "#86efac" : "#fca5a5"} />
                  <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600 }}>{soundDetected ? "Son capté" : "Aucun son"}</div>
                </div>
                <div style={{ padding: isMobile ? 9 : 12, borderRadius: 10, background: liveWordCount > 5 ? "#22c55e1a" : "#c9a9611a", border: "1px solid " + (liveWordCount > 5 ? "#22c55e66" : "#c9a96166"), display: "flex", alignItems: "center", gap: 8 }}>
                  <MessageSquare size={15} color={liveWordCount > 5 ? "#86efac" : COLOR_GOLD} />
                  <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600 }}>{liveWordCount} mot{liveWordCount > 1 ? "s" : ""}</div>
                </div>
              </div>

              {mediapipeReady && (
                <div style={{ marginTop: isMobile ? 8 : 16, padding: isMobile ? 10 : 16, background: "#0f0f0fcc", border: "1px solid " + COLOR_GOLD + "33", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLOR_GOLD, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: isMobile ? 8 : 12 }}>Analyse visuelle en direct</div>
                  {/* 2 colonnes mobile, 4 desktop */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(140px,1fr))", gap: isMobile ? 8 : 12 }}>
                    {[{ label: "Regard", value: liveVisual.regard, icon: "👁️" }, { label: "Posture", value: liveVisual.posture, icon: "🧍" }, { label: "Gestuelle", value: liveVisual.gestuelle, icon: "👐" }, { label: "Sourire", value: liveVisual.sourire, icon: "😊" }].map((ind, i) => {
                      const col = ind.value >= 70 ? "#10b981" : ind.value >= 40 ? COLOR_GOLD : ind.value >= 20 ? "#a8893f" : "#9ba3b4";
                      return (
                        <div key={i}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: isMobile ? 11 : 12 }}>
                            <span>{ind.icon} {ind.label}</span>
                            <span style={{ color: col, fontWeight: 700 }}>{ind.value}%</span>
                          </div>
                          <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: ind.value + "%", background: col, borderRadius: 999, transition: "width .3s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {recordingTime < MIN_RECORDING_SEC && (
                <div style={{ marginTop: isMobile ? 8 : 16, padding: isMobile ? "8px 10px" : 12, background: COLOR_GOLD + "11", border: "1px solid " + COLOR_GOLD + "44", borderRadius: 10 }}>
                  <div style={{ fontSize: isMobile ? 11 : 12, color: COLOR_GOLD, marginBottom: 5, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                    <span>⏱️ {fmtTime(recordingTime)} / 1:00</span>
                    <span>{Math.round((recordingTime / MIN_RECORDING_SEC) * 100)}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: Math.min(100, (recordingTime / MIN_RECORDING_SEC) * 100) + "%", background: "linear-gradient(90deg," + COLOR_GOLD + "," + COLOR_GOLD_LIGHT + ")", transition: "width 1s linear" }} />
                  </div>
                </div>
              )}
            </>)}

            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: isMobile ? 12 : 24 }}>
              {phase === "ready" && countdown === 0 && (
                <button style={{ ...styles.btn, ...styles.btnDanger, width: isMobile ? "100%" : undefined, justifyContent: "center", fontSize: isMobile ? 15 : 14 }} onClick={startRecording}>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "white", flexShrink: 0 }} /> Lancer l'enregistrement
                </button>
              )}
              {phase === "recording" && (
                <button style={{ ...styles.btn, ...(recordingTime < MIN_RECORDING_SEC ? { background: "#555", color: "#999", cursor: "not-allowed", padding: "14px 28px", fontWeight: 600 } : styles.btnPrimary), width: isMobile ? "100%" : undefined, justifyContent: "center", fontSize: isMobile ? 13 : 14 }} onClick={stopRecording} disabled={recordingTime < MIN_RECORDING_SEC}>
                  <Square size={14} />{recordingTime < MIN_RECORDING_SEC ? "Encore " + (MIN_RECORDING_SEC - recordingTime) + "s" : "Arrêter et analyser"}
                </button>
              )}
            </div>

            {phase === "ready" && countdown === 0 && (
              <div style={{ background: "#c9a96111", border: "1px solid #c9a96133", borderRadius: 10, padding: isMobile ? "9px 12px" : 14, marginTop: isMobile ? 10 : 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLOR_GOLD, marginBottom: 4, textTransform: "uppercase" }}>💡 Conseils</div>
                <div style={{ fontSize: isMobile ? 11 : 12, color: COLOR_TEXT_MUTED, lineHeight: 1.6 }}>
                  • Décompte 3s au clic. Parlez naturellement, regardez la caméra.<br />
                  • <strong style={{ color: COLOR_GOLD }}>⏱️ Minimum 1 minute</strong> pour une analyse fiable.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ANALYZING ===== */}
        {phase === "analyzing" && <AnalyzingScreen isMobile={isMobile} />}

        {/* ===== RESULTS ===== */}
        {phase === "results" && (
          <div className="fade-in-up">
            {(() => {
              const score = extractScore(analysis), synthese = extractSynthese(analysis), citation = extractCitation(analysis);
              return (<>
                {score !== null && <GlobalScoreBanner score={score} syntheseLine={synthese} isMobile={isMobile} />}
                <div style={M(styles.resultsBox, { padding: "18px 12px", borderRadius: 10 })}>{renderMarkdown(analysis)}</div>
                {citation && (
                  <div style={{ background: "linear-gradient(135deg,#000 0%,#0f0f0f 100%)", borderRadius: isMobile ? 10 : 14, padding: isMobile ? "18px 14px" : "36px 40px", marginTop: isMobile ? 12 : 20, border: "1px solid #c9a96166" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLOR_GOLD, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: isMobile ? 8 : 14 }}>Mot de la fin</div>
                    <blockquote style={{ margin: 0, fontSize: isMobile ? 14 : 19, lineHeight: 1.6, fontStyle: "italic", color: COLOR_TEXT }}>« {citation} »</blockquote>
                  </div>
                )}
              </>);
            })()}
          </div>
        )}

        {/* ===== HISTORY ===== */}
        {phase === "history" && (
          <HistoryView history={history} viewingSession={viewingSession} setViewingSession={setViewingSession} renderMarkdown={renderMarkdown} downloadPDF={downloadPDF} deleteSession={deleteSession} clearAllHistory={clearAllHistory} isMobile={isMobile} />
        )}
      </div>
    </div>
  );
}

export { MicBanner, AnalyzingScreen, GlobalScoreBanner };

// ============================================================
// COMPOSANT : HISTORIQUE
// ============================================================
function HistoryView({ history, viewingSession, setViewingSession, renderMarkdown, downloadPDF, deleteSession, clearAllHistory, isMobile }) {
  const M = (d, m) => isMobile ? { ...d, ...m } : d;

  if (viewingSession) {
    const d = new Date(viewingSession.date);
    const dateStr = d.toLocaleDateString("fr-FR", { weekday: isMobile ? "short" : "long", day: "numeric", month: "long", year: "numeric" });
    const heureStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: isMobile ? 10 : 16, gap: 8 }}>
          <button style={M({ ...styles.btn, ...styles.btnSecondary }, { padding: "8px 12px", fontSize: 13 })} onClick={() => setViewingSession(null)}><ChevronLeft size={14} /> Retour</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={M({ ...styles.btn, ...styles.btnSecondary }, { padding: "8px 10px" })} onClick={() => downloadPDF(viewingSession)}><Download size={14} />{!isMobile && " PDF"}</button>
            <button style={M({ ...styles.btn, background: "#dc262626", color: "#fca5a5", border: "1px solid #dc262666" }, { padding: "8px 10px" })} onClick={() => deleteSession(viewingSession.id)}><TrashIcon size={14} />{!isMobile && " Supprimer"}</button>
          </div>
        </div>
        <div style={M({ ...styles.featureCard, marginBottom: 20 }, { padding: "12px 12px", marginBottom: 12 })}>
          <div style={{ color: COLOR_GOLD, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{viewingSession.typeDiscoursLabel}</div>
          <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600, textTransform: "capitalize" }}>{dateStr} · {heureStr}</div>
          <div style={{ color: COLOR_TEXT_MUTED, fontSize: isMobile ? 12 : 13, marginTop: 3 }}>Durée prévue : {viewingSession.dureeMinPrevue} min · {viewingSession.wordCount} mots</div>
        </div>
        <div style={M(styles.resultsBox, { padding: "16px 12px" })}>{renderMarkdown(viewingSession.analyse)}</div>
      </div>
    );
  }

  if (!history.length) return (
    <div style={{ textAlign: "center", padding: isMobile ? 40 : 80 }}>
      <HistoryIcon size={isMobile ? 36 : 48} color={COLOR_GOLD} />
      <h2 style={{ marginTop: 14, fontSize: isMobile ? 18 : undefined }}>Aucune analyse pour le moment</h2>
      <p style={{ color: COLOR_TEXT_MUTED, fontSize: isMobile ? 13 : undefined }}>Vos futures analyses apparaîtront ici.</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? 14 : 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, margin: 0 }}>Historique</h2>
          <p style={{ color: COLOR_TEXT_MUTED, fontSize: 13, margin: "2px 0 0" }}>{history.length} analyse{history.length > 1 ? "s" : ""}</p>
        </div>
        <button style={M({ ...styles.btn, background: "#dc262626", color: "#fca5a5", border: "1px solid #dc262666" }, { padding: "8px 12px", fontSize: 13 })} onClick={clearAllHistory}>
          <TrashIcon size={13} /> Tout effacer
        </button>
      </div>
      <div style={{ display: "grid", gap: isMobile ? 7 : 10 }}>
        {history.map((session) => {
          const d = new Date(session.date);
          const dateStr = d.toLocaleDateString("fr-FR", { day: "numeric", month: isMobile ? "short" : "long" });
          const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={session.id} style={M({ ...styles.featureCard, cursor: "pointer" }, { padding: "11px 12px" })} onClick={() => setViewingSession(session)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ color: COLOR_GOLD, fontSize: isMobile ? 10 : 11, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{dateStr} · {heure}</span>
                    <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 600 }}>{session.typeDiscoursLabel}</span>
                  </div>
                  <div style={{ color: COLOR_TEXT_MUTED, fontSize: isMobile ? 11 : 12, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    « {session.transcription.substring(0, isMobile ? 65 : 120)}{session.transcription.length > (isMobile ? 65 : 120) ? "…" : ""} »
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button style={{ ...styles.btn, padding: isMobile ? "6px 8px" : "8px 10px", background: "#c9a9611a", color: COLOR_GOLD, border: "1px solid #c9a96166" }} onClick={() => downloadPDF(session)}><Download size={13} /></button>
                  <button style={{ ...styles.btn, padding: isMobile ? "6px 8px" : "8px 10px", background: "#dc262626", color: "#fca5a5", border: "1px solid #dc262666" }} onClick={() => deleteSession(session.id)}><TrashIcon size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
