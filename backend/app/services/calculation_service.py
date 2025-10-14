import pandas as pd
import numpy as np
import xgboost as xgb
import math
import re
from typing import Dict, Any, List

#from app.core.config import logger

import logging
logger = logging.getLogger(__name__)


# 전역 모델 딕셔너리를 직접 임포트합니다.
from app.services.model_loader import model_dict

# --- Helper Functions ---
def feature_engineering_new(df: pd.DataFrame) -> pd.DataFrame:
    """Reducer/Expander 모델을 위한 피처 엔지니어링"""
    df_eng = pd.DataFrame()
    required_cols = ['d1_cm', 'd2_cm', 'length_cm']
    if not all(col in df.columns for col in required_cols):
        raise ValueError(f"입력 파일에 필수 열이 없습니다: {required_cols}")
    
    df_eng['d1_cm'] = df['d1_cm']
    df_eng['d2_cm'] = df['d2_cm']
    df_eng['length_cm'] = df['length_cm']
    df_eng['ratio_d2_d1'] = df['d2_cm'] / (df['d1_cm'] + 1e-9)
    df_eng['d1_area'] = (df['d1_cm'] / 2)**2
    df_eng['d2_area'] = (df['d2_cm'] / 2)**2
    df_eng['steepness'] = (df['d1_cm'] - df['d2_cm']) / (df['length_cm'] + 1e-9)
    df_eng['ratio_per_length'] = df_eng['ratio_d2_d1'] / (df['length_cm'] + 1e-9)
    df_eng['theta_deg'] = 2 * np.degrees(np.arctan(np.abs(df['d1_cm'] - df['d2_cm']) / (2 * (df['length_cm'] + 1e-9))))
    
    theta_rad = np.radians(df_eng['theta_deg'])
    df_eng['sin_theta'] = np.sin(theta_rad)
    df_eng['cos_theta'] = np.cos(theta_rad)
    df_eng['sin_half_theta'] = np.sin(theta_rad / 2)
    return df_eng

def calculate_knudsen_number_legacy(P_torr: float, D_cm: float, T_K: float = 293) -> str:
    """기존 Pipe/Elbow 모델의 레짐 분류"""
    k = 1.38e-23
    d_air = 3.7e-10
    P_Pa = P_torr * 133.322
    lam = (k * T_K) / (math.sqrt(2) * math.pi * d_air**2 * P_Pa)
    Kn = lam / (D_cm / 100.0)
    return "점성" if Kn < 0.01 else "천이"

def calculate_flow_regime_new(d1_cm: float, d2_cm: float) -> str:
    """신규 Reducer/Expander 모델의 레짐 분류 (압력 0.1 Torr 고정 기준)"""
    R, T, M, mu, optimal_kn_cutoff = 8.314, 273.15, 0.02897, 1.716e-5, 0.008928
    D_min_m = min(d1_cm, d2_cm) / 100
    numerator = mu * np.sqrt((np.pi * R * T) / (2 * M))
    viscous_pressure_Pa = numerator / (optimal_kn_cutoff * D_min_m)
    pressure_boundary_torr = viscous_pressure_Pa / 133.322
    return 'viscous' if pressure_boundary_torr < 0.1 else 'transit'

def _predict_single(comp: str, P: float, **kwargs) -> float:
    """모든 컴포넌트에 대한 단일 예측을 처리하는 통합 함수"""
    if comp not in model_dict or not model_dict[comp]:
        raise ValueError(f"모델이 로드되지 않았습니다: {comp}")

    if comp in ["pipe", "elbow"]:
        D0_key = "Diameter_cm"
        feature_keys = ("Diameter_cm", "Length_cm") if comp == "pipe" else ("Diameter_cm", "BendAngle_deg")
        param_values = [kwargs.get(key) for key in feature_keys]
        if any(v is None for v in param_values):
            raise ValueError(f"컴포넌트 '{comp}'에 필수 매개변수가 없습니다.")
        
        D0_val = kwargs.get(D0_key)
        regime = calculate_knudsen_number_legacy(P, D0_val)
        
        if regime not in model_dict[comp]:
            raise ValueError(f"{comp}:{regime} 모델 없음")

        model, poly = model_dict[comp][regime]
        feats = param_values + [P]
        X_log = np.log1p(np.array([feats], dtype=np.float32))
        y_log = model.predict(poly.transform(X_log))[0]
        return float(np.expm1(y_log))

    elif comp in ["reducer", "expander"]:
        d1, d2, length = kwargs.get("D1_cm"), kwargs.get("D2_cm"), kwargs.get("Length_cm")
        if any(v is None for v in [d1, d2, length]):
            raise ValueError(f"컴포넌트 '{comp}'에 필수 매개변수(D1_cm, D2_cm, Length_cm)가 없습니다.")

        regime = calculate_flow_regime_new(d1, d2)
        
        if regime not in model_dict[comp]:
            raise ValueError(f"{comp}의 {regime} 모델이 없습니다.")
        
        model = model_dict[comp][regime]
        
        input_df = pd.DataFrame([{'d1_cm': d1, 'd2_cm': d2, 'length_cm': length}])
        X_test = feature_engineering_new(input_df)
        dtest = xgb.DMatrix(X_test)
        
        pred_log = model.predict(dtest)
        return float(np.expm1(pred_log[0]))
    else:
        raise ValueError(f"지원하지 않는 컴포넌트: {comp}")

