from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pronotepy
from datetime import datetime, timedelta

app = FastAPI()

# --- CRITICAL: CORS Configuration ---
# Allows requests from any origin (*) which is necessary since the 
# InfinityFree frontend is on a different domain than the Render backend.
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Model for the incoming request (Payload) ---
class LoginPayload(BaseModel):
    url: str
    username: str
    password: str

# --- API Endpoint ---
@app.post("/sync")
async def sync_schedule(payload: LoginPayload):
    try:
        # Pronotepy needs the full URL, which it resolves automatically
        client = pronotepy.Client(
            payload.url,
            payload.username,
            payload.password
        )
        
        # Get timetable for today and tomorrow
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        
        # Get timetable data
        timetable = client.timetable(today, tomorrow)
        
        # Filter: Keep only future, non-cancelled classes
        valid_classes = []
        now = datetime.now()
        
        for lesson in timetable:
            # Check if the class is in the future AND is not cancelled
            if lesson.start >= now and lesson.status != pronotepy.Lesson.STATUS_CANCELLED:
                valid_classes.append({
                    "subject": lesson.subject.name if lesson.subject else "N/A",
                    "from": lesson.start.isoformat(),
                    "room": lesson.room if lesson.room else "N/A",
                })

        # Sort by start time and take the first one
        valid_classes.sort(key=lambda x: x['from'])
        
        client.logout()

        return {
            "success": True,
            "nextClass": valid_classes[0] if valid_classes else None
        }

    except pronotepy.exceptions.PronoteAPIError as e:
        # Handles login failures (401 Unauthorized equivalent)
        raise HTTPException(
            status_code=401,
            detail=f"Login Failed: {e}"
        )
    except Exception as e:
        # Handles other server errors (500 Internal Server Error equivalent)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {e}"
        )

# --- Endpoint for the Render/Railway health check ---
@app.get("/")
def read_root():
    return {"status": "C'LHEURE Python API is running"}