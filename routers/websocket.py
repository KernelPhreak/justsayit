from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
import asyncio

router = APIRouter()
connected_clients = []
from routers.messages import active_messages

@router.on_event("startup")
async def start_broadcast_loop():
    asyncio.create_task(broadcast_loop())

async def broadcast_loop():
    while True:
        await broadcast_messages()
        await asyncio.sleep(0.5)

async def broadcast_messages():
    now = datetime.now(datetime.timezone.utc)
    expired = [mid for mid, msg in active_messages.items()
               if now - datetime.fromisoformat(msg["timestamp"]) > timedelta(seconds=20)]
    for mid in expired:
        del active_messages[mid]

    payload = {
        "messages": list(active_messages.values()),
        "users": len(connected_clients)
    }

    for client in list(connected_clients):
        try:
            await client.send_json(payload)
        except WebSocketDisconnect:
            connected_clients.remove(client)

@router.websocket("/stream")
async def stream_messages(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)

    await websocket.send_json({
        "messages": list(active_messages.values()),
        "users": len(connected_clients)
    })

    try:
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