def process_excel_data(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """파싱된 데이터프레임을 기반으로 컨덕턴스를 계산합니다."""
    results_by_chamber = []
    PRESSURE_TORR = 0.1

    for chamber_id in df.columns.unique():
        if chamber_id == df.index.name or 'Ch' not in str(chamber_id):
            continue

        chamber_data = df[chamber_id]
        
        # 'CODE' 행에서 유효한 값을 찾아 code_id로 사용
        try:
            code_series = chamber_data.loc['CODE'].dropna()
            code_id = code_series.iloc[0] if not code_series.empty else chamber_id
        except KeyError:
            logger.warning(f"'{chamber_id}'에서 'CODE' 파라미터를 찾을 수 없습니다. 챔버 ID를 대신 사용합니다.")
            code_id = chamber_id

        logger.info(f"--- 처리 시작: {code_id} (Chamber: {chamber_id}) ---")
        
        chamber_result = {"code_id": code_id, "chamber_id": chamber_id, "components": [], "total_conductance": 0}
        total_inv_C = 0.0
        
        reducer_groups = sorted(list(set(re.findall(r"(Reducer\d+)", " ".join(chamber_data.index.astype(str))))))
        logger.debug(f"[{code_id}] 발견된 Reducer 그룹: {reducer_groups}")

        if not reducer_groups:
            logger.warning(f"[{code_id}] Reducer 그룹을 찾을 수 없어 컴포넌트를 계산할 수 없습니다.")
            continue

        for group_prefix in reducer_groups:
            logger.debug(f"  [{code_id}] 그룹 '{group_prefix}' 처리 중...")
            
            # --- 前 배관 (Pipe) ---
            try:
                dia_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 前 배관 직경"))
                len_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 前 배관 총장") and "[cm]" not in k)
                
                dia_val = chamber_data.loc[dia_key].dropna()
                len_val = chamber_data.loc[len_key].dropna()

                if not dia_val.empty and not len_val.empty:
                    dia = float(dia_val.iloc[0]) * 2.54
                    length = float(len_val.iloc[0]) / 10.0
                    logger.debug(f"    - {group_prefix} 前 배관 발견: dia={dia}, len={length}")
                    C = _predict_single("pipe", PRESSURE_TORR, Diameter_cm=dia, Length_cm=length)
                    if C > 0:
                        total_inv_C += 1.0 / C
                        chamber_result["components"].append({"type": f"{group_prefix} 前 배관", "conductance": C, "params": {"Diameter_cm": dia, "Length_cm": length}})
            except (StopIteration, KeyError, ValueError, TypeError, IndexError) as e:
                logger.debug(f"    - {group_prefix} 前 배관 처리 중 문제 발생 (건너뜀): {e}")

            # --- 前 Elbow ---
            try:
                dia_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 前 Elbow 직경"))
                angle_qty_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 前 Elbow 각도/수량"))

                dia_val = chamber_data.loc[dia_key].dropna()
                angle_qty_vals = chamber_data.loc[angle_qty_key].dropna().tolist()

                if not dia_val.empty and angle_qty_vals:
                    dia = float(dia_val.iloc[0]) * 2.54
                    logger.debug(f"    - {group_prefix} 前 Elbow 발견: dia={dia}, angle/qty_values={angle_qty_vals}")
                    
                    if len(angle_qty_vals) % 2 != 0:
                        logger.warning(f"    - {group_prefix} 前 Elbow의 각도/수량 데이터가 쌍으로 맞지 않습니다. 건너뜁니다. 데이터: {angle_qty_vals}")
                    else:
                        component_count = 1
                        for i in range(0, len(angle_qty_vals), 2):
                            angle = float(angle_qty_vals[i])
                            qty = int(float(angle_qty_vals[i+1]))
                            for _ in range(qty):
                                C = _predict_single("elbow", PRESSURE_TORR, Diameter_cm=dia, BendAngle_deg=angle)
                                if C > 0:
                                    total_inv_C += 1.0 / C
                                    chamber_result["components"].append({
                                        "type": f"{group_prefix} 前 Elbow #{component_count}",
                                        "conductance": C,
                                        "params": {"Diameter_cm": dia, "BendAngle_deg": angle}
                                    })
                                    component_count += 1
            except (StopIteration, KeyError, ValueError, TypeError, IndexError) as e:
                logger.debug(f"    - {group_prefix} 前 Elbow 처리 중 문제 발생 (건너뜀): {e}")

            # --- Core Reducer/Expander ---
            try:
                d1_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 입구 직경"))
                d2_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 출구 직경"))
                len_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 길이"))

                d1_val = chamber_data.loc[d1_key].dropna()
                d2_val = chamber_data.loc[d2_key].dropna()
                len_val = chamber_data.loc[len_key].dropna()

                if not d1_val.empty and not d2_val.empty and not len_val.empty:
                    d1 = float(d1_val.iloc[0]) * 2.54
                    d2 = float(d2_val.iloc[0]) * 2.54
                    length = float(len_val.iloc[0]) / 10.0
                    actual_comp_type = "reducer" if d1 > d2 else "expander"
                    logger.debug(f"    - {group_prefix} Core ({actual_comp_type}) 발견: d1={d1}, d2={d2}, len={length}")
                    C = _predict_single(actual_comp_type, PRESSURE_TORR, D1_cm=d1, D2_cm=d2, Length_cm=length)
                    if C > 0:
                        total_inv_C += 1.0 / C
                        chamber_result["components"].append({"type": f"{group_prefix} Core ({actual_comp_type})", "conductance": C, "params": {"D1_cm": d1, "D2_cm": d2, "Length_cm": length}})
            except (StopIteration, KeyError, ValueError, TypeError, IndexError) as e:
                logger.debug(f"    - {group_prefix} Core 처리 중 문제 발생 (건너뜀): {e}")

            # --- 後 배관 (Pipe) ---
            try:
                dia_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 後 배관 직경"))
                len_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 後 배관 총장") and "[cm]" not in k)
                
                dia_val = chamber_data.loc[dia_key].dropna()
                len_val = chamber_data.loc[len_key].dropna()

                if not dia_val.empty and not len_val.empty:
                    dia = float(dia_val.iloc[0]) * 2.54
                    length = float(len_val.iloc[0]) / 10.0
                    logger.debug(f"    - {group_prefix} 後 배관 발견: dia={dia}, len={length}")
                    C = _predict_single("pipe", PRESSURE_TORR, Diameter_cm=dia, Length_cm=length)
                    if C > 0:
                        total_inv_C += 1.0 / C
                        chamber_result["components"].append({"type": f"{group_prefix} 後 배관", "conductance": C, "params": {"Diameter_cm": dia, "Length_cm": length}})
            except (StopIteration, KeyError, ValueError, TypeError, IndexError) as e:
                logger.debug(f"    - {group_prefix} 後 배관 처리 중 문제 발생 (건너뜀): {e}")

            # --- 後 Elbow ---
            try:
                dia_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 後 Elbow 직경"))
                angle_qty_key = next(k for k in chamber_data.index if k.startswith(f"{group_prefix} 後 Elbow 각도/수량"))

                dia_val = chamber_data.loc[dia_key].dropna()
                angle_qty_vals = chamber_data.loc[angle_qty_key].dropna().tolist()

                if not dia_val.empty and angle_qty_vals:
                    dia = float(dia_val.iloc[0]) * 2.54
                    logger.debug(f"    - {group_prefix} 後 Elbow 발견: dia={dia}, angle/qty_values={angle_qty_vals}")

                    if len(angle_qty_vals) % 2 != 0:
                        logger.warning(f"    - {group_prefix} 後 Elbow의 각도/수량 데이터가 쌍으로 맞지 않습니다. 건너뜁니다. 데이터: {angle_qty_vals}")
                    else:
                        component_count = 1
                        for i in range(0, len(angle_qty_vals), 2):
                            angle = float(angle_qty_vals[i])
                            qty = int(float(angle_qty_vals[i+1]))
                            for _ in range(qty):
                                C = _predict_single("elbow", PRESSURE_TORR, Diameter_cm=dia, BendAngle_deg=angle)
                                if C > 0:
                                    total_inv_C += 1.0 / C
                                    chamber_result["components"].append({
                                        "type": f"{group_prefix} 後 Elbow #{component_count}",
                                        "conductance": C,
                                        "params": {"Diameter_cm": dia, "BendAngle_deg": angle}
                                    })
                                    component_count += 1
            except (StopIteration, KeyError, ValueError, TypeError, IndexError) as e:
                logger.debug(f"    - {group_prefix} 後 Elbow 처리 중 문제 발생 (건너뜀): {e}")

        if total_inv_C > 0:
            chamber_result["total_conductance"] = 1.0 / total_inv_C
        
        if chamber_result["components"]:
            results_by_chamber.append(chamber_result)
            logger.info(f"--- 처리 완료: {code_id}. 총 {len(chamber_result['components'])}개 부품, 총 컨덕턴스: {chamber_result['total_conductance']:.4f} ---")
        else:
            logger.warning(f"--- 처리 완료: {code_id}. 계산된 부품이 없습니다. ---")

    return results_by_chamber
