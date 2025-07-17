from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
from typing import Dict, Set
import asyncio
import uuid

router = APIRouter()
channels: Dict[str, Set[WebSocket]] = {}
channel_messages: Dict[str, Dict[str, dict]] = {}


def cleanup_expired_messages():
    now = datetime.utcnow()
    for channel_id, msgs in list(channel_messages.items()):
        expired = [
            mid
            for mid, msg in msgs.items()
            if now - datetime.fromisoformat(msg["timestamp"]) > timedelta(seconds=20)
        ]
        for mid in expired:
            del msgs[mid]


async def broadcast_loop():
    while True:
        cleanup_expired_messages()
        for channel_id, clients in list(channels.items()):
            payload = {
                "messages": list(channel_messages.get(channel_id, {}).values()),
                "users": len(clients),
            }
            for client in list(clients):
                try:
                    await client.send_json(payload)
                except WebSocketDisconnect:
                    clients.remove(client)
        await asyncio.sleep(0.5)


@router.websocket("/stream/{channel_id}")
async def stream_messages(websocket: WebSocket, channel_id: str):
    origin = websocket.headers.get("origin")
    if origin not in ("https://www.justsayit.wtf", "https://justsayit.wtf"):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    if channel_id not in channels:
        channels[channel_id] = set()
        channel_messages[channel_id] = {}
    channels[channel_id].add(websocket)

    await websocket.send_json(
        {
            "messages": list(channel_messages[channel_id].values()),
            "users": len(channels[channel_id]),
        }
    )

    try:
        while True:
            data = await websocket.receive_json()
            text = data.get("text", "").strip()
            if text:
                mid = str(uuid.uuid4())
                msg = {
                    "id": mid,
                    "text": text,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                channel_messages[channel_id][mid] = msg
    except WebSocketDisconnect:
        channels[channel_id].remove(websocket)
