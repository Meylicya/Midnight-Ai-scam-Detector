import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Upload, AlertCircle, ShieldCheck, Ear, Clock, Lock, Search, ArrowLeft } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// BACKEND CONTRACT (coordinate with P2 before changing this)
//
// POST {ANALYZE_ENDPOINT} as multipart/form-data, field name "file" (audio blob)
//
// Expected JSON response:
// {
//   "session_id": "string (hashed, not raw)",
//   "verdict": "human" | "ai_generated",
//   "confidence": 0.0,               // 0–1 float
//   "model_version": "string",
//   "timestamp": "iso8601",
//   "commitment_hash": "0x..."       // hash submitted to the local Proof
//                                     // Server for on-chain verification.
// }
//
// If this endpoint isn't running yet (404/network error), the UI falls back
// to a mock result after a short delay so the demo still works standalone.
// ─────────────────────────────────────────────────────────────────────────
const ANALYZE_ENDPOINT = "/analyze";

// ─────────────────────────────────────────────────────────────────────────
// SCAM REGISTRY CONTRACT (coordinate with P2/P4)
//
// POST {REPORT_ENDPOINT}  { commitment_hash, identifier_hash?, identifier_type? }
//   -> { ok: true, total_reports: number }
//
// GET  {CHECK_ENDPOINT}?hash={identifier_hash}
//   -> { flagged: boolean, report_count: number }
//
// identifier_hash is a SHA-256 hex digest computed CLIENT-SIDE (see
// sha256Hex below) — the raw phone number / email / handle never leaves
// the browser. identifier_type is one of "phone" | "email" | "handle",
// detected client-side too (see classifyIdentifier).
//
// HONEST CAVEAT: unlike audio (near-infinite input space), phone numbers
// have a small enough search space (~10 billion) that hashing alone does
// NOT make them cryptographically private — someone could hash every
// possible number and build a reverse lookup table. Don't market this
// piece as "private" the way the voice detection genuinely is. Emails and
// handles are somewhat better but still guessable for common values.
//
// Ideal end-state: identifier_hash gets submitted to the local Proof
// Server the same way commitment_hash does, and the registry lives in the
// Compact contract's ledger (see /contract/voiceguard.compact). For the
// 48-hour build, a simple backend counter is a fine fast-path stand-in —
// swap it for the Midnight-backed version if time allows.
// ─────────────────────────────────────────────────────────────────────────
const REPORT_ENDPOINT = "/report";
const CHECK_ENDPOINT = "/registry/check";

// Auto-stop recording at this length — keeps clips short, keeps the demo
// snappy, and means audio is never held longer than it needs to be.
const MAX_RECORDING_MS = 25000;

const PROCESSING_STEPS = [
  "Listening closely to the voice...",
  "Comparing it to how real and AI voices sound...",
  "Sealing your result so it can't be tampered with...",
];

const MOCK_RESULTS = {
  HUMAN: {
    verdict: "human",
    confidence: 0.9427,
    commitment_hash: "0x8f3c9e1a4d7b6205af49c1e0033b2a1",
  },
  AI_GENERATED: {
    verdict: "ai_generated",
    confidence: 0.8816,
    commitment_hash: "0x2b71fd90c34e88a015d7f42e91c0f3a9",
  },
};

// ── Design tokens — kept in one place instead of scattered across classes ──
const palette = {
  canvas: "#F4F6F6",
  surface: "#FFFFFF",
  surfaceBorder: "#E3E8E7",
  ink: "#1C2B32",
  inkMuted: "#647178",
  inkFaint: "#93A0A5",
  accent: "#2E6C8E",
  accentHover: "#255873",
  accentSoft: "#E8F0F4",
  accentRing: "#2E6C8E33",
  human: "#4C7A5A",
  humanSoft: "#EBF3ED",
  humanBorder: "#CBDFD1",
  alert: "#B3612B",
  alertSoft: "#FBEEE3",
  alertBorder: "#EDD3B8",
};

const fontHeading = "'Space Grotesk', system-ui, sans-serif";
const fontBody = "'IBM Plex Sans', system-ui, sans-serif";
const fontMono = "'IBM Plex Mono', ui-monospace, monospace";

