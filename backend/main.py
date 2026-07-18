import os
import shutil
import hashlib
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ml.model import VoiceDetector

# The URL pointing directly to your Midnight Bridge Server
MIDNIGHT_BRIDGE_URL = "http://localhost:5000/api/submit-result"

def send_to_midnight_blockchain(result_hash, passed_threshold):
    """
    Sends the scrambled ML analysis hash and threshold pass status 
    to our Midnight contract worker.
    """
    payload = {
        "resultHash": result_hash,
        "passedThreshold": passed_threshold
    }
    
    print("Sending cryptographic hash to Midnight contract bridge...")
    try:
        response = requests.post(MIDNIGHT_BRIDGE_URL, json=payload)
        response_data = response.json()
        
        if response_data.get("success"):
            print("Success! Midnight contract verified proof and updated ledger.")
            return response_data.get("data")
        else:
            print(f"Blockchain submission failed: {response_data.get('error')}")
            return None
            
    except Exception as e:
        print(f"Could not connect to Midnight bridge server: {e}")
        return None

# 1. Initialize FastAPI and the Detector
app = FastAPI()
detector = VoiceDetector()

# 2. Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. API Endpoint
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Create a temporary file path for the audio
    temp_file_path = f"temp_{file.filename}"
    
    try:
        # Save the uploaded file to a temporary location
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Call the detector using the file path
        result = detector.predict(temp_file_path)
        
        # Generate the hash using the file's binary content
        with open(temp_file_path, "rb") as f:
            file_bytes = f.read()
            commitment_hash = hashlib.sha256(file_bytes).hexdigest()

        # --- MIDNIGHT BLOCKCHAIN INTEGRATION ---
        # Flag as passing the threshold if it's explicitly a scam or high risk
        is_scam = result.get("verdict", "").lower() == "scam"
        is_high_risk = result.get("risk_level", "").lower() == "high"
        passed_threshold = is_scam or is_high_risk
        
        # Fire the hash to the bridge server
        blockchain_receipt = send_to_midnight_blockchain(commitment_hash, passed_threshold)
        # --------------------------------------

        return {
            "verdict": result["verdict"],
            "confidence": result["confidence"],
            "risk_level": result["risk_level"],
            "commitment_hash": commitment_hash,
            "blockchain_status": "Success" if blockchain_receipt else "Failed/Skipped"
        }

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")
    
    finally:
        # Clean up: delete the temporary file after processing
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.get("/")
def read_root():
    return {"message": "Midnight AI Scam Detector Backend is Online"}