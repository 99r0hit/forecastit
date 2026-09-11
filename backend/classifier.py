import re

def normalize_part_number(part: str) -> str:
    if not part or not isinstance(part, str):
        return ""
    # Remove all non-alphanumeric chars
    cleaned = re.sub(r'[^a-zA-Z0-9]', '', str(part)).upper()
    # Correct common OCR/typing mistakes (e.g., 'O' instead of '0' in part numbers)
    # Most Everlight part numbers use '0' instead of 'O'
    cleaned = cleaned.replace('O', '0')
    return cleaned

def classify_series(part: str) -> str:
    norm = normalize_part_number(part)
    if not norm:
        return "Other"
    
    if re.search(r'1608', norm):
        return "1608 series"
    elif re.search(r'6711|6721', norm):
        return "67-11 and 67-21 series"
    elif re.search(r'6741', norm):
        return "67-41 series"
    elif re.search(r'6511|6521', norm):
        return "65-11 and 65-21 series"
    elif re.search(r'2820', norm):
        return "2820"
    elif re.search(r'XI3030', norm):
        return "XI3030"
    elif re.search(r'ALFS', norm):
        return "ALFS"
    else:
        return "Other"
