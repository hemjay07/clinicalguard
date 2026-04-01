from clinicalguard.retrieval.hybrid import hybrid_search
from clinicalguard.db.session import Base, SessionLocal, engine



def test_meningitis_in_top_5() -> None:
    session = SessionLocal()
    try:
        query = "child with high fever and neck stiffness"
        results = hybrid_search(query, session)
        condition_names = [r.condition_name.lower() for r in results]
        assert "meningitis" in condition_names
    finally:
        session.close()


def test_hyde_mode_works_fine()-> None:
    session = SessionLocal()

    try:
        query = "child with high fever and neck stiffness"
        results =hybrid_search(query, session, use_hyde=True) 
        assert results
    finally:
        session.close()
