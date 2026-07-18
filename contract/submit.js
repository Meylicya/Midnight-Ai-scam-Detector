// Stub for the corrected Midnight flow:
//   1. Local Proof Server (Docker, localhost:6300) generates the zk-SNARK proof
//      off-chain, running the compiled circuit against the private witness.
//   2. This SDK code submits the *generated proof* + public data to the chain.
//   3. The on-chain contract only verifies the proof — it does not generate one.

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
// FIX 1: Import the wallet helper from the Midnight SDK library
import { initializeWallet } from '@midnight-ntwrk/wallet-api'; 

// Tell the application we are working locally in development
setNetworkId('undeployed');

const config = {
  node: 'http://127.0.0.1:9944',                  // Communicates with the local blockchain node
  indexer: 'http://127.0.0.1:8088/api/v3/graphql', // Reads state and ledger history
  proofServer: 'http://127.0.0.1:6300',            // Runs your ZK circuits to build proofs
  networkId: 'undeployed',
};

// Global wallet variable so our functions can use it once it's loaded
let wallet;

// FIX 2: Wrap the wallet connection inside an async function so 'await' works safely
async function setupWallet() {
  console.log("Connecting to the Midnight wallet provider on port 9944...");
  wallet = await initializeWallet(config); 
  console.log("Wallet connected successfully!");
}

async function submitResult(resultHash, passedThreshold) {
  // TODO: real flow
  // 1. const proof = await proofServerClient.generateProof({ resultHash, passedThreshold });
  // 2. const tx = await contract.verify(proof); 
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

// Automatically trigger the wallet connection when this file is loaded
setupWallet().catch(console.error);

// FIX 3: Use modern export syntax instead of module.exports
export { submitResult, checkResult };