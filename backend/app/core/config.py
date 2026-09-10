from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    db_url : str
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Email (Zoho ZeptoMail)
    zeptomail_api_key: str
    zeptomail_from_address: str

    # Storage (Cloudflare R2)
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket_name: str

    # otp 
    OTP_EXPIRY_SECONDS:int = 300  # 5 minutes
    OTP_LENGTH:int = 6