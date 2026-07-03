from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from clinicalguard.config import settings


# pool_pre_ping: Supabase's pooler drops idle connections; without a pre-ping,
# a request that grabs a stale pooled connection stalls for seconds before
# erroring (observed as 3-10s responses on trivial endpoints). pool_recycle
# retires connections before the pooler's idle timeout can kill them.
engine = create_engine(
    str(settings.database_url),
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False
    )

class Base (DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
