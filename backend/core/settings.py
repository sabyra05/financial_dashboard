from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Financial Real-Time Dashboard"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    SQLALCHEMY_DATABASE_URL: str

    POSTGRES_HOST: str
    POSTGRES_PORT: str
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str

    INFLUXDB_ADMIN_TOKEN: str
    INFLUXDB_WRITE_TOKEN: str
    INFLUXDB_READ_TOKEN: str
    INFLUXDB_BUCKET: str
    INFLUXDB_ORGANIZATION: str
    INFLUXDB_URL: str
    INFLUXDB_ADMIN: str
    INFLUXDB_ADMIN_PASSWORD: str

    REDIS_URL: str

    model_config = SettingsConfigDict(env_file=ENV_FILE_PATH, env_file_encoding="utf-8")

settings = Settings()