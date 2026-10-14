from sqlalchemy.sql.schema import Column
from sqlalchemy.sql.sqltypes import Integer, String, Boolean

from db.relational_db import Base


class User(Base):
    __tablename__ = 'Users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, default='user', nullable=False)
    hashed_password = Column(String, nullable=False)


class Ticker(Base):
    __tablename__ = 'Tickers'
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
