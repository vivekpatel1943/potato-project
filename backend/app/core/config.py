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

    # Email (SMTP)
    smtp_host: str
    smtp_port: int = 587
    smtp_user: str
    smtp_password: str
    smtp_from_address: str

    # Storage (Cloudflare R2)
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_endpoint: str
    r2_private_bucket: str
    r2_public_bucket: str
    r2_potato_public_base_url: str
    max_image_upload_mb: int = 10
    max_doc_upload_mb: int = 20

    # otp 
    OTP_EXPIRY_SECONDS:int = 300  # 5 minutes
    OTP_LENGTH:int = 6

    # Rate limiting
    otp_rate_limit_seconds: int = 60  # 1 request per IP per 60s
    phone_rate_limit_seconds: int = 60

    # CORS
    cors_origins: str = "http://localhost:5173,http://192.168.1.19:5173,http://192.168.1.24:5173,https://renegade-granular-overtly.ngrok-free.dev"  # comma-separated for multiple

    # Phone verification (WhatsApp)
    whatsapp_verify_number: str = "918103614609"
    phone_verify_expiry_seconds: int = 300
    phone_verify_code_length: int = 6

    # Web Push (VAPID). If keys are empty, push sending is skipped with a warning.
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_claim_email: str = "mailto:vivekptl391@gmail.com"

    # Task matching
    search_radius_km: float = 10.0
    worker_location_ttl_seconds: int = 7200  # live GPS stays valid for 2 hours