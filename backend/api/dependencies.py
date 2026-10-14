from fastapi import Header, HTTPException, Depends
from starlette import status

from core.security import verify_access_token
from core.settings import settings

SECRET_KEY = settings.SECRET_KEY


async def get_current_user(token: str = Header(..., description='Access Token')):
    if verify_access_token(token):
        return token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Provided token is not valid or expired'
    )

async def verify_admin(token: str = Depends(get_current_user)):
    user_data = verify_access_token(token)
    if user_data.get('role') == 'admin':
        return token
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail='You do not have credentials'
    )