import asyncio
import json
from abc import ABC
from asyncio import Queue, Event
from typing import Optional, List

import websockets
from websockets import ClientConnection, WebSocketException, ConnectionClosed

from .base import BaseExchange, Ticker


class BinanceExchange(BaseExchange):
    def __init__(self, queue: Optional[Queue] = None, stop_event: Optional[Event] = None):
        super().__init__(queue, stop_event)
        self.url = 'wss://stream.binance.com:9443/ws'
        self.name = 'Binance'

    def parse_response_data(self, raw_message: dict) -> Ticker | None:
        data = raw_message.get("data", raw_message)

        if data.get("e") != "trade":
            return None

        return Ticker(
            symbol=data["s"],
            price=float(data["p"]),
            qty=float(data["q"])
        )

    async def connect(self):
        while not self.stop_event.is_set():
            try:
                self.pretty_print('Connection is initializing...')
                self.ws: ClientConnection = await asyncio.wait_for(websockets.connect(self.url), timeout=5)
                self.pretty_print('Connection initialized successfully!')
                return None
            except TimeoutError:
                self.pretty_print('Connection is failed. Reestablishing connection...')

    async def disconnect(self) -> None:
        try:
            await self.ws.close()
            self.pretty_print('Disconnected successfully')
        except Exception:
            self.pretty_print('WebSocket is already disconnected')

    async def subscribe(self, new_tickers: List[str] = None) -> None:
        msg: dict = {
          "method": "SUBSCRIBE",
          "params": [
            "btcusdt@trade",
            "ethusdt@trade"
          ],
          "id": 1
        }

        if new_tickers:
            for i in new_tickers:
                msg.get('params').append(f'{i.lower()}@trade')
        try:
            self.pretty_print('Subscription is initializing')
            await self.ws.send( json.dumps(msg) )

            while True:
                try:
                    response = await asyncio.wait_for(self.ws.recv(), timeout=5)
                    json_response: dict = json.loads(response)
                    if json_response.get('result') is None:
                        return
                except TimeoutError:
                    self.pretty_print('Not receiving response for subscription for 5 seconds')

        except WebSocketException:
            self.pretty_print('Subscription failed')


    async def listen(self):
        while not self.stop_event.is_set():
            while not self.stop_event.is_set():
                try:
                    response = await self.ws.recv()
                    parsed_ticker = self.parse_response_data( json.loads(response) )
                    await self.queue.put(parsed_ticker)
                except ConnectionClosed:
                    self.pretty_print('Connection is closed. Reestablishing connection...')
                    break



