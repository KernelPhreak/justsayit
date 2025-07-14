from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Literal
from uuid import uuid4
from datetime import datetime, timedelta
import asyncio
import os
import re
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

app = FastAPI()

# Allow only your deployed domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://justsayit.wtf", "https://www.justsayit.wtf"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def get_index():
    return FileResponse(os.path.join("static", "index.html"))

# Sentiment and message store
analyzer = SentimentIntensityAnalyzer()
sentiment_stats = {"Happy": 0, "Sad": 0, "Angry": 0, "Neutral": 0}
active_messages: Dict[str, dict] = {}
connected_clients: List[WebSocket] = []

class MessageIn(BaseModel):
    text: str

class MessageOut(BaseModel):
    id: str
    text: str
    sentiment: Literal["Happy", "Sad", "Angry", "Neutral"]

# Sanitize input
link_regex = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
tag_regex = re.compile(r"<.*?>")

def sanitize_input(text: str) -> str:
    text = link_regex.sub("", text)
    text = tag_regex.sub("", text)
    return text.strip()

# Categorize sentiment
def categorize_sentiment(text: str) -> str:
    score = analyzer.polarity_scores(text)
    compound = score["compound"]
    if compound > 0.5:
        return "Happy"
    elif compound < -0.5:
        if any(word in text.lower() for word in ["hate", "rage", "furious", "angry"]):
            return "Angry"
        return "Sad"
    return "Neutral"

@app.on_event("startup")
async def start_broadcast_loop():
    asyncio.create_task(broadcast_loop())

# Broadcast to clients every 0.5s
async def broadcast_loop():
    while True:
        await broadcast_messages()
        await asyncio.sleep(0.5)

async def broadcast_messages():
    # Remove expired messages first
    now = datetime.utcnow()
    expired = [mid for mid, msg in active_messages.items()
               if now - datetime.fromisoformat(msg["timestamp"]) > timedelta(seconds=20)]
    for mid in expired:
        del active_messages[mid]

    # Prepare broadcast payload
    payload = {
        "messages": list(active_messages.values()),
        "users": len(connected_clients)
    }

    # Send to all connected clients
    for client in list(connected_clients):
        try:
            await client.send_json(payload)
        except WebSocketDisconnect:
            connected_clients.remove(client)


@app.post("/message", response_model=MessageOut)
async def post_message(msg: MessageIn):
    clean_text = sanitize_input(msg.text)
    if not clean_text:
        return {"id": "", "text": "", "sentiment": "Neutral"}

    sentiment = categorize_sentiment(clean_text)
    sentiment_stats[sentiment] += 1

    msg_id = str(uuid4())
    new_msg = {
        "id": msg_id,
        "text": clean_text,
        "sentiment": sentiment,
        "timestamp": datetime.utcnow().isoformat()
    }

    active_messages[msg_id] = new_msg
    return new_msg

@app.websocket("/stream")
async def stream_messages(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)

    # Immediately send current state
    await websocket.send_json({
        "messages": list(active_messages.values()),
        "users": len(connected_clients)
    })

    try:
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


@app.get("/messages")
async def get_messages():
    return list(active_messages.values())

@app.get("/users")
async def get_active_users():
    return {"count": len(connected_clients)}

@app.get("/stats")
async def get_stats():
    return sentiment_stats
