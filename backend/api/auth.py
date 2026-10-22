from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from core.security import create_access_token, get_password_hash, verify_password
from db.models import User
from db.relational_db import get_async_db


class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=100, description='Username has to be unique')
    role: Literal['admin', 'user'] = Field(default='user', description='User role')
    password: str = Field(..., min_length=3, description='Password has to be at least 3 symbols long')


class UserResponse(BaseModel):
    id: int
    username: str
    role: Literal['admin', 'user']


auth_router = APIRouter()


@auth_router.get('/ping')
async def ping():
    return 'pong'


@auth_router.post('/registrate')
async def registrate(user_data: UserCreate, db_session: AsyncSession = Depends(get_async_db)):
    username = user_data.username
    password = user_data.password
    role = user_data.role

    stmt = select(User).where(User.username == username)
    result = await db_session.execute(stmt)

    user = result.scalars().first()

    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='User with this username already exists'
        )

    hashed_password = get_password_hash(password)

    stmt = (
        insert(User)
        .values(username=username, role=role, hashed_password=hashed_password)
        .returning(User)
    )

    result = await db_session.execute(stmt)
    created_user = result.scalar_one()

    response = UserResponse(**created_user.__dict__)

    await db_session.commit()

    return {'status': 'success', 'user': response}


@auth_router.post('/login')
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db_session: AsyncSession = Depends(get_async_db)):
    username = form_data.username
    password = form_data.password

    stmt = select(User).where(User.username == username)
    result = await db_session.execute(stmt)
    user: User = result.scalars().first()

    if not user:
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User was not found'
        )

    hashed_password = get_password_hash(password)
    if not verify_password(password, hashed_password):
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Wrong password'
        )

    token = create_access_token(
        {
            'username': username,
            'role': user.role
        }
    )

    return {'status': 'success', 'token': token}
