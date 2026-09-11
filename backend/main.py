from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
from typing import Optional
import os
from groq import Groq
from dotenv import load_dotenv
load_dotenv()
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Import new modules
from auth import get_current_username
from engine import ingest_data, get_analytics

groq_client = Groq()

app = FastAPI(title="EVL Supply Chain Analytics Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def read_excel_file(file_obj: UploadFile) -> pd.DataFrame:
    if not file_obj or not file_obj.filename:
        return pd.DataFrame()
    try:
        contents = file_obj.file.read()
        file_obj.file.seek(0)
        return pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        print(f"Error reading {file_obj.filename}: {e}")
        return pd.DataFrame()

@app.post("/v1/ingest")
async def ingest_api(
    demand_file: UploadFile = File(None),
    shipment_file: UploadFile = File(None),
    booking_file: UploadFile = File(None),
    pos_file: UploadFile = File(None),
    stock_file: UploadFile = File(None),
    username: str = Depends(get_current_username)
):
    try:
        demand_df = read_excel_file(demand_file)
        shipment_df = read_excel_file(shipment_file)
        booking_df = read_excel_file(booking_file)
        pos_df = read_excel_file(pos_file)
        stock_df = read_excel_file(stock_file)
        
        result = ingest_data(demand_df, shipment_df, booking_df, pos_df, stock_df)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/analytics/insights")
async def analytics_insights_api(
    series: Optional[str] = Query(None),
    part_number: Optional[str] = Query(None),
    granularity: str = Query("monthly"),
    username: str = Depends(get_current_username)
):
    try:
        data = get_analytics(series, part_number, granularity)
        if not data.get("data"):
            return {"insight": "No data available to generate insights."}
            
        data_str = str(data["data"])
        
        prompt = f"""
You are an expert Supply Chain Manager for Everlight Electronics.
Analyze the following supply chain data for part '{part_number or 'All'}' (Series: '{series or 'All'}').
The data includes Customer Demand, POS (Sales), Inventory, EVL Booking, and EVL Shipment over time.
Data: {data_str}

Provide a concise, 3-4 sentence managerial summary explaining the trends. Focus on why sales might have dropped or spiked (e.g. comparing inventory levels vs demand), and highlight any upcoming stockout risks. Do not just list the numbers.
"""
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-20b",
            temperature=0.3,
        )
        
        insight = chat_completion.choices[0].message.content
        return {"insight": insight}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



from pydantic import BaseModel
class ChatRequest(BaseModel):
    part_number: str
    question: str

@app.post("/v1/chat")
async def chat_api(req: ChatRequest, username: str = Depends(get_current_username)):
    try:
        from db import get_db_connection
        from classifier import normalize_part_number
        from sqlalchemy import text
        import pandas as pd
        
        part = normalize_part_number(req.part_number)
        engine = get_db_connection()
        query = text('''
            SELECT record_date, customer_demand, evl_shipment as loaded_po, pending_po, evl_booking as healthy_backlog, at_risk_backlog, pos, inventory 
            FROM supply_chain_data 
            WHERE normalized_part = :part 
            ORDER BY record_date ASC
        ''')
        
        with engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'part': part})
            
        if df.empty:
            history_context = "No data found for this part."
        else:
            # Group by record_date since there might be multiple entries per day
            pivot = df.groupby('record_date').sum().fillna(0)
            history_context = pivot.to_csv()

        prompt = f'''
You are an expert Supply Chain AI Assistant for Everlight Electronics.
The user is asking a question about the part number: {req.part_number}.
Here is the exact "Kundali" (raw history) of this part across all our files (Forecast, Backlog, POS, PO Tracker) organized by date:
{history_context}

User Question: {req.question}

Please answer the user's question clearly, concisely, and accurately based on the data provided above.
'''
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="groq/compound-mini",
            temperature=0.2,
        )
        
        return {"answer": chat_completion.choices[0].message.content}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/analytics/view")
async def analytics_view_api(
    series: Optional[str] = Query(None),
    part_number: Optional[str] = Query(None),
    granularity: str = Query("monthly", regex="^(monthly|quarterly|half_yearly|annual)$"),
    username: str = Depends(get_current_username)
):
    try:
        result = get_analytics(series, part_number, granularity)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



