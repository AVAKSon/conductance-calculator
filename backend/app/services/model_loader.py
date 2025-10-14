# app/services/model_loader.py

import joblib
import xgboost as xgb
from pathlib import Path
from typing import Dict, Any
import logging

logger = logging.getLogger("model_loader")
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
ch.setFormatter(formatter)
logger.addHandler(ch)

BASE_DIR = Path(__file__).resolve().parent.parent

COMPONENTS_LEGACY = ["pipe", "elbow"]
COMPONENTS_NEW = ["reducer", "expander"]

model_dict: Dict[str, Dict[str, Any]] = {}

def load_all_models() -> None:
    """
    Load all machine learning models into the global model_dict.
    """
    global model_dict
    logger.info("Starting to load ML models...")

    for comp in COMPONENTS_LEGACY:
        model_dict[comp] = {}
        for regime in ["점성", "천이"]:
            try:
                model_path = BASE_DIR / "models" / comp / f"model_{regime}.pkl"
                poly_path = BASE_DIR / "models" / comp / f"poly_{regime}.pkl"
                model = joblib.load(model_path)
                poly = joblib.load(poly_path)
                model_dict[comp][regime] = (model, poly)
                logger.debug(f"Loaded legacy model: {model_path}")
            except FileNotFoundError:
                logger.warning(f"Legacy model not found for {comp}/{regime}, skipping.")

    for comp in COMPONENTS_NEW:
        model_dict[comp] = {}
        for regime in ["viscous", "transit"]:
            try:
                model_path = BASE_DIR / "models" / comp / f"model_{comp}_{regime}.json"
                bst = xgb.Booster()
                bst.load_model(model_path)
                model_dict[comp][regime] = bst
                logger.debug(f"Loaded new XGBoost model: {model_path}")
            except (FileNotFoundError, xgb.core.XGBoostError) as e:
                logger.warning(f"New model not found or failed to load for {comp}/{regime}: {e}")

    logger.info("All models loaded successfully.")
