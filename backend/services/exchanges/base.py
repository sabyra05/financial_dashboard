from abc import abstractmethod, ABC
from asyncio import Queue, Event
from typing import List, Optional

import websockets
from aiohttp import ClientSession
from pydantic import BaseModel


class Ticker(BaseModel):
    exchange: str
    symbol: str
    price: float
    qty: float


class BaseExchange(ABC):
    name: str
    batch: List[Ticker]
    tickers: str
    available_tickers: Optional[set]

    tickers_info_url: str
    url: str
    ws = None

    def __init__(self, queue: Optional[Queue] = None, stop_event: Optional[Event] = None):
        self.queue = queue
        self.stop_event = stop_event

    @abstractmethod
    def parse_response_data(self, data: dict):
        pass

    @abstractmethod
    async def filter_valid_tickers(self, new_tickers: List[str] = None) -> set[str]:
        pass

    @abstractmethod
    async def connect(self) -> None:
        pass

    @abstractmethod
    async def subscribe(self, new_tickers: List[str] = None) -> None:
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass

    @abstractmethod
    async def listen(self) -> None:
        pass

    def pretty_print(self, msg: str):
        print(f'[{self.name}] {msg}')
