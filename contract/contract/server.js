import express from 'express';
import { submitResult, checkResult } from './submit.js';

const app = express();
app.use(express.json());

const PORT = 5000;

// Route 1: Python backend submits a new AI analysis result hash
app.post('/api/submit-result', async (req, res) => {
  try {
    const { resultHash, passedThreshold } = req.body;
    
    console.log(`Received result submission request from Python backend...`);
    const txReceipt = await submitResult(resultHash, passedThreshold);
    
    res.status(200).json({
      success: true,
      message: "Proof generated and submitted to Midnight ledger successfully!",
      data: txReceipt
    });
  } catch (error) {
    console.error("Error in /api/submit-result:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route 2: Python backend checks if an audio hash exists
app.post('/api/check-result', async (req, res) => {
  try {
    const { resultHash } = req.body;
    
    console.log(`Received check request from Python backend...`);
    const isRegistered = await checkResult(resultHash);
    
    res.status(200).json({ success: true, isRegistered });
  } catch (error) {
    console.error("Error in /api/check-result:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Midnight Bridge Server running on http://localhost:${PORT}`);
});