from clinicalguard.db.session import engine
from sqlalchemy import text


def test_database_connection() -> None:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


def test_tables_exist() -> None:
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        tables = [row[0] for row in result]
        
    expected = [
        "guideline_datasets",
        "conditions",
        "condition_synonyms",
        "condition_findings",
        "condition_severity_tiers",
        "condition_treatments",
        "condition_differentials",
        "condition_safety_rules",
        "condition_embeddings",
        "audit_log",
    ]
    
    for table in expected:
        assert table in tables, f"Missing table: {table}"