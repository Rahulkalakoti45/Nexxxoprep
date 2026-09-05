from pydantic import BaseModel


class APIResponse(BaseModel):
    success: bool = True
    message: str
    request_id: str
