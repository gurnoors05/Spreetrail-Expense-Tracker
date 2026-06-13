import csv
from datetime import datetime
from decimal import Decimal
from django.core.files.uploadedfile import InMemoryUploadedFile
import codecs

from core.models import Group, User, ImportBatch, ImportAnomaly, Expense, ExpenseSplit

class CSVImporter:
    def __init__(self, group: Group, uploaded_by: User, file_name: str):
        self.group = group
        self.uploaded_by = uploaded_by
        self.file_name = file_name
        
        # Will track the last resolved date for chronological validation
        self.last_resolved_date = None

    def process_file(self, file_obj: InMemoryUploadedFile):
        batch = ImportBatch.objects.create(
            uploaded_by=self.uploaded_by,
            file_name=self.file_name
        )
        
        # Read file
        reader = csv.DictReader(codecs.iterdecode(file_obj, 'utf-8'))
        
        for idx, row in enumerate(reader):
            row_num = idx + 2 # +1 for 0-index, +1 for header
            self.process_row(batch, row_num, row)
            
        return batch

    def process_row(self, batch: ImportBatch, row_num: int, row: dict):
        """
        Processes a single row, running it through the pipeline of anomaly detectors.
        """
        raw_date = row.get('date', '').strip()
        
        # 1. Date Format Detector
        parsed_date, date_anomaly = self.parse_flexible_date(raw_date, row_num)
        
        if date_anomaly:
            ImportAnomaly.objects.create(
                import_batch=batch,
                row_reference=f"Row {row_num}",
                anomaly_type='Ambiguous Date',
                description=date_anomaly,
                action_taken='Flagged for manual review. Could not resolve chronologically.',
                status='pending'
            )
            # We skip creating the expense for now if we can't parse the date
            return
            
        if parsed_date:
            self.last_resolved_date = parsed_date
            
        # 2. Number Formatting (Amount)
        raw_amount = row.get('amount', '').strip()
        parsed_amount, amount_anomaly = self.parse_amount(raw_amount, row_num)
        if amount_anomaly:
            self._create_anomaly(batch, row_num, 'Invalid Amount', amount_anomaly)
            return
            
        # Zero-amount (Anomaly 12)
        if parsed_amount == Decimal('0.00'):
            self._create_anomaly(batch, row_num, 'Zero Amount', 'Expense has a 0.00 amount. Skipping from balances.', 'auto_applied')
            return
            
        # 3. Currency (Missing Currency -> INR)
        raw_currency = row.get('currency', '').strip()
        currency, currency_anomaly = self.parse_currency(raw_currency)
        if currency_anomaly:
            self._create_anomaly(batch, row_num, 'Missing Currency', currency_anomaly, 'auto_applied')
            
        # 4. Normalize Member Names & Missing Payer
        raw_payer = row.get('paid_by', '').strip()
        payer, payer_anomaly = self.normalize_member_name(raw_payer)
        if payer_anomaly:
            self._create_anomaly(batch, row_num, 'Missing/Unknown Payer', payer_anomaly)
            return

        # 5. Foreign Currency (USD -> INR)
        original_amount, original_currency = parsed_amount, currency
        final_amount = parsed_amount
        exchange_rate_used = None
        if currency == 'USD':
            exchange_rate_used = Decimal('83.50')
            final_amount = (parsed_amount * exchange_rate_used).quantize(Decimal('0.01'))
            self._create_anomaly(batch, row_num, 'Foreign Currency', f'Converted {parsed_amount} USD to {final_amount} INR at 83.50.', 'auto_applied')
            currency = 'INR'

        # 6. Settlement Logged as Expense
        split_type = row.get('split_type', '').strip()
        split_with_raw = row.get('split_with', '').strip()
        
        if not split_type and split_with_raw and ';' not in split_with_raw:
            # Looks like a settlement
            payee, payee_err = self.normalize_member_name(split_with_raw)
            if payee:
                self._create_anomaly(batch, row_num, 'Settlement Logged as Expense', f'Converted to Settlement from {payer.username} to {payee.username}.', 'auto_applied')
                # For auto-applied settlements, we can create them immediately
                Settlement.objects.create(
                    group=self.group, paid_by=payer, paid_to=payee,
                    amount=final_amount, date=parsed_date, note=row.get('notes', '')
                )
                return
            else:
                self._create_anomaly(batch, row_num, 'Settlement Logged as Expense', f'Missing payee: {split_with_raw}.', 'pending')
                return

        # 7. Duplicates
        description = row.get('description', '').strip()
        from django.db.models import Q
        possible_dups = Expense.objects.filter(
            group=self.group, date=parsed_date, status='active'
        ).filter(description__icontains=description[:10])
        
        for dup in possible_dups:
            if dup.amount == final_amount and dup.paid_by == payer:
                self._create_anomaly(batch, row_num, 'Exact Duplicate', f"Matches exact expense: {dup.description}", 'auto_applied', 'Discarded')
                return
            else:
                self._create_anomaly(batch, row_num, 'Conflicting Duplicate', f"Similar event '{dup.description}' has different amount or payer.", 'pending')
                return

        # 8. Split Type / Details Mismatch
        split_details_raw = row.get('split_details', '').strip()
        if split_type == 'equal' and split_details_raw:
            self._create_anomaly(batch, row_num, 'Split Details Mismatch', f"split_type is 'equal' but details are provided: {split_details_raw}", 'pending')
            return

        # Parse split_with
        split_with_names = [n.strip() for n in split_with_raw.split(';') if n.strip()]
        valid_users = []
        from core.models import GroupMembership
        for name in split_with_names:
            u, err = self.normalize_member_name(name)
            if not u:
                self._create_anomaly(batch, row_num, 'Non-member in Split', f"{name} is not a known user.", 'pending')
                return
            
            is_active = GroupMembership.objects.filter(group=self.group, user=u, joined_date__lte=parsed_date).exclude(left_date__lt=parsed_date).exists()
            if not is_active:
                self._create_anomaly(batch, row_num, 'Stale/Inactive Membership', f"{u.username} was not active on {parsed_date}.", 'auto_applied', f"Excluded {u.username}")
            else:
                valid_users.append(u)

        if not valid_users:
            self._create_anomaly(batch, row_num, 'Empty Valid Split', "No active members found for split.", 'pending')
            return

        # 9. Percentage Sum Validation
        if split_type == 'percentage' and split_details_raw:
            import re
            total_pct = Decimal('0')
            for part in split_details_raw.split(';'):
                match = re.search(r'([\d\.]+)', part)
                if match:
                    total_pct += Decimal(match.group(1))
            if total_pct != Decimal('100'):
                self._create_anomaly(batch, row_num, 'Percentage Sum Mismatch', f"Percentages sum to {total_pct}%, expected 100%.", 'pending')
                return

        # If it passed all and is equal split, create the Expense using the API Serializer logic
        if split_type == 'equal':
            from api.serializers import ExpenseSerializer
            data = {
                'group': self.group.id, 'description': description, 'date': parsed_date,
                'paid_by': payer.id, 'amount': final_amount, 'original_amount': original_amount,
                'original_currency': original_currency, 'exchange_rate_used': exchange_rate_used,
                'split_type': split_type, 'notes': row.get('notes', ''),
                'split_details': [{'user': u.id} for u in valid_users]
            }
            serializer = ExpenseSerializer(data=data)
            if serializer.is_valid():
                serializer.save()
            else:
                self._create_anomaly(batch, row_num, 'Validation Error', str(serializer.errors), 'pending')
    def _create_anomaly(self, batch, row_num, anomaly_type, description, status='pending', action_taken='Flagged for manual review.'):
        return ImportAnomaly.objects.create(
            import_batch=batch, row_reference=f"Row {row_num}", anomaly_type=anomaly_type,
            description=description, action_taken=action_taken, status=status
        )

    def parse_amount(self, raw_amount: str, row_num: int):
        if not raw_amount:
            return None, "Amount is empty"
        clean_amount = raw_amount.replace('"', '').replace(',', '').strip()
        try:
            return Decimal(clean_amount), None
        except:
            return None, f"Could not parse amount: {raw_amount}"

    def parse_currency(self, raw_currency: str):
        if not raw_currency:
            return 'INR', "Currency was empty. Defaulted to INR."
        return raw_currency.upper(), None

    def normalize_member_name(self, raw_name: str):
        if not raw_name:
            return None, "Payer is missing."
        clean_name = raw_name.strip().lower()
        # Find active member by username (case insensitive)
        user = User.objects.filter(username__iexact=clean_name).first()
        if user:
            return user, None
        return None, f"Could not match user '{raw_name}' to any existing member."

    def parse_flexible_date(self, raw_date_str: str, row_num: int):
        """
        Anomaly Detector: Inconsistent Date Formats
        Expects chronological order to resolve ambiguous dates like 'Mar-14' or '04-05-2026'.
        Returns (resolved_date, error_string)
        """
        if not raw_date_str:
            return None, "Missing date"

        # Try standard DD-MM-YYYY
        try:
            dt = datetime.strptime(raw_date_str, "%d-%m-%Y").date()
            # If it's something like 04-05-2026, it could mean May 4 or April 5.
            # In Python, %d-%m-%Y parses '04-05-2026' as May 4. 
            # But let's check chronological consistency.
            if self.last_resolved_date:
                # If standard parsing puts it before the last resolved date, maybe it's MM-DD-YYYY
                if dt < self.last_resolved_date:
                    alt_dt = datetime.strptime(raw_date_str, "%m-%d-%Y").date()
                    if alt_dt >= self.last_resolved_date:
                        return alt_dt, None
            return dt, None
        except ValueError:
            pass
            
        # Try Mar-14 (Mon-DD)
        try:
            # We don't have a year.
            parsed_no_year = datetime.strptime(raw_date_str, "%b-%d")
            # We must infer year from last_resolved_date
            if self.last_resolved_date:
                year = self.last_resolved_date.year
                inferred_dt = parsed_no_year.replace(year=year).date()
                if inferred_dt < self.last_resolved_date:
                    # Maybe it's next year?
                    inferred_dt_next = parsed_no_year.replace(year=year + 1).date()
                    return inferred_dt_next, None
                return inferred_dt, None
            else:
                # We have no anchor, fallback to 2026 as per scope
                return parsed_no_year.replace(year=2026).date(), None
        except ValueError:
            pass
            
        return None, f"Could not parse date format: {raw_date_str}"
