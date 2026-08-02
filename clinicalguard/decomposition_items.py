"""The frozen 15-item decomposition task set (ADR-032).

This is seed content, not authored data: every rater sees exactly these
items, in this order, grouped under the case (and clinical query) they came
from — mirroring the original task sheet. That invariance is the point of
the measurement, so this module is the single source of truth and nothing
in the UI can alter it.

Deliberately absent: the decomposition rulebook
(docs/decomposition_rulebook.yaml). Raters must never see the rules —
rater-facing surfaces teach only the split/keep mechanic via one trivial
worked example (frontend copy), and the rest is their independent clinical
judgment.
"""

TASK_VERSION = 1

# Each group mirrors one case block of the task sheet: label, the clinical
# query shown for context, and the items judged under it. Item ids are the
# task sheet's 1–15 numbering and are what decomposition_response.item_id
# refers to. `source_note` is the small per-item annotation used for the
# standalone investigation items.
ITEM_GROUPS = [
    {
        "case_label": "Case A · Diabetic ketoacidosis",
        "clinical_query": (
            "27-year-old accountant with known type 1 diabetes, presenting to the "
            "emergency department with two days of fever, abdominal pain and vomiting. "
            "Drowsy and dehydrated on arrival. Point-of-care glucose 28 mmol/L, urine "
            "ketones 3+. Diagnosis and initial management."
        ),
        "items": [
            {"id": 1, "text": "Fixed-rate IV insulin infusion at 0.1 u/kg/hr, held until potassium confirmed above 3.3 mmol/L"},
            {"id": 2, "text": "Serum potassium replacement per level: 40 mmol/L in fluid if K<3.5, 20 mmol/L if K 3.5–5.5, held if K>5.5"},
            {"id": 3, "text": "IV fluid resuscitation with 0.9% normal saline initiated first, before insulin"},
            {"id": 4, "text": "Investigation and treatment of suspected infection as DKA precipitant"},
            {"id": 5, "text": "Potassium replacement initiated only after urine output established at 1 ml/kg/hr"},
        ],
    },
    {
        "case_label": "Case B · Pulmonary tuberculosis (HIV co-infected)",
        "clinical_query": (
            "38-year-old man, known HIV-positive on antiretroviral therapy, presenting "
            "with six weeks of productive cough, drenching night sweats, and significant "
            "weight loss. Diagnosis and management."
        ),
        "items": [
            {"id": 6, "text": "Intensive phase: rifampicin, isoniazid, pyrazinamide, ethambutol for 2 months"},
            {"id": 7, "text": "Continuation phase: isoniazid and rifampicin for 4 months"},
        ],
    },
    {
        "case_label": "Case C · Bacterial meningitis",
        "clinical_query": (
            "7-year-old boy with 5 days of high-grade fever, 4 days of vomiting, and "
            "3 days of progressive neck stiffness with severe headache, photophobia and "
            "irritability. Two generalized tonic-clonic seizures on the day of "
            "presentation, with postictal drowsiness."
        ),
        "items": [
            {"id": 8, "text": "Dexamethasone 0.15 mg/kg IV every 6 hours for 2–4 days, started before or with the first antibiotic dose"},
            {"id": 9, "text": "Control seizures (diazepam/lorazepam, then phenobarbital if persistent)"},
            {"id": 10, "text": "Maintain fluids and electrolytes (avoid overhydration)"},
        ],
    },
    {
        "case_label": "Case D · Acute diarrhoea with AKI",
        "clinical_query": (
            "6-year-old boy with 3 days of watery, bloody, mucoid stool (about 4 per "
            "day), low-grade fever, and epigastric abdominal pain. Weak since onset but "
            "still tolerating orally, with a recent significant reduction in urine output."
        ),
        "items": [
            {"id": 11, "text": "Start appropriate antibiotics (ciprofloxacin or ceftriaxone if severe)"},
        ],
    },
    {
        "case_label": "Case E · Acute decompensated heart failure",
        "clinical_query": (
            "58-year-old man, known hypertensive, brought to the emergency department "
            "with severe breathlessness at rest that worsened overnight, unable to lie "
            "flat, with a cough productive of frothy sputum."
        ),
        "items": [
            {"id": 12, "text": "IV loop diuretic (furosemide) for pulmonary oedema"},
        ],
    },
    {
        "case_label": "Case F · Standalone investigation items",
        "clinical_query": (
            "Three single investigation items from three different cases (noted beside "
            "each). Judge them the same way as the rest."
        ),
        "items": [
            {"id": 13, "text": "ECG", "source_note": "hypertension case"},
            {"id": 14, "text": "GeneXpert MTB-RIF", "source_note": "TB case"},
            {"id": 15, "text": "Blood culture", "source_note": "meningitis case"},
        ],
    },
]

# Flat id -> item view (with its group context) for validation and export.
ITEMS_BY_ID = {
    item["id"]: {**item, "case_label": g["case_label"], "clinical_query": g["clinical_query"]}
    for g in ITEM_GROUPS
    for item in g["items"]
}

TOTAL_ITEMS = len(ITEMS_BY_ID)
assert TOTAL_ITEMS == 15 and sorted(ITEMS_BY_ID) == list(range(1, 16))
