import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.auth import auth_router
from api.tickers_rest import tickers_router
from db import models
from db.relational_db import engine
from db.ts_db import tickers_db


models.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await tickers_db.read_db()
    # task = asyncio.create_task()

    yield

    # task.cancel()
    await tickers_db.write_db()

app = FastAPI(title='Financial Real Time Dashboard', lifespan=lifespan)

app.include_router(auth_router, prefix='/auth', tags=['Authentication'])
app.include_router(tickers_router, prefix='/ticker', tags=['Ticker REST'])