# --- LEGACY FORECASTIQ ROUTES ---
import openpyxl
import numpy as np
from fastapi import Form
from fastapi.responses import StreamingResponse

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_file_stream(file_obj, name):
    save_path = os.path.join(UPLOAD_DIR, f"{name}.xlsx")
    if file_obj is not None:
        file_bytes = file_obj.file.read()
        with open(save_path, "wb") as f:
            f.write(file_bytes)
        return io.BytesIO(file_bytes)
    elif os.path.exists(save_path):
        with open(save_path, "rb") as f:
            return io.BytesIO(f.read())
    else:
        raise Exception(f"Missing file for {name} and no saved file found.")

@app.get("/v1/status")
async def get_status():
    has_saved = all([
        os.path.exists(os.path.join(UPLOAD_DIR, "forecast.xlsx")),
        os.path.exists(os.path.join(UPLOAD_DIR, "stock.xlsx")),
        os.path.exists(os.path.join(UPLOAD_DIR, "backlog.xlsx")),
        os.path.exists(os.path.join(UPLOAD_DIR, "po.xlsx"))
    ])
    return {"has_saved_files": has_saved}

def get_all_sheets_info(file_obj):
    file_bytes = file_obj.read()
    file_obj.seek(0)
    
    sheets_info = {}
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True, keep_links=False)
        sheet_names = wb.sheetnames
        active_sheet = wb.active.title
        wb.close()
        
        for sheet in sheet_names:
            try:
                df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet, nrows=10)
                sheets_info[sheet] = df
            except:
                pass
                
        if not sheets_info:
            raise Exception("No sheets parsed")
            
        return {"sheets": sheet_names, "active": active_sheet, "data": sheets_info}
    except Exception as e:
        # Fallback
        try:
            df = pd.read_excel(io.BytesIO(file_bytes), nrows=10)
            return {"sheets": ["Sheet1"], "active": "Sheet1", "data": {"Sheet1": df}}
        except:
            df = pd.read_csv(io.BytesIO(file_bytes), nrows=10)
            return {"sheets": ["Sheet1"], "active": "Sheet1", "data": {"Sheet1": df}}



def clean_data(df):
    for col in df.columns:
        if df[col].dtype == object:
            try:
                df[col] = pd.to_numeric(df[col].str.replace(',', ''), errors='ignore')
            except:
                pass
    return df

def convert_datetime_cols(df):
    new_cols = []
    for col in df.columns:
        if isinstance(col, datetime.datetime):
            new_cols.append(col.strftime('%Y %m'))
        else:
            new_cols.append(col)
    df.columns = new_cols
    return df

@app.post("/get_file_info")
async def get_file_info(
    forecast_file: UploadFile = File(None),
    stock_file: UploadFile = File(None),
    backlog_file: UploadFile = File(None),
    po_file: UploadFile = File(None)
):
    try:
        files = {
            "forecast": forecast_file,
            "stock": stock_file,
            "backlog": backlog_file,
            "po": po_file
        }
        
        info = {}
        for name, file_obj in files.items():
            file_sheets = get_all_sheets_info(file_obj.file)
            
            info[name] = {
                "sheets": file_sheets["sheets"],
                "active_sheet": file_sheets["active"],
                "data": {}
            }
            
            for sheet_name, df in file_sheets["data"].items():
                df = convert_datetime_cols(df)
                
                # Format datetime cells in preview to string
                for col in df.select_dtypes(include=['datetime64', 'datetimetz']).columns:
                    df[col] = df[col].dt.strftime('%Y-%m-%d')
                    
                df = df.replace({np.nan: None})
                info[name]["data"][sheet_name] = {
                    "columns": list(df.columns),
                    "preview": df.to_dict(orient="records")
                }
        return info
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def read_sheet(file_obj, sheet_name=None):
    file_bytes = file_obj.read()
    file_obj.seek(0)
    try:
        return pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet_name)
    except:
        return pd.read_csv(io.BytesIO(file_bytes))

