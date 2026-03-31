import logging

from clinicalguard.db.session import SessionLocal
from clinicalguard.ingestion.embeddings import embed_all_conditions

logging.basicConfig(level=logging.INFO)


def run() -> None:
    db = SessionLocal()
    try:
        embed_all_conditions(db)
    finally:
        db.close()


if __name__ == "__main__":
    run()