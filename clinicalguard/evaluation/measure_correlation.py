import json
import logging
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)

DIMENSIONS = [
    "treatment_correctness",
    "investigation_appropriateness",
    "completeness",
    "safety_adherence",
]


def compute_correlation(x: list[float], y: list[float]) -> float:
    n = len(x)
    if n < 2:
        return 0.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    denom_x = (sum((v - mean_x) ** 2 for v in x)) ** 0.5
    denom_y = (sum((v - mean_y) ** 2 for v in y)) ** 0.5
    if denom_x == 0 or denom_y == 0:
        return 0.0
    return round(numerator / (denom_x * denom_y), 4)


def run_correlation_audit(variance_report_path: Path) -> dict:
    with open(variance_report_path) as f:
        variance_report = json.load(f)

    # Flatten all runs across all cases into one list of observations
    all_runs = []
    for case_result in variance_report["cases"]:
        for run in case_result["runs"]:
            all_runs.append(run)

    if len(all_runs) < 2:
        raise RuntimeError("Not enough data points for correlation. Run variance measurement first.")

    # Build per-dimension value lists
    dim_values = {dim: [r[dim] for r in all_runs] for dim in DIMENSIONS}

    # Compute correlation matrix
    correlation_matrix = {}
    for dim_a in DIMENSIONS:
        correlation_matrix[dim_a] = {}
        for dim_b in DIMENSIONS:
            if dim_a == dim_b:
                correlation_matrix[dim_a][dim_b] = 1.0
            else:
                correlation_matrix[dim_a][dim_b] = compute_correlation(
                    dim_values[dim_a], dim_values[dim_b]
                )

    # Find max off-diagonal correlation and highly correlated pairs
    max_off_diagonal = 0.0
    highly_correlated = []
    for i, dim_a in enumerate(DIMENSIONS):
        for j, dim_b in enumerate(DIMENSIONS):
            if i >= j:
                continue
            corr = abs(correlation_matrix[dim_a][dim_b])
            if corr > max_off_diagonal:
                max_off_diagonal = corr
            if corr > 0.8:
                highly_correlated.append(f"{dim_a}:{dim_b} ({correlation_matrix[dim_a][dim_b]})")

    report = {
        "date": str(date.today()),
        "source_variance_report": str(variance_report_path),
        "n_observations": len(all_runs),
        "correlation_matrix": correlation_matrix,
        "interpretation": {
            "max_off_diagonal_correlation": round(max_off_diagonal, 4),
            "dimensions_highly_correlated": highly_correlated,
            "note": (
                "If max correlation > 0.8, dimensions may be measuring the same "
                "underlying signal and the multi-dimensional design may not be adding "
                "independent information. If correlations are low, each dimension "
                "captures a distinct aspect of response quality."
            ),
        },
    }

    return report


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        # Auto-find most recent variance report
        evaluation_dir = Path("evaluation")
        reports = sorted(evaluation_dir.glob("variance_report_*.json"))
        if not reports:
            print("No variance report found. Run measure_variance.py first.")
            sys.exit(1)
        variance_path = reports[-1]
    else:
        variance_path = Path(sys.argv[1])

    logger.info(f"Computing correlation from: {variance_path}")
    report = run_correlation_audit(variance_path)

    output_path = Path("evaluation") / f"dimension_correlation_{date.today()}.json"
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"Report written to {output_path}")

    print("\n=== DIMENSION CORRELATION MATRIX ===")
    print(f"Date: {report['date']}")
    print(f"Observations: {report['n_observations']}")
    print()
    for dim_a in DIMENSIONS:
        row = "  " + dim_a[:8] + ": "
        for dim_b in DIMENSIONS:
            row += f"{report['correlation_matrix'][dim_a][dim_b]:6.3f}  "
        print(row)
    print()
    print(f"Max off-diagonal correlation: {report['interpretation']['max_off_diagonal_correlation']}")
    if report["interpretation"]["dimensions_highly_correlated"]:
        print("Highly correlated pairs (>0.8):", report["interpretation"]["dimensions_highly_correlated"])
    else:
        print("No highly correlated pairs. Dimensions are measuring distinct signals.")