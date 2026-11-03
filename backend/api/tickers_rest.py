import json
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, insert, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from api.dependencies import verify_admin, get_current_user
from db.models import Ticker
from db.relational_db import get_async_db
from core.utils import DateTimeUtil
from db.ts_db import read_client


class TickerCreate(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=10)
    name: str = Field(..., min_length=2, max_length=100)

    @field_validator('symbol')
    @classmethod
    def format_symbol(cls, value: str) -> str:
        return value.strip().upper()


class TickerUpdate(BaseModel):
    symbol: Optional[str] = Field(default=None, min_length=2, max_length=10)
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    is_active: Optional[bool] = Field(default=None)

    @field_validator('symbol')
    @classmethod
    def format_symbol(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            return value.strip().upper()
        return value


class TickerResponse(BaseModel):
    id: int
    symbol: str
    name: str
    is_active: bool


async def get_ticker(db_session: AsyncSession, symbol: str) -> Optional[Ticker]:
    symbol = symbol.strip().upper()

    stmt = select(Ticker).where(Ticker.symbol == symbol)
    result = await db_session.execute(stmt)

    ticker: Optional[Ticker] = result.scalar_one_or_none()

    return ticker

tickers_router = APIRouter()


@tickers_router.post('/create')
async def create(
        ticker_data: TickerCreate,
        token: str = Depends(verify_admin),
        db_session: AsyncSession = Depends(get_async_db)
):
    symbol = ticker_data.symbol
    name = ticker_data.name

    ticker = await get_ticker(db_session, symbol)

    if ticker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='This ticker already exists'
        )

    stmt = (
        insert(Ticker)
        .values(symbol=symbol, name=name, is_active=True)
        .returning(Ticker)
    )

    result = await db_session.execute(stmt)
    created_ticker = result.scalar_one()

    response = TickerResponse(**created_ticker.__dict__)

    await db_session.commit()

    return {'status': 'success', 'ticker': response}


@tickers_router.get('/list')
async def list_t(
        token: str = Depends(get_current_user),
        db_session: AsyncSession = Depends(get_async_db)
):
    stmt = select(Ticker)
    result = await db_session.execute(stmt)

    tickers = result.scalars().all()

    return {'status': 'success', 'tickers': tickers}


@tickers_router.delete('/{symbol}')
async def delete(
        symbol: str,
        token: str = Depends(verify_admin),
        db_session: AsyncSession = Depends(get_async_db)
):
    ticker = await get_ticker(db_session, symbol)

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    ticker.is_active = False

    await db_session.commit()

    return {'status': 'success'}


@tickers_router.get('/{symbol}')
async def recieve(
        symbol: str,
        token: str = Depends(get_current_user),
        db_session: AsyncSession = Depends(get_async_db)
):
    ticker = await get_ticker(db_session, symbol)

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    response = TickerResponse(**ticker.__dict__)

    return {'status': 'success', 'ticker': response}


@tickers_router.patch('/{symbol}')
async def update(
        data: TickerUpdate,
        symbol: str,
        token: str = Depends(verify_admin),
        db_session: AsyncSession = Depends(get_async_db)
):
    ticker = await get_ticker(db_session, symbol)

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(ticker, key, value)

    await db_session.commit()

    response = TickerResponse(**ticker.__dict__)

    return {'status': 'success', 'ticker': response}

@tickers_router.get('/{symbol}/recent')
async def test_request(
        symbol: str,
        hours: int = 3,
        exchange: str = 'binance',
        token: str = Depends(get_current_user),
        db_session: AsyncSession = Depends(get_async_db),
):
    ticker = await get_ticker(db_session, symbol)

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    result = await read_client.read_data(symbol, minutes=hours * 60, exchange=exchange)

    return {'amount': len(result), 'data': result}


@tickers_router.get('/{symbol}/raw')
async def receive_raw_ticker_data(
        symbol: str,
        token: str = Depends(get_current_user),
        db_session: AsyncSession = Depends(get_async_db),
        start: Optional[str] = None,
        end: Optional[str] = None,
        exchange: str = 'binance',
):
    ticker = await get_ticker(db_session, symbol)

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    if not start or not end:
        start = DateTimeUtil.get_relative_time(days=-1)
        end = DateTimeUtil.time_now()

    async def data_generator():
        async for record in read_client.stream_raw_ticks(symbol, start, end, exchange=[exchange, ]):
            yield json.dumps(record.__dict__) + '\n'

    return StreamingResponse(
        data_generator(),
        media_type = "application/x-ndjson"
    )




