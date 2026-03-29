from sqlalchemy import text
from clinicalguard.db.session import engine, Base
from clinicalguard.db import models  # noqa: F401 - imports models so Base knows about them


def run_migrations() -> None:
    # Run raw SQL extensions first
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        conn.commit()

    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Migrations complete.")


if __name__ == "__main__":
    run_migrations()