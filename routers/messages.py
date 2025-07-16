from fastapi import APIRouter
from models.schemas import MessageIn, MessageOut
from utils.sanitizer import sanitize_input
from uuid import uuid4
from datetime import datetime

router = APIRouter()

active_messages = {}

@router.post("/message", response_model=MessageOut)
async def post_message(msg: MessageIn):
    clean_text = sanitize_input(msg.text)

    msg_id = str(uuid4())
    new_msg = {
        "id": msg_id,
        "text": clean_text,
        "timestamp": datetime.utcnow().isoformat()
    }

    active_messages[msg_id] = new_msg
    return new_msg

@router.get("/messages")
async def get_messages():
    return list(active_messages.values())

@router.get("/users")
async def get_active_users():
    from routers.websocket import connected_clients
    return {"count": len(connected_clients)}