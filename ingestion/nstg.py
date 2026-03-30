import json
import logging
from pathlib import Path

from sqlalchemy.orm import session

from clinicalguard.db.models import(
    Condition,
    ConditionAdverseReaction,
    ConditionComplication,
    ConditionDifferential,
    ConditionFinding,
    ConditionPrevention,
    ConditionTreatment,
    GuidelineDataset,
)