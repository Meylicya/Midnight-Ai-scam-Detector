import os
import shutil
import hashlib
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ml.model import VoiceDetector

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
        # Note: We use .predict() because that is what is defined in your model.py
        result = detector.predict(temp_file_path)
        
        # Generate the hash using the file's binary content
        # We need to re-read the file bytes for hashing
        with open(temp_file_path, "rb") as f:
            file_bytes = f.read()
            commitment_hash = hashlib.sha256(file_bytes).hexdigest()

        return {
            "verdict": result["verdict"],
            "confidence": result["confidence"],
            "risk_level": result["risk_level"],
            "commitment_hash": commitment_hash
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