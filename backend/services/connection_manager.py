import asyncio
import json
from typing import Optional

from fastapi import WebSocket, WebSocketException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from starlette import status
import redis.asyncio as aioredis

from core.settings import settings
from core.security import verify_access_token, ws_verify_access_token
from db import models
from db.relational_db import AsyncSessionLocal


class SubscriptionModel(BaseModel):
    action: str = Field()
    token: str = Field()
    exchange: Optional[str] = Field(default="all")
    tickers: list[str] = Field(..., min_length=1)

    @field_validator("exchange")
    @classmethod
    def format_exchange(cls, value: Optional[str]) -> str:
        if not value:
            return "all"
        return value.strip().lower()

    @field_validator("tickers")
    @classmethod
    def format_tickers(cls, values: list[str]) -> list[str]:
        return [ticker.strip().upper() for ticker in values if ticker.strip()]


class WebsocketManager:
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = {}
        self.active_tickers: set[str] = set()
        self.redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        self.pubsub = self.redis_client.pubsub()

    async def redis_listener(self):
        channel_name = f"ticker:*"
        await self.pubsub.psubscribe(channel_name)

        try:
            async for message in self.pubsub.listen():
                if message and message.get('type') == 'pmessage':
                    message_data = message.get('data')
                    parsed_message_data = json.loads(message_data)

                    exchange = parsed_message_data.get('exchange')
                    ticker = parsed_message_data.get('symbol')

                    await self.broadcast(ticker, exchange, parsed_message_data)

        except Exception as e:
            self.pretty_print(f'{repr(e)} occurred in redis_listener')
        finally:
            await self.pubsub.punsubscribe("ticker:*")

    async def ticker_sync_loop(self):
        while True:
            await self.load_active_tickers()
            await asyncio.sleep(300)

    async def load_active_tickers(self):
        async with AsyncSessionLocal() as session:
            stmt = select(models.Ticker.symbol).where(models.Ticker.is_active == True)
            result = await session.execute(stmt)
            self.active_tickers = set(result.scalars().all())

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        websocket.state.is_authenticated = False

    async def auth(self, websocket: WebSocket, data: dict):
        token = data.get('token')
        if not ws_verify_access_token(token):
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason='Unauthorized')
        websocket.state.is_authenticated = True
        await websocket.send_json({'status': 'success'})

    async def subscribe(self, websocket: WebSocket, data: SubscriptionModel):
        token = data.token
        if not ws_verify_access_token(token):
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason='Unauthorized')

        not_valid_tickers = set(data.tickers) - self.active_tickers
        for i in data.tickers:
            requested_room = f'{data.exchange}:{i}'
            self.rooms.setdefault(requested_room, set()).add(websocket)

        await websocket.send_json(
            {
                'status': 'success',
                'subscribe': f'{[f'{data.exchange}:{i}' for i in data.tickers]}',
                'not_valid': f'{[f'{data.exchange}:{i}' for i in not_valid_tickers]}'
            }
        )

    async def unsubscribe(self, websocket: WebSocket, data: SubscriptionModel):
        token = data.token
        if not ws_verify_access_token(token):
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason='Unauthorized')

        for i in data.tickers:
            requested_room = f'{data.exchange}:{i}'

            if self.rooms.get(requested_room):
                self.rooms.get(requested_room).discard(websocket)

        await websocket.send_json({'status': 'success', 'subscribe': f'{[f'{data.exchange}:{i}' for i in data.tickers]}'})

    async def disconnect(self, websocket: WebSocket):
        for i in self.rooms.values():
            i.discard(websocket)

    async def broadcast(self, ticker: str, exchange: str, msg: dict):

        isolated_connection = self.rooms.get(f'{exchange.lower()}:{ticker.upper()}', set())
        all_connections = self.rooms.get(f'all:{ticker.upper()}', set())

        target_connections = isolated_connection | all_connections

        for i in target_connections:
            try:
                await i.send_json(msg)
            except Exception as e:
                self.pretty_print(f'{repr(e)} occurred in broadcast')

    def pretty_print(self, msg: str):
        print(f'[WebSocket Manager] {msg}')


ws_connection_manager = WebsocketManager()
