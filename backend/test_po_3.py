import pandas as pd
import json

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
        
    if po_date_col and po_date_col in po_active.columns:
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
            month_str = pd.to_datetime(skey + '-01').strftime('%b %Y')
            
        sent_col = f"{month_str} PO In Process"
        not_sent_col = f"{month_str} PO Need To Send"
        
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
    print(report_df.columns)
    print(report_df)

process_po()