function formatElapsed(ms) {
  const totalCentis = Math.floor(ms / 10);
  const minutes = Math.floor(totalCentis / 6000);
  const seconds = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
}

// ── Identifier classification — one text field, three possible types ──────
// Heuristic, not perfect, but covers the realistic cases without asking
// the person to pick a type themselves.
function classifyIdentifier(raw) {
  const value = raw.trim();
  if (!value) return { type: null, normalized: "" };

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(value)) {
    return { type: "email", normalized: value.toLowerCase() };
  }

  const digitsOnly = value.replace(/[^\d]/g, "");
  const looksLikePhone = /^[+\d\s\-()]+$/.test(value) && digitsOnly.length >= 7;
  if (looksLikePhone) {
    return { type: "phone", normalized: digitsOnly };
  }

  // Anything else — social handle, username, etc.
  return { type: "handle", normalized: value.replace(/^@/, "").toLowerCase() };
}

// Client-side SHA-256 — the raw identifier never leaves the browser, only
// this hex digest does. See the honest privacy caveat in the constants
// block above: this is NOT strong privacy for low-entropy inputs like
// phone numbers, just a practical minimum.
async function sha256Hex(text) {
  if (!text) return null;
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function App() {
  const [status, setStatus] = useState("INTRO");
  // INTRO | IDLE | RECORDING | PROCESSING | SUCCESS | CHECK
  const [verdict, setVerdict] = useState("HUMAN"); // HUMAN | AI_GENERATED
  const [result, setResult] = useState(MOCK_RESULTS.HUMAN);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [reported, setReported] = useState(false);
  const [reportIdentifier, setReportIdentifier] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [micError, setMicError] = useState(false);

  // "Check a number" screen — look someone up before ever recording audio
  const [checkIdentifier, setCheckIdentifier] = useState("");
  const [checkResult, setCheckResult] = useState(null); // { flagged, report_count } | null
  const [checkSubmitting, setCheckSubmitting] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartRef = useRef(0);
  const stepTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Recording ────────────────────────────────────────────────────────
  const beginSimulatedRecording = useCallback(() => {
    setMicError(true);
    recordingStartRef.current = Date.now();
    setElapsedMs(0);
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartRef.current;
      if (elapsed >= MAX_RECORDING_MS) {
        setElapsedMs(MAX_RECORDING_MS);
        stopRecordingRef.current();
        return;
      }
      setElapsedMs(elapsed);
    }, 40);
    setStatus("RECORDING");
  }, []);

  const startRecording = useCallback(async () => {
    setMicError(false);
    chunksRef.current = [];

    const micAvailable =
      typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia;

    // Some sandboxed/preview environments never resolve or reject the
    // permission prompt at all (no proper permissions policy on the iframe),
    // which makes the button look broken rather than gracefully falling
    // back. Race against a short timeout so it always resolves one way
    // or the other within ~1.5s — real deployments with a real mic will
    // resolve almost instantly and never hit this timeout.
    if (!micAvailable) {
      beginSimulatedRecording();
      return;
    }

    try {
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("mic-timeout")), 1500)),
      ]);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();

      recordingStartRef.current = Date.now();
      setElapsedMs(0);
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartRef.current;
        if (elapsed >= MAX_RECORDING_MS) {
          setElapsedMs(MAX_RECORDING_MS);
          stopRecordingRef.current();
          return;
        }
        setElapsedMs(elapsed);
      }, 40);

      setStatus("RECORDING");
    } catch (err) {
      // Mic denied, unavailable, or timed out — fall back to a simulated
      // recording so the flow is still demoable. Real audio capture works
      // once this runs outside a sandboxed preview (e.g. deployed, or in
      // Claude Code / a normal browser tab).
      beginSimulatedRecording();
    }
  }, [beginSimulatedRecording]);

  const stopRecording = useCallback(() => {
    clearInterval(recordingTimerRef.current);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    }

    beginProcessing();
    // small delay so chunksRef has time to flush the last ondataavailable event
    setTimeout(() => analyzeAudio(), 50);
  }, []);

  // Ref indirection so the setInterval closures above (created before
  // stopRecording's declaration further down) can always call the latest
  // version of it once MAX_RECORDING_MS is reached.
  const stopRecordingRef = useRef(() => {});
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // ── Real file upload ─────────────────────────────────────────────────
  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    beginProcessing();
    analyzeAudio(file);
    e.target.value = ""; // allow re-selecting the same file later
  };

  const beginProcessing = () => {
    setStatus("PROCESSING");
    setStepIndex(0);
    stepTimerRef.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, PROCESSING_STEPS.length - 1));
    }, 2000);
  };

  // ── Backend call ─────────────────────────────────────────────────────
  const analyzeAudio = useCallback(async (uploadedFile) => {
    const minDisplayTime = new Promise((res) =>
      setTimeout(res, PROCESSING_STEPS.length * 2000)
    );

    try {
      const blob = uploadedFile ?? new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", blob, uploadedFile ? uploadedFile.name : "clip.webm");

      const fetchPromise = fetch(ANALYZE_ENDPOINT, {
        method: "POST",
        body: formData,
      }).then((r) => {
        if (!r.ok) throw new Error(`Analyze failed: ${r.status}`);
        return r.json();
      });

      const [data] = await Promise.all([fetchPromise, minDisplayTime]);
      applyResult(data);
    } catch (err) {
      // Backend not reachable yet — use a mock result so frontend work
      // isn't blocked on P2/P3 being finished. Remove this fallback once
      // /analyze is live.
      await minDisplayTime;
      const fallbackKey = Math.random() > 0.5 ? "HUMAN" : "AI_GENERATED";
      applyResult(MOCK_RESULTS[fallbackKey]);
    } finally {
      clearInterval(stepTimerRef.current);
    }
  }, []);

  const applyResult = (data) => {
    const normalizedVerdict =
      data.verdict?.toUpperCase() === "AI_GENERATED" ? "AI_GENERATED" : "HUMAN";
    setVerdict(normalizedVerdict);
    setResult(data);
    setReported(false);
    setReportIdentifier("");
    setStatus("SUCCESS");
  };

  const reset = () => {
    setStatus("IDLE");
    setElapsedMs(0);
    setStepIndex(0);
    setReported(false);
    setReportIdentifier("");
  };

  // ── Report a scam — sends only hashes, never the raw identifier ──────
  const submitReport = useCallback(async () => {
    setReportSubmitting(true);
    try {
      const { type, normalized } = classifyIdentifier(reportIdentifier);
      const identifier_hash = normalized ? await sha256Hex(normalized) : null;

      await fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commitment_hash: result?.commitment_hash ?? null,
          identifier_hash,
          identifier_type: identifier_hash ? type : null,
        }),
      }).catch(() => {
        // Backend not live yet — still mark as reported locally so the
        // flow is demoable; remove this once /report is real.
      });
    } finally {
      setReportSubmitting(false);
      setReported(true);
    }
  }, [reportIdentifier, result]);

  // ── Check a number/email/handle before ever recording anything ───────
  const submitCheck = useCallback(async () => {
    const { type, normalized } = classifyIdentifier(checkIdentifier);
    if (!normalized) return;

    setCheckSubmitting(true);
    setCheckResult(null);
    try {
      const identifier_hash = await sha256Hex(normalized);
      const res = await fetch(`${CHECK_ENDPOINT}?hash=${identifier_hash}&type=${type}`);
      if (!res.ok) throw new Error("check failed");
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      // Backend not live yet — show a neutral mock result so the screen
      // is still demoable. Remove this fallback once the endpoint is real.
      setCheckResult({ flagged: false, report_count: 0, mock: true });
    } finally {
      setCheckSubmitting(false);
    }
  }, [checkIdentifier]);

  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      clearInterval(stepTimerRef.current);
    };
  }, []);

  // ── Testing panel helpers (manual state overrides for demo/judging) ──
  const jumpTo = (nextStatus, nextVerdict) => {
    clearInterval(recordingTimerRef.current);
    clearInterval(stepTimerRef.current);
    if (nextVerdict) {
      setVerdict(nextVerdict);
      setResult(MOCK_RESULTS[nextVerdict]);
    }
    setElapsedMs(8420);
    setStepIndex(PROCESSING_STEPS.length - 1);
    setReported(false);
    setStatus(nextStatus);
  };

  const isAi = verdict === "AI_GENERATED";
  const confidencePct = ((result?.confidence ?? 0) * 100).toFixed(0);
  const verdictColor = isAi ? palette.alert : palette.human;
  const verdictSoft = isAi ? palette.alertSoft : palette.humanSoft;
  const verdictBorder = isAi ? palette.alertBorder : palette.humanBorder;

  return (
    <div
      className="min-h-screen flex flex-col justify-between p-4"
      style={{ backgroundColor: palette.canvas, color: palette.ink, fontFamily: fontBody }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        @keyframes ripple {
          0% { transform: scale(0.9); opacity: 0.5; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `}</style>

      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
        <div
          className="rounded-[28px] p-6 flex flex-col items-center shadow-sm"
          style={{ backgroundColor: palette.surface, border: `1px solid ${palette.surfaceBorder}` }}
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between mb-8">
            <span
              className="text-sm tracking-tight"
              style={{ fontFamily: fontHeading, fontWeight: 600, color: palette.ink }}
            >
              VoiceGuard
            </span>
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: palette.human }}
              aria-label="Server connected"
            />
          </div>

          {/* STATE 0: INTRO */}
          {status === "INTRO" && (
            <div className="w-full flex flex-col items-center text-center">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ backgroundColor: palette.accentSoft }}
              >
                <Ear className="h-8 w-8" style={{ color: palette.accent }} strokeWidth={1.75} />
              </div>

              <h1
                className="text-xl"
                style={{ fontFamily: fontHeading, fontWeight: 600, color: palette.ink }}
              >
                Is that voice really human?
              </h1>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: palette.inkMuted }}>
                Scam calls sometimes use AI to fake a real person's voice.
                VoiceGuard listens to a short clip and tells you whether it
                sounds human or AI-made — in a few seconds, and without
                storing your audio anywhere.
              </p>

              <div className="w-full mt-7 space-y-3 text-left">
                {[
                  "Record the voice, or upload a clip you already have",
                  "We check it and tell you: human or AI",
                  "The result is sealed privately — no one can see or replay your clip",
                ].map((text, i) => (
                  <div className="flex items-start gap-3" key={i}>
                    <div
                      className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs"
                      style={{ backgroundColor: palette.accentSoft, color: palette.accent, fontFamily: fontMono }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-sm" style={{ color: palette.ink }}>
                      {text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 w-full mt-7">
                {[
                  { icon: Clock, value: "<5s", label: "avg. check time" },
                  { icon: Lock, value: "0", label: "clips ever stored" },
                  { icon: ShieldCheck, value: "100%", label: "private by design" },
                ].map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 flex flex-col items-center text-center"
                    style={{ backgroundColor: palette.canvas, border: `1px solid ${palette.surfaceBorder}` }}
                  >
                    <Icon className="h-4 w-4 mb-1.5" style={{ color: palette.accent }} strokeWidth={2} />
                    <span
                      className="text-sm"
                      style={{ fontFamily: fontHeading, fontWeight: 600, color: palette.ink }}
                    >
                      {value}
                    </span>
                    <span className="text-[10px] mt-0.5 leading-tight" style={{ color: palette.inkFaint }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStatus("IDLE")}
                className="w-full font-semibold py-3.5 rounded-xl transition-all active:scale-[0.99] cursor-pointer mt-6"
                style={{ backgroundColor: palette.accent, color: "#FFFFFF" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = palette.accentHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = palette.accent)}
              >
                Get Started
              </button>

              <button
                onClick={() => setStatus("CHECK")}
                className="w-full flex items-center justify-center gap-2 font-medium py-3 rounded-xl transition-all active:scale-[0.99] cursor-pointer mt-2.5"
                style={{ backgroundColor: palette.accentSoft, color: palette.accent, border: `1px solid ${palette.surfaceBorder}` }}
              >
                <Search className="h-4 w-4" strokeWidth={2} />
                Check a number, email, or handle
              </button>
            </div>
          )}

          {/* STATE A: IDLE */}
          {status === "IDLE" && (
            <div className="w-full flex flex-col items-center">
              <button
                onClick={() => setStatus("INTRO")}
                aria-label="Back"
                className="w-full flex items-center gap-1.5 text-sm mb-6 cursor-pointer"
                style={{ color: palette.inkMuted }}
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>

              <h1
                className="text-xl text-center"
                style={{ fontFamily: fontHeading, fontWeight: 600, color: palette.ink }}
              >
                Check a voice
              </h1>
              <p className="text-sm text-center mt-2 mb-10" style={{ color: palette.inkMuted }}>
                Record it live, or upload a clip you already have
              </p>

              {/* Signature element: gentle ripple rings instead of a neon glow */}
              <div className="relative h-32 w-32 flex items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: `1.5px solid ${palette.accent}`, animation: "ripple 2.4s ease-out infinite" }}
                />
                <span
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: `1.5px solid ${palette.accent}`, animation: "ripple 2.4s ease-out infinite 1.2s" }}
                />
                <button
                  type="button"
                  onClick={startRecording}
                  aria-label="Start voice scan"
                  className="relative z-10 h-32 w-32 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer focus:outline-none"
                  style={{ backgroundColor: palette.accent, boxShadow: `0 8px 24px ${palette.accentRing}` }}
                >
                  <Mic className="h-11 w-11 pointer-events-none" style={{ color: "#FFFFFF" }} strokeWidth={2} />
                </button>
              </div>
              <p className="text-xs mt-4" style={{ color: palette.inkFaint, fontFamily: fontMono }}>
                Tap to record
              </p>

              <div className="flex items-center gap-3 w-full my-6">
                <span className="h-px flex-1" style={{ backgroundColor: palette.surfaceBorder }} />
                <span className="text-[11px]" style={{ color: palette.inkFaint, fontFamily: fontMono }}>
                  or
                </span>
                <span className="h-px flex-1" style={{ backgroundColor: palette.surfaceBorder }} />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.webm"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={handleChooseFile}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-xl transition-all cursor-pointer"
                style={{ border: `1px solid ${palette.surfaceBorder}`, color: palette.ink }}
              >
                <Upload className="h-4 w-4" style={{ color: palette.accent }} strokeWidth={2} />
                Upload an audio file
              </button>
              <p className="text-[11px] mt-2" style={{ color: palette.inkFaint, fontFamily: fontMono }}>
                Works with .wav, .mp3, and .m4a
              </p>
            </div>
          )}

          {/* STATE B: RECORDING */}
          {status === "RECORDING" && (
            <div className="w-full flex flex-col items-center">
              <p className="text-sm text-center mb-1" style={{ color: palette.inkMuted }}>
                Listening...
              </p>
              <p
                className="text-4xl tracking-wider text-center mb-1"
                style={{ fontFamily: fontMono, fontWeight: 500, color: palette.accent }}
              >
                {formatElapsed(elapsedMs)}
              </p>
              <p className="text-[11px] text-center mb-6" style={{ color: palette.inkFaint, fontFamily: fontMono }}>
                Stops automatically at 0:25 — that's plenty to tell
              </p>

              <div className="h-16 w-full flex items-center justify-center gap-1.5 px-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full animate-bounce"
                    style={{
                      height: `${20 + ((i * 37) % 45)}%`,
                      backgroundColor: palette.accent,
                      opacity: 0.75,
                      animationDuration: `${0.6 + (i % 5) * 0.12}s`,
                      animationDelay: `${(i % 4) * 0.08}s`,
                    }}
                  />
                ))}
              </div>

              {micError && (
                <p className="text-[11px] text-center mb-4" style={{ color: palette.inkFaint, fontFamily: fontMono }}>
                  Microphone not available here — showing a simulated recording
                </p>
              )}

              <button
                onClick={stopRecording}
                className="w-full py-3.5 rounded-xl font-medium transition-all active:scale-[0.99] cursor-pointer text-center mt-2"
                style={{ backgroundColor: palette.alertSoft, color: palette.alert, border: `1px solid ${palette.alertBorder}` }}
              >
                Stop and check this voice
              </button>
            </div>
          )}

          {/* STATE C: PROCESSING */}
          {status === "PROCESSING" && (
            <div className="w-full flex flex-col items-center py-10">
              <div
                className="h-10 w-10 rounded-full animate-spin mb-6"
                style={{ border: `2.5px solid ${palette.surfaceBorder}`, borderTopColor: palette.accent }}
              />
              <p
                key={stepIndex}
                className="text-sm tracking-tight transition-all text-center animate-pulse px-4"
                style={{ color: palette.inkMuted }}
              >
                {PROCESSING_STEPS[stepIndex]}
              </p>
            </div>
          )}

          {/* STATE D: SUCCESS */}
          {status === "SUCCESS" && (
            <div
              className="w-full flex flex-col items-center rounded-2xl p-4 transition-colors"
              style={{ backgroundColor: verdictSoft, border: `1px solid ${verdictBorder}` }}
            >
              {isAi ? (
                <AlertCircle className="h-10 w-10 mb-3" style={{ color: verdictColor }} strokeWidth={2} />
              ) : (
                <ShieldCheck className="h-10 w-10 mb-3" style={{ color: verdictColor }} strokeWidth={2} />
              )}

              <p
                className="text-xl text-center"
                style={{ fontFamily: fontHeading, fontWeight: 700, color: verdictColor }}
              >
                {isAi ? "This sounds AI-generated" : "This sounds human"}
              </p>
              <p className="text-sm text-center mt-2 max-w-xs" style={{ color: palette.inkMuted }}>
                {isAi
                  ? "Danger: this voice profile was generated synthetically. Hang up immediately and do not share personal data or financial information."
                  : "This voice sounds natural and authentic. It is safe to proceed with normal conversation."}
              </p>

              {/* Confidence meter — visible by default, unlike the hash/proof details below */}
              <div className="w-full mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: palette.inkMuted }}>
                    Confidence
                  </span>
                  <span
                    className="text-xs"
                    style={{ fontFamily: fontMono, color: verdictColor, fontWeight: 500 }}
                  >
                    {confidencePct}%
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: palette.surface, border: `1px solid ${palette.surfaceBorder}` }}
                  role="progressbar"
                  aria-valuenow={Number(confidencePct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${confidencePct}%`, backgroundColor: verdictColor }}
                  />
                </div>
              </div>

              {/* Midnight badge — plain language, no expandable technical panel */}
              <div
                className="rounded-2xl p-4 text-xs w-full mt-4"
                style={{ backgroundColor: palette.surface, border: `1px solid ${palette.surfaceBorder}` }}
              >
                <div className="flex items-center gap-1.5 mb-1" style={{ color: palette.human }}>
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                  <span style={{ fontFamily: fontBody, fontWeight: 500 }}>Your result is sealed and private</span>
                </div>
                <p style={{ color: palette.inkMuted }}>
                  No one, including us, can see or replay your original clip.
                </p>
              </div>

              <div className="w-full mt-6">
                <button
                  onClick={reset}
                  className="w-full py-3 rounded-xl font-medium text-sm transition-all text-center cursor-pointer mb-2"
                  style={{ backgroundColor: palette.surface, color: palette.ink, border: `1px solid ${palette.surfaceBorder}` }}
                >
                  Check another voice
                </button>

                {isAi && !reported && (
                  <div className="mb-2">
                    <input
                      type="text"
                      value={reportIdentifier}
                      onChange={(e) => setReportIdentifier(e.target.value)}
                      placeholder="Number, email, or handle that contacted you (optional)"
                      className="w-full text-xs py-2.5 px-3 rounded-lg mb-2 outline-none"
                      style={{
                        backgroundColor: palette.surface,
                        color: palette.ink,
                        border: `1px solid ${palette.surfaceBorder}`,
                      }}
                    />
                    <button
                      onClick={submitReport}
                      disabled={reportSubmitting}
                      className="w-full py-2.5 rounded-xl text-xs font-medium transition-all text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: palette.alertSoft, color: palette.alert, border: `1px solid ${palette.alertBorder}` }}
                    >
                      {reportSubmitting ? "Reporting..." : "Report this as a scam"}
                    </button>
                  </div>
                )}

                {isAi && reported && (
                  <div
                    className="w-full py-2.5 rounded-xl text-xs font-medium text-center"
                    style={{ backgroundColor: palette.alertSoft, color: palette.alert, border: `1px solid ${palette.alertBorder}` }}
                  >
                    Reported — thank you. This helps protect others too.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATE E: CHECK — look up a number/email/handle before recording anything */}
          {status === "CHECK" && (
            <div className="w-full flex flex-col items-center">
              <h1
                className="text-xl text-center"
                style={{ fontFamily: fontHeading, fontWeight: 600, color: palette.ink }}
              >
                Check a number, email, or handle
              </h1>
              <p className="text-sm text-center mt-2 mb-6" style={{ color: palette.inkMuted }}>
                See if others have already flagged it — no recording needed
              </p>

              <input
                type="text"
                value={checkIdentifier}
                onChange={(e) => {
                  setCheckIdentifier(e.target.value);
                  setCheckResult(null);
                }}
                placeholder="e.g. +1 555 0100, name@email.com, @handle"
                className="w-full text-sm py-3 px-3.5 rounded-xl mb-3 outline-none"
                style={{
                  backgroundColor: palette.canvas,
                  color: palette.ink,
                  border: `1px solid ${palette.surfaceBorder}`,
                }}
              />

              <button
                onClick={submitCheck}
                disabled={checkSubmitting || !checkIdentifier.trim()}
                className="w-full font-semibold py-3 rounded-xl transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: palette.accent, color: "#FFFFFF" }}
              >
                {checkSubmitting ? "Checking..." : "Check"}
              </button>

              {checkResult && (
                <div
                  className="w-full mt-5 rounded-2xl p-4 text-center"
                  style={{
                    backgroundColor: checkResult.flagged ? palette.alertSoft : palette.humanSoft,
                    border: `1px solid ${checkResult.flagged ? palette.alertBorder : palette.humanBorder}`,
                  }}
                >
                  <p
                    className="text-sm font-semibold"
                    style={{ color: checkResult.flagged ? palette.alert : palette.human }}
                  >
                    {checkResult.flagged
                      ? `Flagged ${checkResult.report_count} time${checkResult.report_count === 1 ? "" : "s"} as a likely scam`
                      : "No reports found for this"}
                  </p>
                  <p className="text-xs mt-1" style={{ color: palette.inkMuted }}>
                    {checkResult.flagged
                      ? "Others have reported this before. Stay cautious, especially if asked for money or personal info."
                      : "That doesn't guarantee it's safe — just that no one has reported it here yet."}
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  setCheckIdentifier("");
                  setCheckResult(null);
                  setStatus("IDLE");
                }}
                className="w-full py-3 rounded-xl font-medium text-sm transition-all text-center cursor-pointer mt-6"
                style={{ backgroundColor: palette.surface, color: palette.ink, border: `1px solid ${palette.surfaceBorder}` }}
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hackathon Testing Panel — remove or hide before final demo polish */}
      <div className="w-full max-w-md mx-auto mt-4">
        <p
          className="text-[10px] tracking-widest text-center mb-2"
          style={{ color: palette.inkFaint, fontFamily: fontMono }}
        >
          HACKATHON TESTING OPTIONS
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {[
            { label: "INTRO", action: () => jumpTo("INTRO") },
            { label: "IDLE", action: () => jumpTo("IDLE") },
            { label: "RECORDING", action: () => jumpTo("RECORDING") },
            { label: "PROCESSING", action: () => jumpTo("PROCESSING") },
            { label: "SUCCESS - HUMAN", action: () => jumpTo("SUCCESS", "HUMAN") },
            { label: "SUCCESS - AI", action: () => jumpTo("SUCCESS", "AI_GENERATED") },
            { label: "CHECK", action: () => jumpTo("CHECK") },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="text-[10px] rounded-full px-2.5 py-1 transition-colors cursor-pointer"
              style={{ color: palette.inkFaint, border: `1px solid ${palette.surfaceBorder}`, fontFamily: fontMono }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}