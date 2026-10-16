from typing import Optional, List

from influxdb_client import Point
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync

from core.settings import settings


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

    def batch_append(self, symbol: str, exchange: str, price: float):
        self.batch.append(
            Point('tickers')
            .tag('symbol', symbol.upper())
            .tag('exchange', exchange.lower())
            .field('price', float(price))
        )

    async def write_single_data(self, symbol: str, exchange: str, price: float):
        if self.client is None:
            await self.connect()

        point = (
            Point('tickers')
            .tag('symbol', symbol.upper())
            .tag('exchange', exchange.lower())
            .field('price', float(price))
        )

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
        self.query_api = None

    async def connect(self):
        if self.client is None:
            self.client = InfluxDBClientAsync(url=self.url, token=self.token, org=self.org)
            self.query_api = self.client.query_api()

    async def read_data(
            self,
            symbol: str,
            exchange: Optional[List[str]] = None,
            minutes: int = 60
    ):

        if self.client is None:
            await self.connect()

        query = f'''
            from(bucket: "{self.bucket}")
            |> range(start: -{minutes}m)
            |> filter(fn: (r) => r._measurement == "tickers")
            |> filter(fn: (r) => r.symbol == "{symbol.upper()}")
            |> filter(fn: (r) => r._field == "price")
        '''

        if exchange and 'all' not in exchange:
            exchange_list_lower = [i.lower() for i in exchange]
            exchange_filter = ' or '.join([f'r.exchange == "{i}"' for i in exchange_list_lower])
            query += f'\n|> filter(fn: (r) => {exchange_filter})'

        tables = await self.query_api.query(query)

        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "time": record.get_time().isoformat(),
                    "symbol": record.values.get("symbol"),
                    "exchange": record.values.get("exchange"),
                    "price": record.get_value()
                })

        return results


write_client = InfluxWriteClient()
read_client = InfluxReadClient()
