from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import messages, websocket

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://justsayit.wtf", "https://www.justsayit.wtf"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

app.include_router(messages.router)
app.include_router(websocket.router)
