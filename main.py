from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Literal
from uuid import uuid4
from datetime import datetime
import asyncio
import os
import re
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

app = FastAPI()

# CORS for local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve the frontend on root /
@app.get("/")
async def get_index():
    return FileResponse(os.path.join("static", "index.html"))

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

link_regex = re.compile(r"https?://\\S+|www\\.\\S+", re.IGNORECASE)
tag_regex = re.compile(r"<.*?>")

def sanitize_input(text: str) -> str:
    text = link_regex.sub("", text)
    text = tag_regex.sub("", text)
    return text.strip()

def categorize_sentiment(text: str) -> str:
    score = analyzer.polarity_scores(text)
    compound = score["compound"]
    if compound > 0.5:
        return "Happy"
    elif compound < -0.5:
        if any(word in text.lower() for word in ["hate", "rage", "furious", "angry"]):
            return "Angry"
        return "Sad"
    else:
        return "Neutral"

async def remove_message_after_delay(message_id: str, delay: int = 20):
    await asyncio.sleep(delay)
    if message_id in active_messages:
        del active_messages[message_id]
        await broadcast_messages()

async def broadcast_messages():
    messages = list(active_messages.values())
    for client in connected_clients:
        try:
            await client.send_json(messages)
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
    new_msg = {"id": msg_id, "text": clean_text, "sentiment": sentiment}
    active_messages[msg_id] = new_msg

    await broadcast_messages()
    asyncio.create_task(remove_message_after_delay(msg_id))

    return new_msg

@app.websocket("/stream")
async def stream_messages(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

@app.get("/messages")
async def get_messages():
    return list(active_messages.values())

@app.get("/stats")
async def get_stats():
    return sentiment_stats
