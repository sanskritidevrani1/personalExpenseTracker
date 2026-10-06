def merge_sort_transactions(transactions: list, sort_by: str = "txn_date", reverse: bool = False) -> list:
    """
    Sorts a list of transaction dictionaries using Merge Sort.
    sort_by: 'txn_date' or 'amount'
    """
    if len(transactions) <= 1:
        return transactions

    mid = len(transactions) // 2
    left_half = merge_sort_transactions(transactions[:mid], sort_by, reverse)
    right_half = merge_sort_transactions(transactions[mid:], sort_by, reverse)

    return merge(left_half, right_half, sort_by, reverse)

def merge(left: list, right: list, key: str, reverse: bool) -> list:
    sorted_list = []
    i = j = 0

    while i < len(left) and j < len(right):
        condition = left[i][key] > right[j][key] if reverse else left[i][key] < right[j][key]
        
        if condition:
            sorted_list.append(left[i])
            i += 1
        else:
            sorted_list.append(right[j])
            j += 1

    sorted_list.extend(left[i:])
    sorted_list.extend(right[j:])
    return sorted_list


def binary_search_by_amount(sorted_transactions: list, target_amount: float) -> list:
    """
    Searches for transactions matching a specific amount using Binary Search.
    Assumes sorted_transactions is already sorted by 'amount' in ascending order.
    """
    left, right = 0, len(sorted_transactions) - 1
    matches = []

    while left <= right:
        mid = (left + right) // 2
        mid_amount = sorted_transactions[mid]['amount']

        if mid_amount == target_amount:
            # Match found; expand left and right to catch multiple transactions with same amount
            matches.append(sorted_transactions[mid])
            
            # Check adjacent left
            l_ptr = mid - 1
            while l_ptr >= 0 and sorted_transactions[l_ptr]['amount'] == target_amount:
                matches.append(sorted_transactions[l_ptr])
                l_ptr -= 1
                
            # Check adjacent right
            r_ptr = mid + 1
            while r_ptr < len(sorted_transactions) and sorted_transactions[r_ptr]['amount'] == target_amount:
                matches.append(sorted_transactions[r_ptr])
                r_ptr += 1
                
            return matches

        elif mid_amount < target_amount:
            left = mid + 1
        else:
            right = mid - 1

    return matches