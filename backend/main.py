import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import auth_router
from api.tickers_rest import tickers_router
from api.tickers_ws import tickers_ws_router
from db import models
from db.relational_db import sync_engine
from services.connection_manager import ws_connection_manager
from core.settings import settings


models.Base.metadata.create_all(bind=sync_engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    sync_task =  asyncio.create_task(ws_connection_manager.ticker_sync_loop())
    redis_listener_task = asyncio.create_task(ws_connection_manager.redis_listener())

    yield

    sync_task.cancel()
    redis_listener_task.cancel()



origins = settings.ALLOWED_ORIGINS.split(',')

app = FastAPI(title='Financial Real Time Dashboard', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix='/auth', tags=['Authentication'])
app.include_router(tickers_router, prefix='/ticker', tags=['Ticker REST API'])
app.include_router(tickers_ws_router, prefix='/ticker', tags=['Ticker WS API'])


