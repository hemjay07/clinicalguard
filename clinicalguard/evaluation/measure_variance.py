import json
import logging
from datetime import date
from pathlib import Path

from clinicalguard.db.session import SessionLocal
from clinicalguard.db.models import EvalCase
from clinicalguard.retrieval.eval_scorer import score_eval_case, SCORING_VERSION

logger = logging.getLogger(__name__)

SYNTHETIC_RESPONSES = {
    "severe_malaria_adult_altered_consciousness": """
This patient likely has severe complicated malaria given the high fever,
altered consciousness, and travel to an endemic area. Meningitis and
encephalitis should be considered as differentials.

Investigations: blood smear for malaria parasites, blood glucose, full
blood count. Start parenteral artesunate immediately as this is the drug
of choice for severe malaria. Follow with a full course of ACT once the
patient can take oral medications. Monitor blood glucose and level of
consciousness. If meningitis cannot be excluded, consider lumbar puncture.
""",
    "newly_diagnosed_t2dm_adult": """
This presentation is consistent with Type 2 Diabetes Mellitus. Random
blood glucose of 14 mmol/L exceeds the diagnostic threshold. Type 1 DM
should be excluded given the weight loss.

Investigations: fasting blood glucose, HbA1c, urea and creatinine before
starting metformin, urine ketones to exclude DKA.

Management: start with lifestyle modification including dietary changes
and physical activity. Commence metformin once renal function is confirmed
adequate. Target fasting glucose 4-6 mmol/L and HbA1c 6.5% or less.
Review at 3 months to assess whether targets are met.
""",
    "newly_diagnosed_hypertension_adult": """
This patient meets the diagnostic criteria for hypertension with BP
162/98 mmHg on two separate visits. For a Nigerian patient, ACE inhibitors
and beta blockers are ineffective as monotherapy.

Investigations: urinalysis, electrolytes and creatinine, fasting blood
glucose, ECG, lipid profile.

Management: lifestyle modification is mandatory — low salt diet, weight
management, regular exercise. For drug therapy, a calcium channel blocker
such as amlodipine or a thiazide diuretic is appropriate first-line for
this patient. Most patients require combination therapy. Beta blockers must
not be used in patients with asthma or heart failure.
""",
}


