import json
import aiofiles


class TSDB:
    db: dict
    def __init__(self):
        self.db = {}
        '''
        {
            'BTCUSD': {
                'id': 1,
                'symbol': 'BTCUSD',
                'price': 0.1
            },
            ...   
        }
        '''

    async def read_db(self):
        async with aiofiles.open('./db/tickers_db.json', 'r') as file:
            file_content = await file.read()

            if not file_content:
                return None

            self.db = json.loads(file_content)
            return None


    async def write_db(self):
        async with aiofiles.open('./db/tickers_db.json', 'w') as file:
            await file.write( json.dumps(self.db, indent=4) )


tickers_db = TSDB()
