import asyncio
import json
import socket
from asyncio import Queue, Event
from typing import Optional, List

import requests
import websockets
from aiohttp import ClientSession, ClientError, ClientTimeout, TCPConnector, ThreadedResolver
from websockets import ClientConnection, WebSocketException, ConnectionClosed

from .base import BaseExchange, Ticker


class BinanceExchange(BaseExchange):
    def __init__(self, queue: Optional[Queue] = None, stop_event: Optional[Event] = None):
        super().__init__(queue, stop_event)
        self.available_tickers = None
        self.active_subscriptions: set = set()
        self.tickers_info_url = 'https://data-api.binance.vision/api/v3/ticker/price'
        self.url = 'wss://stream.binance.com:9443/ws'
        self.name = 'Binance'

    def parse_response_data(self, raw_message: dict):
        data = raw_message.get("data", raw_message)

        if data.get("e") != "trade":
            return None

        return Ticker(
            exchange=self.name,
            symbol=data["s"],
            price=float(data["p"]),
            qty=float(data["q"])
        )

    async def fetch_available_tickers(self) -> Optional[list]:
        async with ClientSession() as session:
            async with session.get(self.tickers_info_url) as response:
                if response.status != 200:
                    return None
                data = await response.json()
                return data

    async def filter_valid_tickers(self, new_tickers: List[str] = None) -> Optional[set[str]]:
        if not new_tickers:
            return set()

        if self.available_tickers:
            requested_upper = {t.upper() for t in new_tickers}
            return requested_upper.intersection(self.available_tickers)

        try:
            data: Optional[list] = await self.fetch_available_tickers()
        except Exception as e:
            self.pretty_print(f'{repr(e)} in fetch_available_tickers')
            return None

        if data is None:
            self.pretty_print(f'Couldn\'t receive available tickers')
            return set()

        available_tickers = {i.get('symbol') for i in data}
        requested_upper = {t.upper() for t in new_tickers}

        self.available_tickers = available_tickers

        return requested_upper.intersection(available_tickers)


    async def connect(self):
        while not self.stop_event.is_set():
            try:
                self.pretty_print('Connection is initializing...')
                self.ws: ClientConnection = await asyncio.wait_for(websockets.connect(self.url), timeout=5)
                self.pretty_print('Connection initialized successfully!')
                return None
            except Exception as e:
                self.pretty_print(f'Connection failed: {repr(e)}. Reestablishing connection...')
                await asyncio.sleep(2)

    async def disconnect(self) -> None:
        try:
            await self.ws.close()
            self.pretty_print('Disconnected successfully')
        except Exception:
            self.pretty_print('WebSocket is already disconnected')

    async def subscribe(self, new_tickers: List[str] = None) -> None:
        new_tickers = await self.filter_valid_tickers(new_tickers)

        if not new_tickers:
            self.pretty_print('No valid tickers to subscribe.')
            return None

        msg: dict = {
          "method": "SUBSCRIBE",
          "params": [],
          "id": 1
        }

        if new_tickers:
            self.active_subscriptions.update(new_tickers)
            for i in new_tickers:
                msg.get('params').append(f'{i.lower()}@trade')

        try:
            self.pretty_print('Subscription is initializing')
            await self.ws.send( json.dumps(msg) )

        except WebSocketException:
            self.pretty_print('Subscription failed')


    async def listen(self):
        connecting_attempts: int = 0
        while not self.stop_event.is_set():
            if connecting_attempts == 5:
                self.pretty_print('Exchange is not answering 5 times. Connections is closed')
                break
            while not self.stop_event.is_set():
                try:
                    response = await self.ws.recv()
                    parsed_ticker = self.parse_response_data( json.loads(response) )
                    if parsed_ticker is not None:
                        await self.queue.put(parsed_ticker)
                        connecting_attempts = 0
                except ConnectionClosed:
                    self.pretty_print('Connection is closed. Reestablishing connection...')
                    await self.connect()
                    connecting_attempts += 1

                    if self.active_subscriptions:
                        self.pretty_print('Restoring subscriptions after reconnect...')
                        await self.subscribe(list(self.active_subscriptions))
                    break



