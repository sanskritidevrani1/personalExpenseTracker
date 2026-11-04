import re
from datetime import datetime
import easyocr
from data_processing import auto_categorize_transaction
import os

# Initialize the OCR reader once (loads English model into memory)
reader = easyocr.Reader(['en'], gpu=False)

def parse_receipt_text(text_lines: list, user_id: int) -> dict:
    """
    Uses Regular Expressions (Regex) and heuristics to extract Merchant, 
    Date, and Total Amount from raw OCR text lines.
    """
    full_text = " ".join(text_lines)
    
    # 1. Extract Merchant / Description (Usually the first valid text line on a receipt)
    description = "Receipt Purchase"
    for line in text_lines:
        clean_line = line.strip()
        # Skip empty lines or lines that are just numbers/symbols
        if len(clean_line) > 2 and not clean_line.replace('.', '').isdigit():
            description = clean_line
            break

    # 2. Extract Date using Regex
    txn_date = datetime.today().strftime('%Y-%m-%d') # Default fallback to today
    
    # Upgraded patterns to catch dots and squished text
    date_patterns = [
        r'(\d{4}[-/.]\d{2}[-/.]\d{2})',       # YYYY-MM-DD or YYYY.MM.DD
        r'(\d{2}[-/.]\d{2}[-/.]\d{4})',       # DD-MM-YYYY or DD.MM.YYYY
        r'(\d{2}[-/.]\d{2}[-/.]\d{2})(?!\d)'  # DD/MM/YY (ignores long serial numbers)
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, full_text)
        if match:
            # Normalize all separators (slashes and dots) to hyphens
            raw_date_str = match.group(1).replace('/', '-').replace('.', '-')
            try:
                parts = raw_date_str.split('-')
                if len(parts[0]) == 4:
                    dt = datetime.strptime(raw_date_str, '%Y-%m-%d')
                elif len(parts[2]) == 4:
                    dt = datetime.strptime(raw_date_str, '%d-%m-%Y')
                elif len(parts[2]) == 2:
                    dt = datetime.strptime(raw_date_str, '%d-%m-%y')
                
                txn_date = dt.strftime('%Y-%m-%d')
                break
            except ValueError:
                continue

  # 3. Extract Total Amount (Ignores commas in thousands)
    amount = 0.0
    total_regex = r'(?:total|amount|payable|net|due)[\s:₹$Rs.]*([0-9,]+(?:\.[0-9]{1,2})?)'
    total_matches = re.findall(total_regex, full_text, re.IGNORECASE)
    
    if total_matches:
        amount = max(float(val.replace(',', '')) for val in total_matches)
    else:
        all_Decimals = re.findall(r'\b[0-9,]+\.\d{2}\b', full_text)
        if all_Decimals:
            amount = max(float(val.replace(',', '')) for val in all_Decimals)

    # THIS LINE WAS MISSING: Re-convert the string to extract month/year
    dt_obj = datetime.strptime(txn_date, '%Y-%m-%d')

    # 4. Map to your strict API schema
    return {
        "user_id": user_id,
        "amount": amount,
        "type": "expense",
        "category": auto_categorize_transaction(description + " " + full_text),
        "description": description,
        "txn_date": txn_date,
        "payment_type": "receipt_scan",
        "month": dt_obj.month,
        "year": dt_obj.year
    }

def scan_receipt_image(image_path: str, user_id: int = 1) -> dict:
    """
    Reads an image file using EasyOCR's native contrast adjustment, 
    extracts text, and returns a structured transaction dict.
    """
    # adjust_contrast=True handles shadows and faded ink natively
    extracted_lines = reader.readtext(image_path, detail=0, adjust_contrast=True)
    
    if not extracted_lines:
        raise ValueError("No readable text found in the receipt image.")
        
    return parse_receipt_text(extracted_lines, user_id)