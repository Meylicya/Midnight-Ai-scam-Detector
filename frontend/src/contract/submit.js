/**
 * Submitting ZK-Proof results to the Midnight ledger via Lace wallet.
 * This function communicates with the injected CIP-30 provider.
 */
export const submitResult = async (walletAPI, commitmentHash) => {
  try {
    console.log("Preparing transaction for hash:", commitmentHash);

    if (!walletAPI) {
      throw new Error("Wallet API not initialized. Please connect Lace.");
    }
    
    if (!commitmentHash) {
      throw new Error("No commitment hash provided by the AI Engine.");
    }

    // 1. Fetch the user's active wallet address
    const addresses = await walletAPI.getUsedAddresses();
    if (!addresses || addresses.length === 0) {
      throw new Error("No valid addresses found in the connected wallet.");
    }
    const address = addresses[0];

    // 2. Convert the Hash payload to Hexadecimal (CIP-30 requirement)
    const payloadHex = Array.from(commitmentHash)
      .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');

    console.log("Triggering Lace signature popup...");

    // 3. Request Signature (THIS IS WHAT CAUSES LACE TO POP UP)
    const signature = await walletAPI.signData(address, payloadHex);
    
    console.log("Transaction successfully anchored to Midnight Ledger.", signature);
    
    return signature;

  } catch (error) {
    console.error("Failed to submit to ledger:", error);
    throw error;
  }
};