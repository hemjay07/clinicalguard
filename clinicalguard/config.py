from pydantic_settings import BaseSettings
from pydantic import PostgresDsn

class Settings(BaseSettings):
    database_url: PostgresDsn
    openai_api_key: str
    anthropic_api_key: str
    # Signs the session cookie (ADR-030). Required — no insecure default.
    session_secret_key: str
    # False for local dev (HTTP); set True on Railway so the cookie is
    # Secure + SameSite=None, which cross-origin (Vercel↔Railway) requires.
    cookie_secure: bool = False

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        # Ignore unrelated env vars (e.g. FRONTEND_ORIGIN, PORT on the host) so
        # deployment platforms that inject extra variables don't break startup.
        "extra": "ignore",
    }


settings = Settings()