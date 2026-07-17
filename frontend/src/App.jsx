import { useState } from "react";

// Mock response — matches the shared data contract.
// Replace with a real fetch("/analyze") call once backend is ready.
const MOCK_RESPONSE = {
  session_id: "hashed-session-id-placeholder",
  verdict: "human",
  confidence: 0.92,
  model_version: "v0-stub",
  timestamp: new Date().toISOString(),
};

export default function App() {
  const [result, setResult] = useState(null);

  const handleAnalyze = () => {
    // TODO: replace mock with real POST to backend /analyze endpoint
    setResult(MOCK_RESPONSE);
  };

  return (
    <div>
      <h1>VoiceGuard</h1>
      <button onClick={handleAnalyze}>Analyze (mock)</button>
      {result && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
