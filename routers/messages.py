from fastapi import APIRouter

router = APIRouter()

active_messages = {}

@router.get("/messages")
async def get_messages():
    return list(active_messages.values())

@router.get("/users")
async def get_active_users():
    from routers.websocket import connected_clients
    return {"count": len(connected_clients)}