def process_report(forecast_file, stock_file, backlog_file, po_file, config):
    # Read files
    f_sheet = config.get("forecast_sheet")
    s_sheet = config.get("stock_sheet")
    b_sheet = config.get("backlog_sheet")
    p_sheet = config.get("po_sheet")
    
    forecast_df = convert_datetime_cols(read_sheet(forecast_file, f_sheet))
    stock_df = convert_datetime_cols(read_sheet(stock_file, s_sheet))
    backlog_df = convert_datetime_cols(read_sheet(backlog_file, b_sheet))
    po_df = convert_datetime_cols(read_sheet(po_file, p_sheet))
    
    forecast_df = clean_data(forecast_df)
    stock_df = clean_data(stock_df)
    backlog_df = clean_data(backlog_df)
    po_df = clean_data(po_df)

    # Extract part columns for alignment
    part_col_forecast = config.get("forecast_part_col")
    part_col_stock = config.get("stock_part_col")
    backlog_part_col = config.get("backlog_part_col")
    po_part_col = config.get("po_part_col")
    
    # Smart alignment to ignore dashes, spaces, and other special characters
    def align_part_numbers(target_df, target_col, reference_series):
        if not target_col or target_col not in target_df.columns:
            return
        if reference_series is None or reference_series.empty:
            return
            
        ref_df = pd.DataFrame({'Original': reference_series, 'Norm': reference_series.astype(str).str.replace(r'[^a-zA-Z0-9]', '', regex=True).str.upper()})
        mapping = ref_df.drop_duplicates('Norm').set_index('Norm')['Original'].to_dict()
        
        target_norm = target_df[target_col].astype(str).str.replace(r'[^a-zA-Z0-9]', '', regex=True).str.upper()
        target_df[target_col] = target_norm.map(mapping).fillna(target_df[target_col])

    if part_col_forecast and part_col_forecast in forecast_df.columns:
        align_part_numbers(stock_df, part_col_stock, forecast_df[part_col_forecast])
        align_part_numbers(backlog_df, backlog_part_col, forecast_df[part_col_forecast])
        align_part_numbers(po_df, po_part_col, forecast_df[part_col_forecast])

    # 1. Forecast Processing
    months_to_use = config.get("forecast_months", [])
    
    forecast_df[part_col_forecast] = forecast_df[part_col_forecast].astype(str).str.strip()
    agg_dict = {m: 'sum' for m in months_to_use if m in forecast_df.columns}
    
    if agg_dict:
        forecast_pivot = forecast_df.groupby(part_col_forecast, as_index=False).agg(agg_dict)
        forecast_pivot['Total Requirement'] = forecast_pivot[list(agg_dict.keys())].sum(axis=1)
    else:
        forecast_pivot = forecast_df[[part_col_forecast]].drop_duplicates().copy()
        forecast_pivot['Total Requirement'] = 0

    # 2. Stock Processing
    part_col_stock = config.get("stock_part_col")
    stock_qty_cols = config.get("stock_qty_cols", [])
    
    stock_df[part_col_stock] = stock_df[part_col_stock].astype(str).str.strip()
    
    for col in stock_qty_cols:
        if col in stock_df.columns:
            stock_df[col] = pd.to_numeric(stock_df[col], errors='coerce').fillna(0)
        
    stock_agg = {col: 'sum' for col in stock_qty_cols if col in stock_df.columns}
    
    if stock_agg:
        stock_pivot = stock_df.groupby(part_col_stock, as_index=False).agg(stock_agg)
        stock_pivot['Total Stock'] = stock_pivot[list(stock_agg.keys())].sum(axis=1)
    else:
        stock_pivot = stock_df[[part_col_stock]].drop_duplicates().copy()
        stock_pivot['Total Stock'] = 0
        
    stock_pivot = stock_pivot.rename(columns={part_col_stock: 'Part Number'})

    # 3. Backlog Processing
    backlog_part_col = config.get("backlog_part_col")
    backlog_qty_col = config.get("backlog_qty_col")
    backlog_extra_cols = config.get("backlog_extra_cols", [])
    
    # Filter backlog if filter provided
    backlog_filter_col = config.get("backlog_filter_col")
    backlog_filter_val = config.get("backlog_filter_val", "")
    
    if backlog_filter_col and backlog_filter_col in backlog_df.columns and backlog_filter_val:
        backlog_active = backlog_df[backlog_df[backlog_filter_col].astype(str).str.contains(backlog_filter_val, case=False, na=False)].copy()
    else:
        backlog_active = backlog_df.copy()

    backlog_active[backlog_part_col] = backlog_active[backlog_part_col].astype(str).str.strip()
    if backlog_qty_col in backlog_active.columns:
        backlog_active[backlog_qty_col] = pd.to_numeric(backlog_active[backlog_qty_col], errors='coerce').fillna(0)
    
    # For extra columns, we can just take the first occurrence
    backlog_agg = {backlog_qty_col: 'sum'} if backlog_qty_col in backlog_active.columns else {}
    for col in backlog_extra_cols:
        if col in backlog_active.columns:
            backlog_agg[col] = 'first'
            
    if backlog_agg:
        backlog_pivot = backlog_active.groupby(backlog_part_col, as_index=False).agg(backlog_agg)
        backlog_pivot = backlog_pivot.rename(columns={backlog_part_col: 'Part Number', backlog_qty_col: 'Backlog Balance Qty'})
    else:
        backlog_pivot = backlog_active[[backlog_part_col]].drop_duplicates().copy()
        backlog_pivot = backlog_pivot.rename(columns={backlog_part_col: 'Part Number'})
        backlog_pivot['Backlog Balance Qty'] = 0

    # 4. Merge all into final report
    report_df = forecast_pivot.rename(columns={part_col_forecast: 'Part Number'})
    
    report_df = pd.merge(report_df, stock_pivot, on='Part Number', how='left')
    report_df['Total Stock'] = report_df['Total Stock'].fillna(0)

    report_df = pd.merge(report_df, backlog_pivot, on='Part Number', how='left')
    report_df['Backlog Balance Qty'] = report_df['Backlog Balance Qty'].fillna(0)

    report_df['Total Available Stock'] = report_df['Total Stock'] + report_df['Backlog Balance Qty']

    # 5. PO Tracker Processing (Monthly)
    po_part_col = config.get("po_part_col")
    po_qty_col = config.get("po_qty_col")
    po_remark_col = config.get("po_remark_col")
    po_remark_filter = config.get("po_remark_filter")
    po_status_col = config.get("po_status_col") 
    po_date_col = config.get("po_date_col")

    po_df[po_part_col] = po_df[po_part_col].astype(str).str.strip()
    po_df[po_qty_col] = pd.to_numeric(po_df[po_qty_col], errors='coerce').fillna(0)
    
    if po_remark_col and po_remark_filter:
        po_active = po_df[po_df[po_remark_col].astype(str).str.contains(po_remark_filter, case=False, na=False)].copy()
    else:
        po_active = po_df.copy()

    # Extract month from date column
    if po_date_col and po_date_col in po_active.columns:
        # Try converting to datetime
        po_active['PO_Date_Obj'] = pd.to_datetime(po_active[po_date_col], errors='coerce')
        po_active['PO_Sort_Key'] = po_active['PO_Date_Obj'].dt.strftime('%Y-%m')
        po_active['PO_Sort_Key'] = po_active['PO_Sort_Key'].fillna('9999-99')
    else:
        po_active['PO_Sort_Key'] = '9999-99'

    if po_status_col:
        sent_mask = po_active[po_status_col].astype(str).str.contains('sent|sended', case=False, na=False)
        po_sent = po_active[sent_mask]
        po_not_sent = po_active[~sent_mask]
    else:
        po_sent = po_active
        po_not_sent = pd.DataFrame(columns=po_active.columns)

    unique_sort_keys = sorted(po_active['PO_Sort_Key'].unique())
    
    po_sent_grouped = po_sent.groupby([po_part_col, 'PO_Sort_Key'])[po_qty_col].sum().reset_index()
    po_not_sent_grouped = po_not_sent.groupby([po_part_col, 'PO_Sort_Key'])[po_qty_col].sum().reset_index()

    po_in_process_cols = []
    po_need_to_send_cols = []

    for skey in unique_sort_keys:
        if skey == '9999-99':
            month_str = "Unknown Month"
        else:
            month_str = pd.to_datetime(skey + '-01').strftime('%b-%y') # e.g. Jul-26
            
        sent_col = f"{month_str} In Process"
        not_sent_col = f"{month_str} Pending"
        
        po_in_process_cols.append(sent_col)
        po_need_to_send_cols.append(not_sent_col)
        
        s_data = po_sent_grouped[po_sent_grouped['PO_Sort_Key'] == skey][[po_part_col, po_qty_col]].rename(columns={po_qty_col: sent_col, po_part_col: 'Part Number'})
        ns_data = po_not_sent_grouped[po_not_sent_grouped['PO_Sort_Key'] == skey][[po_part_col, po_qty_col]].rename(columns={po_qty_col: not_sent_col, po_part_col: 'Part Number'})
        
        report_df = pd.merge(report_df, s_data, on='Part Number', how='left')
        report_df[sent_col] = report_df[sent_col].fillna(0)
        
        report_df = pd.merge(report_df, ns_data, on='Part Number', how='left')
        report_df[not_sent_col] = report_df[not_sent_col].fillna(0)
        
    total_po_in_process = report_df[po_in_process_cols].sum(axis=1) if po_in_process_cols else pd.Series([0]*len(report_df))
    total_po_need_to_send = report_df[po_need_to_send_cols].sum(axis=1) if po_need_to_send_cols else pd.Series([0]*len(report_df))

    # 6. Action Calculations
    report_df['Shortage'] = report_df['Total Requirement'] - report_df['Total Available Stock']
    report_df['Shortage'] = report_df['Shortage'].apply(lambda x: x if x > 0 else 0)
    
    pull_in_list = []
    upload_po_list = []
    need_po_list = []
    
    for idx, row in report_df.iterrows():
        shortage = row['Shortage']
        po_in = total_po_in_process[idx] if isinstance(total_po_in_process, pd.Series) else 0
        po_need = total_po_need_to_send[idx] if isinstance(total_po_need_to_send, pd.Series) else 0
        
        pull_in = "No"
        upload_po = "No"
        need_po = "No"
        
        if shortage > 0:
            if po_in > 0:
                pull_in = "Yes"
                shortage -= po_in
            if shortage > 0 and po_need > 0:
                upload_po = "Yes"
                shortage -= po_need
            if shortage > 0:
                need_po = "Yes"
                
        pull_in_list.append(pull_in)
        upload_po_list.append(upload_po)
        need_po_list.append(need_po)

    report_df['Pull in parts'] = pull_in_list
    report_df['Upload PO'] = upload_po_list
    report_df['Need PO'] = need_po_list
    
    # Format date columns in the final report to string to avoid JSON issues
    for col in report_df.select_dtypes(include=['datetime64', 'datetimetz']).columns:
        report_df[col] = report_df[col].dt.strftime('%Y-%m-%d')
        
    return report_df

