# Contract (P4)

Midnight Compact smart contract — verifies a hashed classification result against a threshold. No raw audio or confidence score ever touches the chain.

**Important:** the contract does NOT generate proofs. Proof generation happens off-chain, via a local Proof Server (Docker) that runs the compiled circuit against a private witness. The contract only verifies the resulting proof and updates ledger state.

## Setup
1. Install Docker Desktop, ensure it's running
2. Start the local Proof Server (keep this terminal running):
   ```bash
   docker run -p 6300:6300 midnightntwrk/proof-server:latest midnight-proof-server -v
   ```
3. Install Midnight Compact compiler / toolchain (see Midnight docs)
4. Configure Lace wallet: Settings → Midnight → Local (`http://localhost:6300`)
5. Compile: `compact build voiceguard.compact`

## TODO
- [ ] Stub contract: define verification circuit for a hash (no proof-emission logic — contract only verifies)
- [ ] Confirm local Proof Server is reachable at `localhost:6300`
- [ ] Test full loop with fake data: SDK → Proof Server generates proof → SDK submits → contract verifies
- [ ] Sync with P2 on exact hashing/commitment format
- [ ] Replace stub with real threshold verification logic
- [ ] (Stretch) private registry of flagged session hashes
