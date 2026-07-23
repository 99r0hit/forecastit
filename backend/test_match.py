import pandas as pd

def align_part_numbers(target_df, target_col, reference_series):
    ref_df = pd.DataFrame({'Original': reference_series, 'Norm': reference_series.astype(str).str.replace(r'[\-\s]', '', regex=True).str.upper()})
    mapping = ref_df.drop_duplicates('Norm').set_index('Norm')['Original'].to_dict()
    
    target_norm = target_df[target_col].astype(str).str.replace(r'[\-\s]', '', regex=True).str.upper()
    target_df[target_col] = target_norm.map(mapping).fillna(target_df[target_col])
    return target_df

forecast = pd.Series(['1608-C70200H-KM0BXBY2833-2T-AM(EMM)'])
po_df = pd.DataFrame({'Part No': ['1608-C70200H-KM0BXBY2833-2TAM(EMM)']})

po_df = align_part_numbers(po_df, 'Part No', forecast)
print("Aligned PO Part No:", po_df['Part No'].iloc[0])
print("Forecast Part No:", forecast.iloc[0])
print("Match?", po_df['Part No'].iloc[0] == forecast.iloc[0])
