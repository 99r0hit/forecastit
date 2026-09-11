import re
import time
import pandas as pd
from typing import Dict, Any, Optional
import uuid
import datetime
from classifier import classify_series, normalize_part_number
from db import get_db_connection
from sqlalchemy import text


def ingest_data(demand_df: pd.DataFrame, shipment_df: pd.DataFrame, booking_df: pd.DataFrame, pos_df: pd.DataFrame, stock_df: pd.DataFrame) -> Dict[str, Any]:
    start_time = time.time()
    engine = get_db_connection()
    dfs_to_insert = []
    
    # 1. POS Data
    if pos_df is not None and not pos_df.empty:
        try:
            df = pos_df.copy()
            if 'Month ' in df.columns:
                df['Date'] = pd.to_datetime(df['Month '], errors='coerce').fillna(datetime.date.today())
            elif 'Month' in df.columns:
                df['Date'] = pd.to_datetime(df['Month'], errors='coerce').fillna(datetime.date.today())
            
            part_col = 'Everlight Part' if 'Everlight Part' in df.columns else df.columns[1]
            qty_col = 'Qty ' if 'Qty ' in df.columns else ('Qty' if 'Qty' in df.columns else df.columns[2])
            pos_price_col = 'POS' if 'POS' in df.columns else None
            pop_price_col = 'POP' if 'POP' in df.columns else None
            
            df = df[['Date', part_col, qty_col]].rename(columns={part_col: 'Part Number', qty_col: 'Value'})
            df['pos_price'] = pos_df[pos_price_col] if pos_price_col else 0.0
            df['pop_price'] = pos_df[pop_price_col] if pop_price_col else 0.0
            
            df['metric'] = 'pos'
            dfs_to_insert.append(df)
        except Exception as e: print("Error parsing POS:", e)

    # 2. Backlog (EVL Booking & At-Risk)
    if booking_df is not None and not booking_df.empty:
        try:
            df = booking_df.copy()
            cust_col = next((c for c in df.columns if 'cust name' in c.lower() or 'SHIP TO NAME' in c), None)
            if cust_col:
                df = df[df[cust_col].astype(str).str.contains('Swingtel', case=False, na=False)]
                
            part_col = next((c for c in df.columns if 'Part number' in c or '品名' in c), next((c for c in df.columns if '料號' in c), None))
            qty_col = next((c for c in df.columns if '未結量' in c or 'Balance' in c), None)
            date_col = next((c for c in df.columns if '需求日' in c or 'CRD' in c), None)
            credit_col = next((c for c in df.columns if '信用狀況' in c), None)
            
            if part_col and qty_col:
                if date_col:
                    if pd.api.types.is_numeric_dtype(df[date_col]):
                        df['Date'] = pd.to_datetime(df[date_col], origin='1899-12-30', unit='D', errors='coerce').fillna(datetime.date.today())
                    else:
                        df['Date'] = pd.to_datetime(df[date_col], errors='coerce').fillna(datetime.date.today())
                else:
                    df['Date'] = datetime.date.today()
                
                res_df = df[['Date', part_col, qty_col]].rename(columns={part_col: 'Part Number', qty_col: 'Value'})
                
                # Split into healthy booking and at-risk booking
                if credit_col:
                    is_at_risk = df[credit_col].astype(str).str.contains('B|A', regex=True, na=False)
                    res_df['metric'] = 'evl_booking'
                    res_df.loc[is_at_risk, 'metric'] = 'at_risk_backlog'
                else:
                    res_df['metric'] = 'evl_booking'
                
                res_df['pos_price'] = 0.0
                res_df['pop_price'] = 0.0
                dfs_to_insert.append(res_df)
        except Exception as e: print("Error parsing Backlog:", e)

    # 3. PO Tracker (Loaded POs & Pending POs)
    if shipment_df is not None and not shipment_df.empty:
        try:
            # We assume shipment_df is a dictionary of DataFrames if read with sheet_name=None

            if isinstance(shipment_df, dict):
                valid_sheets = []
                for k, v in shipment_df.items():
                    if k in ['Swingtel_2025', 'Swingtel 2026']:
                        valid_sheets.append(v)
                if valid_sheets:
                    df = pd.concat(valid_sheets, ignore_index=True)
                else:
                    df = pd.concat(shipment_df.values(), ignore_index=True)
            else:
                df = shipment_df.copy()

                
            part_col = 'Part No :' if 'Part No :' in df.columns else df.columns[3]
            qty_col = 'PO Qty. ' if 'PO Qty. ' in df.columns else df.columns[4]
            date_col = 'Date of PO :' if 'Date of PO :' in df.columns else df.columns[2]
            remark_col = 'Remark' if 'Remark' in df.columns else None
            
            if pd.api.types.is_numeric_dtype(df[date_col]):
                df['Date'] = pd.to_datetime(df[date_col], origin='1899-12-30', unit='D', errors='coerce').fillna(datetime.date.today())
            else:
                df['Date'] = pd.to_datetime(df[date_col], errors='coerce').fillna(datetime.date.today())
                
            res_df = df[['Date', part_col, qty_col]].rename(columns={part_col: 'Part Number', qty_col: 'Value'})
            
            if remark_col:
                is_loaded = df[remark_col].astype(str).str.lower().str.contains('load')
                res_df['metric'] = 'pending_po'
                res_df.loc[is_loaded, 'metric'] = 'evl_shipment' # We map loaded PO to evl_shipment
            else:
                res_df['metric'] = 'pending_po' # Default if no remark
                
            res_df['pos_price'] = 0.0
            res_df['pop_price'] = 0.0
            dfs_to_insert.append(res_df)
        except Exception as e: print("Error parsing PO Tracker:", e)

    # 4. Stock
    if stock_df is not None and not stock_df.empty:
        try:
            df = stock_df.copy()
            part_col = 'MPN' if 'MPN' in df.columns else ('Item Code' if 'Item Code' in df.columns else df.columns[3])
            qty_col = 'Sum of Stock in Hand' if 'Sum of Stock in Hand' in df.columns else df.columns[5]
            
            df['Date'] = datetime.date.today()
            df = df[['Date', part_col, qty_col]].rename(columns={part_col: 'Part Number', qty_col: 'Value'})
            df['metric'] = 'inventory'
            df['pos_price'] = 0.0
            df['pop_price'] = 0.0
            dfs_to_insert.append(df)
        except Exception as e: print("Error parsing Stock:", e)

    # 5. Forecast (Demand) - Needs Melting
    if demand_df is not None and not demand_df.empty:
        try:
            df = demand_df.copy()
            part_col = 'Mfr Catalogue No.' if 'Mfr Catalogue No.' in df.columns else 'Forecast Name'
            
            date_cols = [c for c in df.columns if re.match(r'^20\d{2}\s\d{2}$', str(c))]
            if not date_cols:
                date_cols = [c for c in df.columns if isinstance(c, datetime.datetime)]
            
            if date_cols and part_col in df.columns:
                melted = pd.melt(df, id_vars=[part_col], value_vars=date_cols, var_name='Month', value_name='Value')
                
                def parse_date(x):
                    try:
                        if isinstance(x, datetime.datetime): return x
                        parts = str(x).split()
                        if len(parts) == 2: return datetime.date(int(parts[0]), int(parts[1]), 1)
                        return datetime.date.today()
                    except: return datetime.date.today()
                
                melted['Date'] = melted['Month'].apply(parse_date)
                melted['Part Number'] = melted[part_col]
                res_df = melted[['Date', 'Part Number', 'Value']].copy()
                res_df['metric'] = 'customer_demand'
                res_df['pos_price'] = 0.0
                res_df['pop_price'] = 0.0
                dfs_to_insert.append(res_df)
        except Exception as e: print("Error parsing Forecast:", e)

    if not dfs_to_insert:
        return {'status': 'success', 'records_imported': 0, 'execution_time_ms': int((time.time() - start_time) * 1000)}

    combined_df = pd.concat(dfs_to_insert, ignore_index=True)
    combined_df['id'] = [str(uuid.uuid4()) for _ in range(len(combined_df))]
    combined_df['record_date'] = pd.to_datetime(combined_df['Date']).dt.date
    combined_df['part_number'] = combined_df['Part Number'].astype(str)
    combined_df['normalized_part'] = combined_df['part_number'].apply(normalize_part_number)
    combined_df['series'] = combined_df['part_number'].apply(classify_series)
    combined_df['Value'] = pd.to_numeric(combined_df['Value'], errors='coerce').fillna(0.0)

    for m in ['evl_shipment', 'evl_booking', 'pos', 'customer_demand', 'inventory', 'at_risk_backlog', 'pending_po']:
        combined_df[m] = combined_df.apply(lambda row: row['Value'] if row['metric'] == m else 0.0, axis=1)

    final_df = combined_df[['id', 'record_date', 'part_number', 'normalized_part', 'series', 'evl_shipment', 'evl_booking', 'pos', 'customer_demand', 'inventory', 'at_risk_backlog', 'pending_po', 'pos_price', 'pop_price']]

    with engine.begin() as conn:
        final_df.to_sql('supply_chain_data', conn, if_exists='append', index=False)

    return {
        'status': 'success',
        'records_imported': len(final_df),
        'execution_time_ms': int((time.time() - start_time) * 1000)
    }

