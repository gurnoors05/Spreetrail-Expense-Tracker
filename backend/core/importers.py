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
