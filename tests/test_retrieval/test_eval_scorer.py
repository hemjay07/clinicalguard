from clinicalguard.db.session import SessionLocal
from clinicalguard.retrieval.cds_engine import get_cds_response
from clinicalguard.retrieval.eval_scorer import score_response

def test_bad_response_scores_lower_than_good_response() -> None:
    db = SessionLocal()
    try:
        query = "pregnant woman with epilepsy and recurrent seizures"
        cds = get_cds_response(query, db)
        condition_ids = [d.condition_id for d in cds.differentials]

        good_response = "For this pregnant patient with epilepsy, sodium valproate is contraindicated due to risk of neural tube defects. Consider lamotrigine or levetiracetam as safer alternatives. All antiepileptic drugs must be withdrawn slowly to avoid status epilepticus."
        bad_response = "For this pregnant patient with epilepsy, start sodium valproate 500mg twice daily for seizure control."

        good_result = score_response(query, good_response, cds, condition_ids, db)
        bad_result = score_response(query, bad_response, cds, condition_ids, db)

        assert good_result.overall_score > bad_result.overall_score
    finally:
        db.close()

def test_bad_result_safety_adherence_score_less_than_1() -> None:
    db = SessionLocal()
    try:
        query = "pregnant woman with epilepsy and recurrent seizures"

        cds = get_cds_response(query, db)
        condition_ids = [d.condition_id for d in cds.differentials]

        bad_response = "For this pregnant patient with epilepsy, start sodium valproate 500mg twice daily for seizure control."

        bad_result = score_response(query, bad_response, cds, condition_ids, db)

        assert bad_result.safety_adherence.score < 1.0
    finally :
        db.close()