import pandas as pd
from datetime import datetime

def auto_categorize_transaction(description: str) -> str:
    """
    Uses a Hash Map to identify keywords in the description and assign fixed categories.
    Default fallback is 'Other'.
    """
    description = description.lower()
    
    # Hash Map for O(1) keyword lookups
    category_map = {
        "zomato": "Food", "swiggy": "Food", "mcdonalds": "Food",
        "uber": "Travel", "ola": "Travel", "irctc": "Travel",
        "amazon": "Shopping", "flipkart": "Shopping", "myntra": "Shopping",
        "netflix": "Entertainment", "spotify": "Entertainment", "movie": "Entertainment",
        "jio": "Bills", "airtel": "Bills", "electricity": "Bills"
    }
    
    for keyword, category in category_map.items():
        if keyword in description:
            return category
            
    return "Other"

def process_transaction_file(file_path: str, user_id: int) -> list:
    """
    Reads a CSV/Excel file, formats data to API specifications, 
    and filters duplicates using a Hash Set.
    """
    # Load file based on extension
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.xlsx'):
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format. Please upload CSV or Excel.")

    processed_transactions = []
    seen_transactions = set() # Hash Set for O(1) duplicate detection

    for _, row in df.iterrows():
        # Standardize Date format to YYYY-MM-DD
        raw_date = pd.to_datetime(row['Date'])
        txn_date = raw_date.strftime('%Y-%m-%d')
        
        amount = float(row['Amount'])
        description = str(row['Description']).strip()
        txn_type = "expense" if amount < 0 else "income"
        abs_amount = abs(amount)

        # Unique identifier for duplicate detection
        txn_signature = (txn_date, abs_amount, description.lower())
        
        if txn_signature in seen_transactions:
            continue  # Skip duplicate
            
        seen_transactions.add(txn_signature)

        # Map to strict API schema
        transaction = {
            "user_id": user_id,
            "amount": abs_amount,
            "type": txn_type,
            "category": auto_categorize_transaction(description),
            "description": description,
            "txn_date": txn_date,
            "payment_type": "online", # Default assumption for bank imports
            "month": raw_date.month,
            "year": raw_date.year
        }
        processed_transactions.append(transaction)
        
    return processed_transactions