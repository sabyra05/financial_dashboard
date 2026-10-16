import asyncio
import signal
import pandas as pd
from typing import Set, List

from db.relational_db import SessionLocal
from db import models
from db.ts_db import write_client
from services.exchanges import BinanceExchange

queue: asyncio.Queue = asyncio.Queue()
stop_event: asyncio.Event = asyncio.Event()

adapters = [
    BinanceExchange(queue=queue, stop_event=stop_event)
]
subscribed_tickers: Set[str] = set()


def fetch_active_tickers_from_sql() -> Set[str]:
    db = SessionLocal()
    try:
        tickers = db.query(models.Ticker.symbol).filter(models.Ticker.is_active == True).all()
        return {t.symbol for t in tickers}
    finally:
        db.close()


async def ticker_sync_loop():
    global subscribed_tickers

    while not stop_event.is_set():
        try:
            db_tickers = fetch_active_tickers_from_sql()
            new_tickers = db_tickers - subscribed_tickers

            if new_tickers:
                print(f"[Worker] New Tickers in SQL DB are found! \n {new_tickers}")
                for adapter in adapters:
                    await adapter.subscribe(list(new_tickers))
                subscribed_tickers.update(new_tickers)

        except Exception as e:
            print(f"[Worker] Tickers could not be synchronized \n {repr(e)}")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=60.0)
        except asyncio.TimeoutError:
            pass


async def data_consumer_loop():
    while not stop_event.is_set():
        batch_items: List[dict] = []

        while not queue.empty():
            try:
                ticker = queue.get_nowait()

                ticker_dict = ticker.model_dump() if hasattr(ticker, "model_dump") else ticker.dict()
                batch_items.append(ticker_dict)
                queue.task_done()
            except asyncio.QueueEmpty:
                break

        if batch_items:

            df = pd.DataFrame(batch_items)

            # aggregated_df = df.groupby('symbol').agg({
            #     'price': 'mean',
            #     'qty': 'sum'
            # }).reset_index()

            for row in df.itertuples():
                write_client.batch_append(
                    symbol=row.symbol,
                    exchange=getattr(row, "exchange", "binance"),
                    price=float(row.price)
                )

            await write_client.write_batch_data()

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1.0)
        except asyncio.TimeoutError:
            pass


async def main():
    global subscribed_tickers
    print("[Worker] Starting collecting data")

    subscribed_tickers = fetch_active_tickers_from_sql()

    for adapter in adapters:
        await adapter.connect()
        if subscribed_tickers:
            await adapter.subscribe(list(subscribed_tickers))

    tasks = []

    for adapter in adapters:
        tasks.append(asyncio.create_task(adapter.listen()))

    tasks.append(asyncio.create_task(ticker_sync_loop()))
    tasks.append(asyncio.create_task(data_consumer_loop()))

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    print("[Worker] All listeners are successfully started!")

    await stop_event.wait()

    print("[Worker] Finishing work...")

    for task in tasks:
        task.cancel()

    await asyncio.gather(*tasks, return_exceptions=True)

    for adapter in adapters:
        await adapter.disconnect()
    await write_client.close()

    print("[Worker] Work is finished")


if __name__ == "__main__":
    asyncio.run(main())
