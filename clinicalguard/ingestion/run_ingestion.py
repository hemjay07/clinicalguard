import logging
import sys
from pathlib import Path

from clinicalguard.db.session import SessionLocal
from clinicalguard.ingestion.nstg import ingest_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run(limit: int | None = None) -> None:
    data_dir = Path("data/raw/nstg/processed_json")

    if not data_dir.exists():
        logger.error(f"Data directory not found: {data_dir}")
        sys.exit(1)

    files = sorted(data_dir.glob("*.json"))

    if limit:
        files = files[:limit]

    logger.info(f"Found {len(files)} files")

    succeeded = []
    failed = []
    skipped = []

    db = SessionLocal()
    try:
        for filepath in files:
            if "_2.json" in filepath.name:
                logger.info(f"Skipping duplicate: {filepath.name}")
                skipped.append(filepath.name)
                continue

            try:
                condition = ingest_file(db, filepath)
                db.commit()
                succeeded.append(condition.name)
            except Exception as e:
                db.rollback()
                logger.error(f"Failed: {filepath.name} — {e}")
                failed.append((filepath.name, str(e)))
    finally:
        db.close()

    logger.info(f"\n--- Ingestion Report ---")
    logger.info(f"Succeeded: {len(succeeded)}")
    logger.info(f"Skipped (duplicates): {len(skipped)}")
    logger.info(f"Failed: {len(failed)}")
    if failed:
        logger.error("Failed files:")
        for name, error in failed:
            logger.error(f"  {name}: {error}")

            
if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run(limit=limit)