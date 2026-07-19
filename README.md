# Vera — AI Voice Scam Identifier

Detects whether a voice in a call/chat is human or AI-generated, and uses Midnight to verify results without exposing raw audio or user identity.

## Repo Structure
- `/frontend` — React app 
- `/backend` — API layer 
- `/ml` — voice classifier
- `/contract` — Midnight Compact smart contract

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
