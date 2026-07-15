import json
import logging
import statistics
import time
from datetime import date
from pathlib import Path

from sqlalchemy.exc import OperationalError

from clinicalguard.db.session import SessionLocal
from clinicalguard.db.models import EvalCase
from clinicalguard.evaluation.generate_response import load_response
from clinicalguard.retrieval.eval_scorer import score_eval_case, SCORING_VERSION, RUBRIC_JUDGE_MODEL
from clinicalguard.safety.engine import get_relevant_rules, SAFETY_JUDGE_MODEL

logger = logging.getLogger(__name__)

DEFAULT_CASE_IDS = [103, 119, 139]
CHECKPOINT_PATH = Path("evaluation") / ".variance_checkpoint.json"


def _checkpoint_key(case_id: int, suffix: str, n_runs: int) -> str:
    return f"{case_id}:{suffix or 'clean'}:{n_runs}"


# Checkpoint entries are keyed by (case_id, variant, n_runs) only — not by a
# hash of the frozen response's content. If a frozen response under
# evaluation/generated_responses/ is regenerated with the same case_id and
# suffix, a stale checkpointed result will be silently reused instead of
# rescoring the new response. Delete evaluation/.variance_checkpoint.json
# before rerunning if you've regenerated any frozen response.


def _load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH) as f:
            return json.load(f)
    return {}


def _save_checkpoint(checkpoint: dict) -> None:
    CHECKPOINT_PATH.parent.mkdir(exist_ok=True)
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(checkpoint, f, indent=2)


def _with_retry(fn, db, attempts: int = 3):
    # A long-running job holds one session open across many runs without
    # ever committing, so the connection stays checked out the whole time —
    # pool_recycle never gets a chance to act because the connection is
    # never returned to the pool, and a mid-run drop from Supabase's pooler
    # can kill an in-flight query. Retry with a rollback (which ends the
    # transaction and releases the connection, letting pool_pre_ping
    # re-validate on the next checkout) before giving up.
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except OperationalError:
            db.rollback()
            if attempt == attempts:
                raise
            logger.warning(f"DB connection error on attempt {attempt}/{attempts}, retrying...")
            time.sleep(2)


