// Midnight Blockchain Production Connection Execution Script
//   1. Local Proof Server (Docker, localhost:6300) generates the zk-SNARK proof
//      off-chain, running the compiled circuit against the private witness.
//   2. This SDK code submits the *generated proof* + public data to the chain.
//   3. The on-chain contract only verifies the proof — it does not generate one.

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { initializeWallet } from '@midnight-ntwrk/wallet-api'; 
import { ledger } from './contract/index.js';

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

// Wrap the wallet connection inside an async function so 'await' works safely
async function setupWallet() {
  console.log("Connecting to the Midnight wallet provider on port 9944...");
  wallet = await initializeWallet(config); 
  console.log("Wallet connected successfully!");
}

// FIXED: Removed the duplicate placeholder version. This is the real Midnight contract call.
async function submitResult(resultHash, passedThreshold) {
  console.log(`Generating ZK-proof for result hash: ${resultHash}`);
  
  // Real Midnight flow: call your compiled circuit rule through the ledger instance
  const txReceipt = await ledger.submitResult(wallet, resultHash, passedThreshold);
  
  console.log(`Transaction anchored successfully. Hash: ${txReceipt.txId}`);
  return txReceipt;
}

async function checkResult(resultHash) {
  console.log(`Querying public ledger state for hash: ${resultHash}`);
  
  // Real Midnight flow: read directly from the public ledger map state
  const state = await ledger.verifiedResults.get(resultHash);
  
  // Returns true if the hash exists in your contract's ledger map
  return state !== undefined;
}

// Automatically trigger the wallet connection when this file is loaded
setupWallet().catch(console.error);

// Use modern export syntax to expose clean interfaces to the bridge server
export { submitResult, checkResult };

// ============================================================================
// TEMPORARY HACKATHON TEST RUNNER
// ============================================================================
async function runTestPipeline() {
  // 1. Wait a moment to ensure setupWallet finishes connecting
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (!wallet) {
    throw new Error("Wallet failed to initialize in time.");
  }

  console.log("\n--- STARTING LIVE BLOCKCHAIN TEST ---");
  
  // 2. Mock data to submit: a dummy file hash and a boolean flag
  const dummyHash = "0xabc123xyz789def456";
  const dummyThreshold = true;

  // 3. Try to submit the transaction to the docker node
  const receipt = await submitResult(dummyHash, dummyThreshold);
  console.log(`\n🎉 SUCCESS! Block confirmation receipt received.`);
  
  // 4. Try to query it back from the indexer/ledger state
  const isFound = await checkResult(dummyHash);
  console.log(`Ledger state verification: ${isFound ? "FOUND" : "NOT FOUND"}`);
  console.log("--- TEST PIPELINE COMPLETE ---");
}

// Execute the test runner and catch any errors