@app.post("/generate_preview")
async def generate_preview(
    forecast_file: UploadFile = File(None),
    stock_file: UploadFile = File(None),
    backlog_file: UploadFile = File(None),
    po_file: UploadFile = File(None),
    config: str = Form(...)
):
    try:
        mapping_config = json.loads(config)
        report_df = process_report(forecast_file.file, stock_file.file, backlog_file.file, po_file.file, mapping_config)
        report_df = report_df.replace({np.nan: None})
        return {"data": report_df.to_dict(orient="records"), "columns": list(report_df.columns)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_report")
async def generate_report(
    forecast_file: UploadFile = File(None),
    stock_file: UploadFile = File(None),
    backlog_file: UploadFile = File(None),
    po_file: UploadFile = File(None),
    config: str = Form(...)
):
    try:
        mapping_config = json.loads(config)
        report_df = process_report(forecast_file.file, stock_file.file, backlog_file.file, po_file.file, mapping_config)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            report_df.to_excel(writer, index=False, sheet_name='Forecast Report')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Forecast_Report.xlsx"}
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Serve static assets
if os.path.isdir("../frontend/dist/assets"):
    app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")

# Catch-all route for SPA
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    dist_path = os.path.join("../frontend/dist", full_path)
    if os.path.isfile(dist_path):
        return FileResponse(dist_path)
    return FileResponse("../frontend/dist/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
