import pandas as pd
import json
import io

def process_po():
    po_data = {
        'Unnamed: 0': ['sent', None, 'sended', 'Loaded', None],
        'SCPL PO number': [1, 2, 3, 4, 5],
        'Part No :': ['A', 'A', 'B', 'B', 'C'],
        'PO Qty. ': [100, 200, 300, 400, 500],
        'Swingtel Request Date\n (SRD)': ['2026-07-01', '2026-07-02', '2026-08-01', '2026-08-02', '2026-09-01'],
        'Remark': [None, None, None, 'Loaded', None]
    }
    po_df = pd.DataFrame(po_data)
    po_df['Swingtel Request Date\n (SRD)'] = pd.to_datetime(po_df['Swingtel Request Date\n (SRD)'])

    report_df = pd.DataFrame({'Part Number': ['A', 'B', 'C', 'D'], 'Total Requirement': [1000, 1000, 1000, 1000], 'Total Available Stock': [0, 0, 0, 0]})

    po_part_col = 'Part No :'
    po_qty_col = 'PO Qty. '
    po_remark_col = 'Remark'
    po_status_col = 'Unnamed: 0'
    po_date_col = 'Swingtel Request Date\n (SRD)'

    po_df[po_part_col] = po_df[po_part_col].astype(str).str.strip()
    po_df[po_qty_col] = pd.to_numeric(po_df[po_qty_col], errors='coerce').fillna(0)
    
    if po_remark_col:
        po_active = po_df[~po_df[po_remark_col].astype(str).str.contains('Loaded', case=False, na=False)].copy()
    else:
        po_active = po_df.copy()
        
    print("PO Active:")
    print(po_active)
    
    if po_date_col and po_date_col in po_active.columns:
        po_active[po_date_col] = pd.to_datetime(po_active[po_date_col], errors='coerce')
        po_active['PO_Month'] = po_active[po_date_col].dt.strftime('%B %Y')
        po_active['PO_Month'] = po_active['PO_Month'].fillna('Unknown Month')
    else:
        po_active['PO_Month'] = 'Unknown Month'

    if po_status_col:
        sent_mask = po_active[po_status_col].astype(str).str.contains('sent|sended', case=False, na=False)
        po_sent = po_active[sent_mask]
        po_not_sent = po_active[~sent_mask]
    else:
        po_sent = po_active
        po_not_sent = pd.DataFrame(columns=po_active.columns)

    po_sent_pivot = po_sent.groupby([po_part_col, 'PO_Month'], as_index=False).agg({po_qty_col: 'sum'})
    po_not_sent_pivot = po_not_sent.groupby([po_part_col, 'PO_Month'], as_index=False).agg({po_qty_col: 'sum'})
    
    if not po_sent_pivot.empty:
        po_sent_wide = po_sent_pivot.pivot(index=po_part_col, columns='PO_Month', values=po_qty_col).fillna(0)
        po_sent_wide.columns = [f"{col} PO In Process" for col in po_sent_wide.columns]
        po_sent_wide = po_sent_wide.reset_index().rename(columns={po_part_col: 'Part Number'})
        report_df = pd.merge(report_df, po_sent_wide, on='Part Number', how='left')
    else:
        report_df['PO In Process'] = 0

    if not po_not_sent_pivot.empty:
        po_not_sent_wide = po_not_sent_pivot.pivot(index=po_part_col, columns='PO_Month', values=po_qty_col).fillna(0)
        po_not_sent_wide.columns = [f"{col} PO Need To Send" for col in po_not_sent_wide.columns]
        po_not_sent_wide = po_not_sent_wide.reset_index().rename(columns={po_part_col: 'Part Number'})
        report_df = pd.merge(report_df, po_not_sent_wide, on='Part Number', how='left')
    else:
        report_df['PO Need To Send'] = 0
        
    po_in_process_cols = [c for c in report_df.columns if "PO In Process" in c]
    po_need_to_send_cols = [c for c in report_df.columns if "PO Need To Send" in c]
    
    report_df[po_in_process_cols] = report_df[po_in_process_cols].fillna(0)
    report_df[po_need_to_send_cols] = report_df[po_need_to_send_cols].fillna(0)

    total_po_in_process = report_df[po_in_process_cols].sum(axis=1) if po_in_process_cols else pd.Series([0]*len(report_df))
    total_po_need_to_send = report_df[po_need_to_send_cols].sum(axis=1) if po_need_to_send_cols else pd.Series([0]*len(report_df))

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
    
    print("Final Report:")
    print(report_df)

process_po()
