from pydantic_settings import BaseSettings
from pydantic import PostgresDsn

class Settings(BaseSettings):
    database_url: PostgresDsn
    openai_api_key: str
    anthropic_api_key: str

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        # Ignore unrelated env vars (e.g. FRONTEND_ORIGIN, PORT on the host) so
        # deployment platforms that inject extra variables don't break startup.
        "extra": "ignore",
    }


settings = Settings()