// Stub for the corrected Midnight flow:
//   1. Local Proof Server (Docker, localhost:6300) generates the zk-SNARK proof
//      off-chain, running the compiled circuit against the private witness.
//   2. This SDK code submits the *generated proof* + public data to the chain.
//   3. The on-chain contract only verifies the proof — it does not generate one.
//
// Replace placeholders once contract is compiled and Proof Server is running.

async function submitResult(resultHash, passedThreshold) {
  // TODO: real flow
  // 1. const proof = await proofServerClient.generateProof({ resultHash, passedThreshold }); // hits localhost:6300
  // 2. const tx = await contract.verify(proof); // on-chain: verify only
  // return tx;
  console.log("Stub: would call local Proof Server, then submit proof for verification:", {
    resultHash,
    passedThreshold,
  });
  return { proof: "stub-proof-placeholder" };
}

async function checkResult(resultHash) {
  // TODO: real Midnight.js SDK call — read-only, no proof generation needed
  console.log("Stub check:", { resultHash });
  return false;
}

module.exports = { submitResult, checkResult };
