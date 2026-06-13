import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from decimal import Decimal
import re

split_details_raw = "Aisha 2; Rohan 1; Priya 1"
final_amount = Decimal('48000.00')
split_type = 'share'

parsed_shares = []
total_shares_val = Decimal('0.00')

for part in split_details_raw.split(';'):
    if not part.strip(): continue
    match = re.search(r'([a-zA-Z0-9_]+)[^\d]*([\d\.]+)', part)
    if match:
        uname = match.group(1).lower()
        val = Decimal(match.group(2))
        parsed_shares.append({'user': uname, 'val': val})
        if split_type == 'share':
            total_shares_val += val
            
shares = []
for ps in parsed_shares:
    u = ps['user']
    val = ps['val']
    if split_type == 'share':
        share_amt = (final_amount * (val / total_shares_val)).quantize(Decimal('0.01'))
        shares.append({'user': u, 'amount': share_amt})

print("Shares:", shares)
