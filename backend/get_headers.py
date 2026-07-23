import pandas as pd
import json
import sys

def get_excel_info(filepath):
    try:
        # Read the first few rows to get headers and some sample data
        df = pd.read_excel(filepath, nrows=5)
        return {
            "columns": list(df.columns),
            "sample": df.head(2).to_dict(orient='records')
        }
    except Exception as e:
        return {"error": str(e)}

files = {
    "backlog": "../20260709-backlog.xlsx",
    "forecast": "../Everlight Forecast-04.06.2026 (006) (1).xlsx",
    "stock": "../Everlight Stock Report V4 Dt.07.07.2026 (1).xlsx",
    "po": "../Swingtel PO Tracker.xlsx"
}

results = {}
for name, path in files.items():
    results[name] = get_excel_info(path)

print(results)
