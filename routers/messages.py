from fastapi import APIRouter
from routers.websocket import channels

router = APIRouter()

active_messages = {}


@router.get("/messages")
async def get_messages():
    return list(active_messages.values())


@router.get("/users")
async def get_active_users():
    total_clients = sum(len(clients) for clients in channels.values())
    return {"count": total_clients}