def get_analytics(series: Optional[str], part_number: Optional[str], granularity: str, lead_time_weeks: int = 8) -> Dict[str, Any]:
    engine = get_db_connection()
    
    offset_months = max(1, round(lead_time_weeks / 4))
    po_offset = offset_months
    backlog_offset = max(1, offset_months - 1)
    
    if granularity == 'annual':
        period_expr = "date_trunc('year', record_date)"
        shifted_po_expr = f"date_trunc('year', record_date + INTERVAL '{po_offset} months')"
        shifted_backlog_expr = f"date_trunc('year', record_date + INTERVAL '{backlog_offset} months')"
    elif granularity == 'quarterly':
        period_expr = "date_trunc('quarter', record_date)"
        shifted_po_expr = f"date_trunc('quarter', record_date + INTERVAL '{po_offset} months')"
        shifted_backlog_expr = f"date_trunc('quarter', record_date + INTERVAL '{backlog_offset} months')"
    elif granularity == 'half_yearly':
        period_expr = "make_date(CAST(EXTRACT(YEAR FROM record_date) AS INTEGER), CAST((EXTRACT(MONTH FROM record_date)-1)/6 AS INTEGER) * 6 + 1, 1)"
        shifted_po_expr = f"make_date(CAST(EXTRACT(YEAR FROM record_date + INTERVAL '{po_offset} months') AS INTEGER), CAST((EXTRACT(MONTH FROM record_date + INTERVAL '{po_offset} months')-1)/6 AS INTEGER) * 6 + 1, 1)"
        shifted_backlog_expr = f"make_date(CAST(EXTRACT(YEAR FROM record_date + INTERVAL '{backlog_offset} months') AS INTEGER), CAST((EXTRACT(MONTH FROM record_date + INTERVAL '{backlog_offset} months')-1)/6 AS INTEGER) * 6 + 1, 1)"
    else: 
        period_expr = "date_trunc('month', record_date)"
        shifted_po_expr = f"date_trunc('month', record_date + INTERVAL '{po_offset} months')"
        shifted_backlog_expr = f"date_trunc('month', record_date + INTERVAL '{backlog_offset} months')"
        
    query = f"""
        WITH base_demand AS (
            SELECT {period_expr} as period, SUM(customer_demand) as customer_demand, SUM(pos) as pos, (array_agg(inventory ORDER BY record_date DESC))[1] as inventory, SUM(pos_price * pos) as total_revenue
            FROM supply_chain_data WHERE (customer_demand > 0 OR pos > 0 OR inventory > 0) AND record_date >= '2025-01-01'
            { " AND series = :series" if series else "" }
            { " AND normalized_part = :part" if part_number else "" }
            GROUP BY period
        ),
        shifted_po AS (
            SELECT {shifted_po_expr} as period, SUM(evl_shipment) as evl_shipment, SUM(pending_po) as pending_po
            FROM supply_chain_data WHERE (evl_shipment > 0 OR pending_po > 0) AND record_date >= '2025-01-01'
            { " AND series = :series" if series else "" }
            { " AND normalized_part = :part" if part_number else "" }
            GROUP BY period
        ),
        shifted_backlog AS (
            SELECT {shifted_backlog_expr} as period, SUM(evl_booking) as evl_booking, SUM(at_risk_backlog) as at_risk_backlog
            FROM supply_chain_data WHERE (evl_booking > 0 OR at_risk_backlog > 0) AND record_date >= '2025-01-01'
            { " AND series = :series" if series else "" }
            { " AND normalized_part = :part" if part_number else "" }
            GROUP BY period
        ),
        all_periods AS (
            SELECT period FROM base_demand
            UNION SELECT period FROM shifted_po
            UNION SELECT period FROM shifted_backlog
        )
        SELECT 
            ap.period,
            COALESCE(bd.customer_demand, 0) as customer_demand,
            COALESCE(bd.pos, 0) as pos,
            COALESCE(bd.inventory, 0) as inventory,
            COALESCE(bd.total_revenue, 0) as total_revenue,
            COALESCE(sp.evl_shipment, 0) as evl_shipment,
            COALESCE(sp.pending_po, 0) as pending_po,
            COALESCE(sb.evl_booking, 0) as evl_booking,
            COALESCE(sb.at_risk_backlog, 0) as at_risk_backlog
        FROM all_periods ap
        LEFT JOIN base_demand bd ON ap.period = bd.period
        LEFT JOIN shifted_po sp ON ap.period = sp.period
        LEFT JOIN shifted_backlog sb ON ap.period = sb.period
        ORDER BY ap.period
    """
    
    params = {}
    if series:
        params['series'] = series
    if part_number:
        params['part'] = normalize_part_number(part_number)
        
    with engine.connect() as conn:
        df = pd.read_sql(text(query), conn, params=params)
    
    if 'period' in df.columns:
        df['period'] = pd.to_datetime(df['period']).dt.strftime('%Y-%m-%d')
        
    chart_data = df.to_dict(orient="records")
    
    total_booking = df['evl_booking'].sum() if not df.empty else 0
    total_shipment = df['evl_shipment'].sum() if not df.empty else 0
    
    book_to_bill = (total_booking / total_shipment) if total_shipment > 0 else 0
    
    insights = []
    insights.append(f"Book-to-Bill Ratio: {book_to_bill:.2f}")
    if book_to_bill > 1.1:
        insights.append("High demand: Bookings significantly outpace shipments.")
    elif book_to_bill < 0.9 and total_shipment > 0:
        insights.append("Warning: Shipments are outpacing new bookings.")
        
    if not df.empty and part_number:
        latest = df.iloc[-1]
        if latest['customer_demand'] > (latest['evl_shipment'] + latest['inventory']):
            insights.append(f"CRITICAL SHORTAGE: Projected demand exceeds Time-Shifted POs + Inventory.")
        if latest['at_risk_backlog'] > 0:
            insights.append(f"RISK: {latest['at_risk_backlog']:,.0f} units in backlog are on Credit Hold!")
        if latest['pending_po'] > 0:
            insights.append(f"SALES BOTTLENECK: {latest['pending_po']:,.0f} units of POs are un-loaded/pending!")
        
    return {
        "chart_data": chart_data,
        "insights": insights
    }
