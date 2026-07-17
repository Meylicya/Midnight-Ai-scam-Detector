# Backend (P2)

FastAPI service. Receives audio, calls ML classify(), hashes result, submits to Midnight contract.

## Setup
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

## TODO
- [ ] `/analyze` endpoint — accept audio, return fake response matching data contract (day 1)
- [ ] Plug in real `classify()` from ML module once ready
- [ ] Hash result before sending to Midnight contract
- [ ] Call Midnight.js equivalent / contract interface (coordinate with P4)
- [ ] Ensure audio is never written to disk or logged
