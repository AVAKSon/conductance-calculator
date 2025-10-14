from fastapi import FastAPI, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import io
from pydantic import BaseModel
import os
from app.services.model_loader import load_all_models

from pydantic import BaseModel
from typing import List
from backend.app.services.calculation_service2 import predict_conductance

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

class ChamberUpdate(BaseModel):
    chamber: int
    row: int
    value: str

class CalcRequest(BaseModel):
    component: str
    regime: str
    features: List[float]

app = FastAPI()

df_filtered = None

# Enable CORS for Electron frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    load_all_models()

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from backend.app.services.calculation_service import _predict_single

class Component(BaseModel):
    type: str
    params: Dict[str, Any]

class ChamberRequest(BaseModel):
    chamber_id: str
    #code_id: str
    pressure: float = 0.1
    components: List[Component]

#router = APIRouter()

@app.post("/calculate_chamber")
async def calculate_chamber(req: ChamberRequest):
    results = []
    total_inv_C = 0.0

    for comp in req.components:
        try:
            C = _predict_single(comp.type, req.pressure, **comp.params)
            if C > 0:
                total_inv_C += 1.0 / C
                results.append({
                    "type": comp.type,
                    "conductance": C,
                    "params": comp.params
                })
        except Exception as e:
            results.append({
                "type": comp.type,
                "error": str(e),
                "params": comp.params
            })

    total_C = 1.0 / total_inv_C if total_inv_C > 0 else 0.0

    return {
        "chamber_id": req.chamber_id,
        #"code_id": req.code_id,
        "components": results,
        "total_conductance": total_C
    }


@app.post("/calculate")
async def calculate(req: CalcRequest):
    try:
        result = predict_conductance(req.component, req.regime, req.features)
        return {"conductance": result}
    except Exception as e:
        return {"error": str(e)}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global df_filtered
    contents = await file.read()
    filename = file.filename.lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(contents.decode("utf-8-sig")))
        elif filename.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")
        else:
            return {"error": "Unsupported file format"}

        # Clean NaN and infinities
        df = df.replace({float('nan'): None, float('inf'): None, float('-inf'): None})
        df = df.where(pd.notnull(df), None)

        # Normalize header names (strip spaces, upper case)
        df.columns = [str(col).strip() for col in df.columns]

        # Pick all columns except ones with all NaN
        df_filtered = df.dropna(axis=1, how='all')

        # Clean invalid data
        df_filtered = df_filtered.replace({float('nan'): None, float('inf'): None, float('-inf'): None})
        df_filtered = df_filtered.where(pd.notnull(df_filtered), None)

        df_filtered.iloc[14:, 1] = df_filtered.iloc[13:-1, 1].values #заголовки
        df_filtered.iloc[13,1] = None
        df_filtered.iloc[24:, 1] = df_filtered.iloc[23:-1, 1].values
        df_filtered.iloc[23,1] = None
        df_filtered.iloc[34:, 1] = df_filtered.iloc[33:-1, 1].values
        df_filtered.iloc[33,1] = None

        for i in range(2, len(df_filtered.columns), 2):
            extra_val = df_filtered.iat[12,i+1]
            df_filtered.iloc[14:, i] = df_filtered.iloc[13:-1, i].values
            df_filtered.iat[13,i] = extra_val

            extra_val = df_filtered.iat[21,i+1]                    #[строка-1, колонна] старт с 0
            df_filtered.iloc[24:, i] = df_filtered.iloc[23:-1, i].values #из-за сдвига +1 на первую координату
            df_filtered.iat[23,i] = extra_val
            
            extra_val = df_filtered.iat[30,i+1]
            df_filtered.iloc[34:, i] = df_filtered.iloc[33:-1, i].values #из-за сдвига +2 на первую координату
            df_filtered.iat[33,i] = extra_val

        # drop_idx = list(range(1, len(df_filtered.columns),2))
        # df_filtered = df_filtered.drop(drop_idx, axis=1)
        for i in range(len(df_filtered.columns)-1, 2, -2):
            df_filtered = df_filtered.drop(df_filtered.columns[i], axis=1)
            
        
        # df_filtered = df_filtered.drop(df_filtered.columns[[3,5,7,9,11,13,15,17,19,21]], axis=1)


        try:
            debug_path = "debug_output.xlsx"
            df_filtered.to_excel(debug_path, index=False)
            print(f"Saved cleaned table to {debug_path}")
        except Exception as e:
            print(f"Error saving debug Excel: {e}")

        return {
            "columns": df_filtered.columns.tolist(),
            "data": df_filtered.to_dict(orient="records")
        }

    except Exception as e:
        return {"error": str(e)}

@app.post("/update-cell")
async def update_cell(update: ChamberUpdate):
    global df_filtered
    try:
        df_filtered.iloc[update.row, update.chamber + 2] = update.value
        debug_path = "debug_output.xlsx"
        df_filtered.to_excel(debug_path, index=False)
        return {"status": "success", "row": update.row, "chamber": update.chamber, "value": update.value}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/get-current-data")
async def get_current_data():
    global df_filtered
    if df_filtered is None:
        return JSONResponse(content={"error": "No data loaded yet"}, status_code=404)
    
    # Return the DataFrame as JSON
    return {
        "columns": df_filtered.columns.tolist(),
        "data": df_filtered.to_dict(orient="records")
    }

if __name__ == "__main__":
    import uvicorn
    import logging

    with open("log.txt", "w") as f:
        f.write("Backend starting...\n")

    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        log_config=None
    )
