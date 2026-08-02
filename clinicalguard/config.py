from pydantic_settings import BaseSettings
from pydantic import PostgresDsn

class Settings(BaseSettings):
    database_url: PostgresDsn
    openai_api_key: str
    anthropic_api_key: str
    # Supabase project URL (https://<ref>.supabase.co) — used to fetch the
    # JWKS that verifies Supabase Auth access tokens (ADR-031).
    supabase_url: str
    # The one owner identity (ADR-031): the verified account allowed to read
    # results in aggregate (all cases, all decomposition responses). Not a
    # roles system — owner-vs-rater is the only access distinction.
    owner_email: str = "irfanjimoh123@gmail.com"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        # Ignore unrelated env vars (e.g. FRONTEND_ORIGIN, PORT on the host) so
        # deployment platforms that inject extra variables don't break startup.
        "extra": "ignore",
    }


settings = Settings()