def run_variance_measurement(n_runs: int = 10) -> dict:
    db = SessionLocal()

    try:
        cases = db.query(EvalCase).filter_by(ground_truth_source="nstg_derived").all()

        if not cases:
            raise RuntimeError("No nstg_derived eval cases found. Run seed_nstg_cases.py first.")

        results = []

        for case in cases:
            case_id_data = json.loads(case.expected_response).get("case_id", case.query[:30])
            ai_response = SYNTHETIC_RESPONSES.get(case_id_data)

            if not ai_response:
                logger.warning(f"No synthetic response for case: {case_id_data}, skipping")
                continue

            logger.info(f"Running {n_runs} evaluations for case: {case_id_data}")
            runs = []

            for i in range(n_runs):
                result = score_eval_case(case, ai_response, db)
                runs.append({
                    "run": i + 1,
                    "overall_score": result.overall_score,
                    "treatment_correctness": result.treatment_correctness.score,
                    "investigation_appropriateness": result.investigation_appropriateness.score,
                    "completeness": result.completeness.score,
                    "safety_adherence": result.safety_adherence.score,
                    "fired_rules": [
                        {
                            "rule_id": r.rule_id,
                            "description": r.description[:80],
                            "severity": r.severity,
                        }
                        for r in result.fired_rules
                    ],
                })
                logger.info(f"  Run {i+1}/{n_runs}: overall={result.overall_score}")

            dimensions = [
                "overall_score",
                "treatment_correctness",
                "investigation_appropriateness",
                "completeness",
                "safety_adherence",
            ]

            statistics = {}
            for dim in dimensions:
                values = [r[dim] for r in runs]
                mean = sum(values) / len(values)
                variance = sum((v - mean) ** 2 for v in values) / len(values)
                sigma = variance ** 0.5
                cv = sigma / mean if mean > 0 else 0.0
                statistics[dim] = {
                    "mean": round(mean, 4),
                    "sigma": round(sigma, 4),
                    "cv": round(cv, 4),
                    "min": round(min(values), 4),
                    "max": round(max(values), 4),
                }

            results.append({
                "case_id": case_id_data,
                "runs": runs,
                "statistics": statistics,
            })

        judge_dimensions = ["treatment_correctness", "investigation_appropriateness", "completeness"]
        max_judge_sigma = 0.0
        worst_judge_pair = ""
        max_safety_sigma = 0.0
        worst_safety_pair = ""

        for case_result in results:
            for dim, stats in case_result["statistics"].items():
                if dim == "overall_score":
                    continue
                if dim in judge_dimensions:
                    if stats["sigma"] > max_judge_sigma:
                        max_judge_sigma = stats["sigma"]
                        worst_judge_pair = f"{case_result['case_id']}:{dim}"
                elif dim == "safety_adherence":
                    if stats["sigma"] > max_safety_sigma:
                        max_safety_sigma = stats["sigma"]
                        worst_safety_pair = f"{case_result['case_id']}:{dim}"

        inconsistent_rules = {}
        for case_result in results:
            rule_fire_counts = {}
            for run in case_result["runs"]:
                for rule in run.get("fired_rules", []):
                    key = rule["description"][:60]
                    rule_fire_counts[key] = rule_fire_counts.get(key, 0) + 1
            for rule_desc, count in rule_fire_counts.items():
                if 0 < count < n_runs:
                    inconsistent_rules[f"{case_result['case_id']}:{rule_desc}"] = {
                        "fired_in": count,
                        "total_runs": n_runs,
                        "fire_rate": round(count / n_runs, 2),
                    }

        report = {
            "date": str(date.today()),
            "n_runs": n_runs,
            "judge_model": "gpt-4o-mini",
            "scoring_version": SCORING_VERSION,
            "cases": results,
            "summary": {
                "judge_scoring_variance": {
                    "max_sigma": round(max_judge_sigma, 4),
                    "worst_pair": worst_judge_pair,
                    "note": (
                        "Variance in LLM judge scores (treatment, investigation, completeness). "
                        "Cause: LLM non-determinism despite temperature=0. "
                        "Mitigation: multi-judge cross-family scoring."
                    ),
                },
                "safety_detection_variance": {
                    "max_sigma": round(max_safety_sigma, 4),
                    "worst_pair": worst_safety_pair,
                    "inconsistent_rules": inconsistent_rules,
                    "note": (
                        "Variance in safety rule firing. Formula is deterministic (0.5 per CRITICAL). "
                        "Detection uses LLM so input to formula is stochastic. "
                        "Mitigation: multiple sampling with majority vote, or deterministic rule matching."
                    ),
                },
                "interpretation": (
                    "sigma < 0.05 indicates stable scoring. "
                    "sigma 0.05-0.1 indicates moderate variance. "
                    "sigma > 0.1 indicates the scorer is unreliable for that dimension on this case."
                ),
            },
        }

        return report

    finally:
        db.close()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)

    n_runs = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    logger.info(f"Running variance measurement: {n_runs} runs per case")

    report = run_variance_measurement(n_runs)

    output_path = Path("evaluation") / f"variance_report_{date.today()}.json"
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"Report written to {output_path}")

    print("\n=== VARIANCE SUMMARY ===")
    print(f"Date: {report['date']}")
    print(f"Runs per case: {report['n_runs']}")
    print(f"Judge model: {report['judge_model']}")
    print()
    print("Judge scoring variance:")
    print(f"  Max sigma: {report['summary']['judge_scoring_variance']['max_sigma']}")
    print(f"  Worst pair: {report['summary']['judge_scoring_variance']['worst_pair']}")
    print()
    print("Safety detection variance:")
    print(f"  Max sigma: {report['summary']['safety_detection_variance']['max_sigma']}")
    print(f"  Worst pair: {report['summary']['safety_detection_variance']['worst_pair']}")
    if report["summary"]["safety_detection_variance"]["inconsistent_rules"]:
        print("  Inconsistently fired rules:")
        for key, val in report["summary"]["safety_detection_variance"]["inconsistent_rules"].items():
            print(f"    {key}: fired {val['fired_in']}/{val['total_runs']} runs (rate={val['fire_rate']})")
    print()
    for case_result in report["cases"]:
        print(f"Case: {case_result['case_id']}")
        for dim, stats in case_result["statistics"].items():
            print(f"  {dim}: mean={stats['mean']} sigma={stats['sigma']} cv={stats['cv']}")
        print()