from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from starlette import status

from api.dependencies import verify_admin, get_current_user
from db import models
from db.relational_db import get_sync_db


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


tickers_router = APIRouter()


@tickers_router.post('/create')
async def create(
        ticker_data: TickerCreate,
        token: str = Depends(verify_admin),
        db: Session = Depends(get_sync_db)
):
    symbol = ticker_data.symbol
    name = ticker_data.name
    if db.query(models.Ticker).filter(models.Ticker.symbol == symbol).first():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='This ticker already exists'
        )

    new_ticker = models.Ticker(symbol=symbol, name=name)

    db.add(new_ticker)
    db.commit()
    db.refresh(new_ticker)

    return {'status': 'success', 'ticker': new_ticker}


@tickers_router.get('/list')
async def list_t(
        token: str = Depends(get_current_user),
        db: Session = Depends(get_sync_db)
):
    tickers = db.query(models.Ticker).all()
    return {'status': 'success', 'tickers': tickers}


@tickers_router.delete('/{symbol}')
async def delete(
        symbol: str,
        token: str = Depends(verify_admin),
        db: Session = Depends(get_sync_db)
):
    symbol = symbol.strip().upper()
    ticker = db.query(models.Ticker).filter(models.Ticker.symbol == symbol).first()

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    db.delete(ticker)
    db.commit()

    return {'status': 'success'}


@tickers_router.get('/{symbol}')
async def recieve(
        symbol: str,
        token: str = Depends(get_current_user),
        db: Session = Depends(get_sync_db)
):
    symbol = symbol.strip().upper()
    ticker = db.query(models.Ticker).filter(models.Ticker.symbol == symbol).first()

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    return {'status': 'success', 'ticker': ticker}


@tickers_router.patch('/{symbol}')
async def update(
        data: TickerUpdate,
        symbol: str,
        token: str = Depends(verify_admin),
        db: Session = Depends(get_sync_db)
):
    symbol = symbol.strip().upper()
    ticker = db.query(models.Ticker).filter(models.Ticker.symbol == symbol).first()

    if not ticker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='This ticker doesnt exist'
        )

    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(ticker, key, value)

    db.commit()
    db.refresh(ticker)

    return {'status': 'success', 'ticker': ticker}
