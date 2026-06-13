from decimal import Decimal
from collections import defaultdict
from core.models import Group, Expense, ExpenseSplit, Settlement

def calculate_group_balances(group_id):
    """
    Returns net balances for each user in the group, pairwise balances, 
    and simplified debt settlements.
    """
    net_balances = defaultdict(Decimal)
    
    # Process Expenses and Splits
    expenses = Expense.objects.filter(group_id=group_id, status='active').prefetch_related('splits')
    
    pairwise = defaultdict(lambda: defaultdict(Decimal))

    for expense in expenses:
        if expense.paid_by:
            net_balances[expense.paid_by.id] += expense.amount
            
            for split in expense.splits.all():
                net_balances[split.user.id] -= split.share_amount
                if split.user.id != expense.paid_by.id:
                    pairwise[split.user.id][expense.paid_by.id] += split.share_amount

    # Process Settlements
    settlements = Settlement.objects.filter(group_id=group_id)
    for settlement in settlements:
        net_balances[settlement.paid_by.id] += settlement.amount
        net_balances[settlement.paid_to.id] -= settlement.amount
        pairwise[settlement.paid_by.id][settlement.paid_to.id] -= settlement.amount

    # Consolidate Pairwise
    consolidated_pairwise = []
    processed_pairs = set()
    for u1 in list(pairwise.keys()):
        for u2 in list(pairwise[u1].keys()):
            pair = tuple(sorted([u1, u2]))
            if pair in processed_pairs:
                continue
            processed_pairs.add(pair)
            
            # u1 owes u2 amt1
            amt1 = pairwise[u1][u2]
            # u2 owes u1 amt2
            amt2 = pairwise[u2][u1]
            
            net = amt1 - amt2
            if net > Decimal('0.00'):
                consolidated_pairwise.append({'from_user': u1, 'to_user': u2, 'amount': net})
            elif net < Decimal('0.00'):
                consolidated_pairwise.append({'from_user': u2, 'to_user': u1, 'amount': abs(net)})

    # Debt Simplification (Greedy)
    debtors = []
    creditors = []
    
    for user_id, balance in net_balances.items():
        if balance < Decimal('0.00'):
            debtors.append({'user_id': user_id, 'amount': abs(balance)})
        elif balance > Decimal('0.00'):
            creditors.append({'user_id': user_id, 'amount': balance})
            
    debtors.sort(key=lambda x: x['amount'], reverse=True)
    creditors.sort(key=lambda x: x['amount'], reverse=True)
    
    simplified_debts = []
    i, j = 0, 0
    
    while i < len(debtors) and j < len(creditors):
        debt = debtors[i]['amount']
        credit = creditors[j]['amount']
        
        amount = min(debt, credit)
        
        simplified_debts.append({
            'from_user': debtors[i]['user_id'],
            'to_user': creditors[j]['user_id'],
            'amount': amount
        })
        
        debtors[i]['amount'] -= amount
        creditors[j]['amount'] -= amount
        
        if debtors[i]['amount'] == Decimal('0.00'):
            i += 1
        if creditors[j]['amount'] == Decimal('0.00'):
            j += 1
            
    return {
        'net_balances': {k: str(v) for k, v in net_balances.items()},
        'pairwise': [{'from_user': p['from_user'], 'to_user': p['to_user'], 'amount': str(p['amount'])} for p in consolidated_pairwise],
        'simplified_debts': [{'from_user': d['from_user'], 'to_user': d['to_user'], 'amount': str(d['amount'])} for d in simplified_debts]
    }
