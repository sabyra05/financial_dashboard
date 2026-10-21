import bcrypt
import jwt
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from passlib.context import CryptContext
from starlette import status

from core.settings import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM


def create_access_token(data: dict):
    """
        data = {
        "username": username,
        "role": role
        }
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})

    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token


def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(detail="Token has expired", status_code=status.HTTP_401_UNAUTHORIZED)
    except jwt.InvalidTokenError:
        raise HTTPException(detail="Invalid token", status_code=status.HTTP_401_UNAUTHORIZED)


def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    hashed_bytes = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt())
    return hashed_bytes.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    plain_password_bytes = plain_password.encode('utf-8')
    hashed_password_bytes = hashed_password.encode('utf-8')

    return bcrypt.checkpw(plain_password_bytes, hashed_password_bytes)