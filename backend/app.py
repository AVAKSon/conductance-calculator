from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
from pydantic import BaseModel

class ChamberUpdate(BaseModel):
    chamber: int
    row: int
    value: str

app = FastAPI()

df_filtered = None

# Enable CORS for Electron frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        df_filtered = df_filtered.drop(df_filtered.columns[[3,5,7,9,11,13,15,17,19,21]], axis=1)



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
        df_filtered.iloc[update.row + 1, update.chamber + 2] = update.value
        debug_path = "debug_output.xlsx"
        df_filtered.to_excel(debug_path, index=False)
        return {"status": "success", "row": update.row, "chamber": update.chamber, "value": update.value}
    except Exception as e:
        return {"status": "error", "error": str(e)}
    
    

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
