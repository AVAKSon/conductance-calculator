import pandas as pd
import numpy as np

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
