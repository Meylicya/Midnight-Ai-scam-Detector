# VoiceGuard — AI Voice Scam Identifier

Detects whether a voice in a call/chat is human or AI-generated, and uses Midnight to verify results without exposing raw audio or user identity.

## Repo Structure
- `/frontend` — React app (P1)
- `/backend` — API layer (P2)
- `/ml` — voice classifier (P3)
- `/contract` — Midnight Compact smart contract (P4)

## Branching Strategy
- `master` — always demoable. Only merge here via PR after your module runs locally.
- `feature/<name>` — everyone works on their own feature branch day 1 (e.g. `feature/frontend`, `feature/backend`, `feature/ml`, `feature/contract`)
- Merge to `master` at each sync point (Hour 4-6, Hour 16-28), not continuously — avoids breaking the demo mid-hack.

## Data Contract (shared by all modules)
```json
{
  "session_id": "string (hashed, not raw)",
  "verdict": "human | ai_generated",
  "confidence": 0.0,
  "model_version": "string",
  "timestamp": "iso8601"
}
```
