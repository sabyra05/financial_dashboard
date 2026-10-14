from fastapi import WebSocket


class WebsocketManager:
    def __init__(self):
        pass

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        websocket.state.is_authenticated = False

    async def auth(self):
        pass

    async def subscribe(self):
        pass

    async def unsubscribe(self):
        pass

    async def disconnect(self):
        pass

    async def broadcast(self, msg: dict):
        pass