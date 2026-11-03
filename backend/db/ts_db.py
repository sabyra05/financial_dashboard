import json
from typing import Optional, List, AsyncGenerator

from influxdb_client import Point
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync, QueryApiAsync
from pydantic import BaseModel, ConfigDict

from core.settings import settings


class TickerTSModel(BaseModel):
    time: Optional[str] = None
    symbol: str
    exchange: str
    amount: int
    total_qty: float
    min_price: float
    max_price: float
    avg_price: float
    min_total_price: float
    max_total_price: float
    avg_total_price: float

    model_config = ConfigDict(extra="ignore")

class InfluxBaseClient:
    def __init__(self):
        self.client: InfluxDBClientAsync | None = None

        self.org: str = settings.INFLUXDB_ORGANIZATION
        self.url: str = settings.INFLUXDB_URL
        self.bucket: str = settings.INFLUXDB_BUCKET
        self.token: str | None = None

    async def close(self):
        if self.client:
            await self.client.close()


class InfluxWriteClient(InfluxBaseClient):

    def __init__(self):
        super().__init__()
        self.token = settings.INFLUXDB_WRITE_TOKEN
        self.write_api = None
        self.batch: list[Point] = []

    async def connect(self):
        if self.client is None:
            self.client = InfluxDBClientAsync(url=self.url, token=self.token, org=self.org)
            self.write_api = self.client.write_api()

    def create_point(self, ticker_data: TickerTSModel) -> Point:
        point = (
            Point('tickers')
            .tag('symbol', ticker_data.symbol.upper())
            .tag('exchange', ticker_data.exchange.lower())
            .field('amount', float(ticker_data.amount))
            .field('total_qty', float(ticker_data.total_qty))
            .field('min_price', float(ticker_data.min_price))
            .field('max_price', float(ticker_data.max_price))
            .field('avg_price', float(ticker_data.avg_price))
            .field('min_total_price', float(ticker_data.min_total_price))
            .field('max_total_price', float(ticker_data.max_total_price))
            .field('avg_total_price', float(ticker_data.avg_total_price))
        )
        return point

    def batch_append(self, ticker_data: TickerTSModel):
        try:
            self.batch.append(
                self.create_point(ticker_data)
            )
        except Exception as e:
            print(f'{repr(e)} occurred in batch_append')

    async def write_single_data(self, ticker_data: TickerTSModel):
        if self.client is None:
            await self.connect()

        point = self.create_point(ticker_data)

        await self.write_api.write(bucket=self.bucket, record=point)

    async def write_batch_data(self):
        if not self.batch:
            return

        if self.client is None:
            await self.connect()

        batch_to_send = self.batch.copy()
        self.batch.clear()

        try:
            await self.write_api.write(bucket=self.bucket, record=batch_to_send)
        except Exception as e:
            print(f'{repr(e)} in write_batch_data')


class InfluxReadClient(InfluxBaseClient):

    def __init__(self):
        super().__init__()
        self.token = settings.INFLUXDB_READ_TOKEN
        self.query_api: Optional[QueryApiAsync] = None

    async def connect(self):
        if self.client is None:
            self.client = InfluxDBClientAsync(url=self.url, token=self.token, org=self.org)
            self.query_api = self.client.query_api()

    async def read_data(
            self,
            symbol: str,
            exchange: Optional[List[str]] = None,
            minutes: int = 1
    ):

        if self.client is None:
            await self.connect()

        query = f'''
            from(bucket: "{self.bucket}")
            |> range(start: -{minutes}m)
            |> filter(fn: (r) => r._measurement == "tickers")
            |> filter(fn: (r) => r.symbol == "{symbol.upper()}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''

        if exchange and 'all' not in exchange:
            exchange_list_lower = [i.lower() for i in exchange]
            exchange_filter = ' or '.join([f'r.exchange == "{i}"' for i in exchange_list_lower])
            query += f'\n|> filter(fn: (r) => {exchange_filter})'

        tables = await self.query_api.query(query)

        results = []
        for record in tables[0].records:
            results.append(TickerTSModel(**record.values, time=record.get_time().isoformat()))

        return results

    async def stream_raw_ticks(
            self,
            symbol: str,
            start: str,
            end: str,
            exchange: Optional[List[str]] = None,
    ) -> AsyncGenerator[TickerTSModel]:

        if self.client is None:
            await self.connect()

        query = f'''
            from(bucket: "{self.bucket}") 
            |> range(start: time(v: "{start}"), stop: time(v: "{end}")) 
            |> filter(fn: (r) => r._measurement == "tickers") 
            |> filter(fn: (r) => r.symbol == "{symbol.upper()}") 
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''

        if exchange and 'all' not in exchange:
            exchange_list_lower = [i.lower() for i in exchange]
            exchange_filter = ' or '.join([f'r.exchange == "{i}"' for i in exchange_list_lower])
            query += f'\n|> filter(fn: (r) => {exchange_filter})'


        record_stream = await self.query_api.query_stream(query)

        async for i in record_stream:
            yield TickerTSModel(**i.values, time=i.get_time().isoformat())




write_client = InfluxWriteClient()
read_client = InfluxReadClient()
