import heapq
def get_top_k_expenses(transactions: list, k: int = 5) -> list:
    """
    Identifies the top K highest expenses using a Priority Queue (Min-Heap).
    """
    expense_heap = []   
    for txn in transactions:
        if txn['type'] == 'expense':
            # Add unique tie-breaker (id(txn)) to prevent dictionary comparison errors in tuples
            heap_entry = (txn['amount'], id(txn), txn)
            
            if len(expense_heap) < k:
                heapq.heappush(expense_heap, heap_entry)
            else:
                # If current transaction amount is larger than the smallest amount in the heap
                if txn['amount'] > expense_heap[0][0]:
                    heapq.heappushpop(expense_heap, heap_entry)
                    
    # The heap contains the top K elements. Sort them descending before returning.
    top_expenses = [item[2] for item in expense_heap]
    top_expenses.sort(key=lambda x: x['amount'], reverse=True)
    
    return top_expenses

# Add to analytics.py
def generate_spending_summary(transactions: list) -> dict:
    """
    Computes total spend, transaction count, and category-wise breakdown 
    using a Hash Map accumulator.
    """
    total_spent = 0.0
    category_totals = {}
    expense_count = 0

    for txn in transactions:
        if txn['type'] == 'expense':
            amt = txn['amount']
            cat = txn['category']
            
            total_spent += amt
            expense_count += 1
            category_totals[cat] = category_totals.get(cat, 0.0) + amt

    avg_expense = round(total_spent / expense_count, 2) if expense_count > 0 else 0.0

    return {
        "total_spent": round(total_spent, 2),
        "expense_count": expense_count,
        "average_expense": avg_expense,
        "category_breakdown": category_totals,
        "top_expenses": get_top_k_expenses(transactions, k=3)
    }