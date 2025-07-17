from pydantic import BaseModel
from typing import Literal


class MessageIn(BaseModel):
    text: str


class MessageOut(BaseModel):
    id: str
    text: str