def run_variance_measurement(
    case_ids: list[int], n_runs: int = 30, suffixes: list[str] = [""]
) -> dict:
    # suffixes selects which frozen response variant(s) to score per case,
    # e.g. [""] for the clean response, ["unclean"] for the deliberately
    # unclean one, or ["", "unclean"] to run both. Each (case, suffix) pair
    # is scored independently and reported as its own case entry.
    db = SessionLocal()

    try:
        cases = db.query(EvalCase).filter(EvalCase.id.in_(case_ids)).all()
        found_ids = {c.id for c in cases}
        missing = set(case_ids) - found_ids
        if missing:
            raise RuntimeError(f"No eval case found for id(s): {sorted(missing)}")
        cases_by_id = {c.id: c for c in cases}

        # Checkpointing: this job can run for a long time (many LLM calls per
        # run, many runs per case+variant), and a mid-job DB/network blip
        # would otherwise throw away every completed run — the report was
        # only ever written to disk once, at the very end. Each (case,
        # variant, n_runs) combo is checkpointed to disk the moment it
        # finishes, and a combo already present in the checkpoint is skipped
        # entirely on the next invocation instead of re-run.
        checkpoint = _load_checkpoint()
        results = []

        for case_id in case_ids:
            case = cases_by_id[case_id]
            for suffix in suffixes:
                base_case_id_data = json.loads(case.expected_response).get("case_id", case.query[:30])
                case_id_data = f"{base_case_id_data} [{suffix}]" if suffix else base_case_id_data

                ckpt_key = _checkpoint_key(case_id, suffix, n_runs)
                if ckpt_key in checkpoint:
                    logger.info(f"Skipping case {case.id} ({case_id_data}): already checkpointed")
                    results.append(checkpoint[ckpt_key])
                    continue

                ai_response = load_response(case.id, suffix=suffix)

                logger.info(f"Running {n_runs} evaluations for case {case.id} ({case_id_data})")
                runs = []

                for i in range(n_runs):
                    result = _with_retry(lambda: score_eval_case(case, ai_response, db), db)
                    db.commit()
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

                statistics_by_dim = {}
                for dim in dimensions:
                    values = [r[dim] for r in runs]
                    mean = statistics.mean(values)
                    # Sample stdev (n-1 denominator): we're estimating run-to-run
                    # variability from a sample of runs, not measuring the full
                    # population of possible runs. Population stdev underestimates
                    # true variance here.
                    sigma = statistics.stdev(values) if len(values) > 1 else 0.0
                    cv = sigma / mean if mean > 0 else 0.0
                    statistics_by_dim[dim] = {
                        "mean": round(mean, 4),
                        "sigma": round(sigma, 4),
                        "cv": round(cv, 4),
                        "min": round(min(values), 4),
                        "max": round(max(values), 4),
                    }

                # Per-rule fire rate across all runs, for every rule that was
                # relevant to this case (condition-specific + universal, verified
                # and active) — not just rules that fired at least once. This
                # shows full stability (30/30 and 0/30) alongside partial firing,
                # so a rule that should be stable can be told apart from one that's
                # genuinely flaky. Note: this measures detector *consistency* only.
                # It does not establish whether a rule *should* have fired on this
                # response — that requires a clinician-authored should-fire label
                # per response, which this experiment does not attempt.
                condition_ids = json.loads(case.condition_ids) if case.condition_ids else []
                relevant_rules = _with_retry(lambda: get_relevant_rules(condition_ids, db), db)
                db.commit()

                fire_counts = {rule.id: 0 for rule in relevant_rules}
                rule_meta = {rule.id: rule for rule in relevant_rules}
                for run in runs:
                    for fired in run.get("fired_rules", []):
                        if fired["rule_id"] in fire_counts:
                            fire_counts[fired["rule_id"]] += 1

                rule_fire_rates = [
                    {
                        "rule_id": rule_id,
                        "description": rule_meta[rule_id].description[:80],
                        "fired_in": count,
                        "total_runs": n_runs,
                        "fire_rate": round(count / n_runs, 2),
                    }
                    for rule_id, count in sorted(fire_counts.items())
                ]

                case_result = {
                    "case_id": case_id_data,
                    "db_id": case.id,
                    "variant": suffix or "clean",
                    "runs": runs,
                    "statistics": statistics_by_dim,
                    "rule_fire_rates": rule_fire_rates,
                }
                results.append(case_result)

                checkpoint[ckpt_key] = case_result
                _save_checkpoint(checkpoint)
                logger.info(f"Checkpointed case {case.id} ({case_id_data})")

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
            for rule in case_result["rule_fire_rates"]:
                if 0 < rule["fired_in"] < n_runs:
                    key = f"{case_result['case_id']}:{rule['description'][:60]}"
                    inconsistent_rules[key] = {
                        "fired_in": rule["fired_in"],
                        "total_runs": n_runs,
                        "fire_rate": rule["fire_rate"],
                    }

        report = {
            "date": str(date.today()),
            "n_runs": n_runs,
            "case_ids": case_ids,
            # Reported from the actual constants used by each judge path
            # (safety.engine.SAFETY_JUDGE_MODEL, eval_scorer.RUBRIC_JUDGE_MODEL)
            # rather than a hand-typed string, so this can't silently drift
            # out of sync with what the scoring code actually calls.
            "rubric_judge_model": RUBRIC_JUDGE_MODEL,
            "safety_judge_model": SAFETY_JUDGE_MODEL,
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
                        "Variance in safety rule firing. Formula is deterministic "
                        "(0.5 per fired rule, uniform — no severity distinction). "
                        "Detection uses LLM so input to formula is stochastic. "
                        "Mitigation: multiple sampling with majority vote, or deterministic rule matching. "
                        "Fire rate measures detector consistency only, not correctness — whether a rule "
                        "*should* fire on a given response is not evaluated here."
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

    args = sys.argv[1:]
    if args and args[0].isdigit() and len(args) == 1:
        # Single bare number: treat as n_runs, use default case ids, clean variant only.
        n_runs = int(args[0])
        case_ids = DEFAULT_CASE_IDS
        suffixes = [""]
    elif args:
        # Comma-separated case ids, optionally followed by n_runs, optionally
        # followed by a comma-separated variant list (e.g. "clean,unclean").
        case_ids = [int(x) for x in args[0].split(",")]
        n_runs = int(args[1]) if len(args) > 1 else 30
        if len(args) > 2:
            suffixes = ["" if v == "clean" else v for v in args[2].split(",")]
        else:
            suffixes = [""]
    else:
        case_ids = DEFAULT_CASE_IDS
        n_runs = 30
        suffixes = [""]

    logger.info(f"Running variance measurement: {n_runs} runs per case, cases={case_ids}, variants={suffixes}")

    report = run_variance_measurement(case_ids, n_runs, suffixes)

    output_path = Path("evaluation") / f"variance_report_authored_{date.today()}.json"
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"Report written to {output_path}")

    print("\n=== VARIANCE SUMMARY (authored cases) ===")
    print(f"Date: {report['date']}")
    print(f"Runs per case: {report['n_runs']}")
    print(f"Rubric judge model: {report['rubric_judge_model']}")
    print(f"Safety judge model: {report['safety_judge_model']}")
    print()
    print("Judge scoring variance:")
    print(f"  Max sigma: {report['summary']['judge_scoring_variance']['max_sigma']}")
    print(f"  Worst pair: {report['summary']['judge_scoring_variance']['worst_pair']}")
    print()
    print("Safety detection variance:")
    print(f"  Max sigma: {report['summary']['safety_detection_variance']['max_sigma']}")
    print(f"  Worst pair: {report['summary']['safety_detection_variance']['worst_pair']}")
    print()

    for case_result in report["cases"]:
        print(f"Case: {case_result['case_id']} (db_id={case_result['db_id']}, variant={case_result['variant']})")
        for dim, stats in case_result["statistics"].items():
            print(f"  {dim}: mean={stats['mean']} sigma={stats['sigma']} cv={stats['cv']}")
        print("  Safety rule fire rates:")
        if not case_result["rule_fire_rates"]:
            print("    (no relevant safety rules for this case)")
        for rule in case_result["rule_fire_rates"]:
            print(
                f"    rule {rule['rule_id']} "
                f"\"{rule['description']}\": "
                f"fired {rule['fired_in']}/{rule['total_runs']}, rate={rule['fire_rate']}"
            )
        print()
