from fastapi import WebSocket, WebSocketException, APIRouter
from starlette.websockets import WebSocketDisconnect

from services.connection_manager import ws_connection_manager, SubscriptionModel

tickers_ws_router = APIRouter()

@tickers_ws_router.websocket('/ws')
async def ws_connection(websocket: WebSocket):
    await ws_connection_manager.connect(websocket)

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except ValueError:
                await websocket.send_json({'error': 'given data is not valid JSON'})
                continue

            action = data.get('action')
            try:
                match action:
                    case 'auth':
                        await ws_connection_manager.auth(websocket, data)
                    case 'subscribe':
                        await ws_connection_manager.subscribe(websocket, SubscriptionModel(**data))
                    case 'unsubscribe':
                        await ws_connection_manager.unsubscribe(websocket, SubscriptionModel(**data))
                    case _:
                        await websocket.send_json({'error': 'given action is not valid'})
            except WebSocketException as e:
                await websocket.close(code=e.code, reason=e.reason)
                break

    except WebSocketDisconnect:
        await ws_connection_manager.disconnect(websocket)
        print('User was disconnected!')
    except WebSocketException:
        await ws_connection_manager.disconnect(websocket)