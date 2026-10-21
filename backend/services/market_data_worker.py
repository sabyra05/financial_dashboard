import asyncio
from asyncio import Queue, Event, Task
from typing import List, Optional

import pandas as pd
from sqlalchemy import select

from db import models
from db.relational_db import SyncSessionLocal, AsyncSessionLocal
from db.ts_db import write_client, TickerTSModel
from services.exchanges import EXCHANGE_CLASSES
from db.models import Ticker


class MainWorker:

    def __init__(self):
        self.subscribed_tickers: set = set()
        self.tickers_to_unsubscribe: set = set()
        self.tickers_to_subscribe: set = set()
        self.batch: list = list()

        self.adapters: list

        self.queue: Queue = Queue(maxsize=5000)
        self.stop_event: Event = Event()
        self.tasks: List[Task] = []

        self.adapters = [i(self.queue, self.stop_event) for i in EXCHANGE_CLASSES]


    async def get_active_tickers(self) -> Optional[set]:
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(Ticker.symbol).where(Ticker.is_active == True)
                result = await session.execute(stmt)

                tickers = set(result.scalars().all())
                return tickers
            except Exception as e:
                self.pretty_print(f'{repr(e)} occurred in get_active_tickers')
                return self.subscribed_tickers

    async def ticker_sync_loop(self):
        """
        TODO: add functionality to unsubscribe
        """
        while not self.stop_event.is_set():
            try:
                tickers_from_db = await self.get_active_tickers()
                ticker_symbols_from_db = set([i for i in tickers_from_db])

                self.tickers_to_unsubscribe = self.subscribed_tickers - ticker_symbols_from_db
                self.tickers_to_subscribe = ticker_symbols_from_db - self.subscribed_tickers

                if self.tickers_to_subscribe:
                    for adapter in self.adapters:
                        await adapter.subscribe(list(self.tickers_to_subscribe))

                self.subscribed_tickers = ticker_symbols_from_db

                    # if self.tickers_to_unsubscribe:
                    # ...

            except Exception as e:
                self.pretty_print(f'{repr(e)} occurred in ticker_sync_loop')

            try:
                await asyncio.wait_for(self.stop_event.wait(), timeout=60)
            except asyncio.TimeoutError:
                pass

    async def connect(self):
        for i in self.adapters:
            try:
                self.pretty_print(f'Connection in {i.name} is initializing')
                await i.connect()
                self.pretty_print(f'Connection in {i.name} is initialized successfully!')
            except Exception as e:
                self.pretty_print(f'{repr(e)} occurred in connect with {i.name}')

    async def subscribe(self):
        for i in self.adapters:
            try:
                self.pretty_print(f'Subscription in {i.name} is initializing')
                await i.subscribe(self.tickers_to_subscribe)
                self.pretty_print(f'Subscription in {i.name} is initialized successfully!')
            except Exception as e:
                self.pretty_print(f'{repr(e)} occurred in connect with {i.name}')

    async def parse_save_data_tsdb(self):
        while not self.stop_event.is_set():
            while not self.queue.empty():
                queue_item: Ticker = self.queue.get_nowait()
                self.batch.append(
                    {
                        'exchange': queue_item.exchange,
                        'symbol': queue_item.symbol,
                        'qty': queue_item.qty,
                        'price': queue_item.price,
                    }
                )

            if self.batch:
                temp_df = pd.DataFrame(self.batch)

                temp_df['quantity'] = temp_df['qty'].astype(float)
                temp_df['price'] = temp_df['price'].astype(float)
                temp_df['total_price'] = temp_df['price'] * temp_df['quantity']

                self.pretty_print(f'The Batch of [{len(self.batch)}] transactions is processed.')

                res = temp_df.groupby(['exchange', 'symbol']).agg(
                    amount=('price', 'count'),
                    total_qty=('quantity', 'sum'),
                    min_price=('price', 'min'),
                    max_price=('price', 'max'),
                    avg_price=('price', 'mean'),
                    min_total_price=('total_price', 'min'),
                    max_total_price=('total_price', 'max'),
                    avg_total_price=('total_price', 'mean'),
                )

                res = res.reset_index()

                records = res.to_dict(orient='records')
                validated_records = [TickerTSModel(**i) for i in records]

                for i in validated_records:
                    write_client.batch_append(i)

                await write_client.write_batch_data()

                self.batch.clear()
            try:
                await asyncio.wait_for(self.stop_event.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                pass

    async def start(self):
        await self.connect()

        for i in self.adapters:
            self.tasks.append(
                asyncio.create_task(i.listen())
            )

        self.tasks.append(
            asyncio.create_task(self.ticker_sync_loop())
        )

        self.tasks.append(
            asyncio.create_task(self.parse_save_data_tsdb())
        )

        await self.stop_event.wait()

    def pretty_print(self, msg: str):
        print(f'[Main Worker] {msg}')


async def main():
    worker = MainWorker()
    await worker.start()


if __name__ == '__main__':
    asyncio.run(main())
