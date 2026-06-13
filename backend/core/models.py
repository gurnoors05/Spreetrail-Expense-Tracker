from django.db import models
from django.contrib.auth.models import User

class Group(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class GroupMembership(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships')
    joined_date = models.DateField()
    left_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"

class Expense(models.Model):
    SPLIT_CHOICES = [
        ('equal', 'Equal'),
        ('unequal', 'Unequal'),
        ('percentage', 'Percentage'),
        ('share', 'Share'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('voided', 'Voided'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    description = models.CharField(max_length=255)
    date = models.DateField()
    paid_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='expenses_paid')
    amount = models.DecimalField(max_digits=12, decimal_places=2) # Always INR
    original_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    original_currency = models.CharField(max_length=3, default='INR')
    exchange_rate_used = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    split_type = models.CharField(max_length=20, choices=SPLIT_CHOICES)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_settlement = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    superseded_by = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='supersedes')

    def __str__(self):
        return f"{self.description} ({self.amount} INR)"

class ExpenseSplit(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expense_splits')
    share_amount = models.DecimalField(max_digits=12, decimal_places=2) # Final INR owed

    def __str__(self):
        return f"{self.user.username} owes {self.share_amount} for {self.expense.description}"

class Settlement(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='settlements')
    paid_by = models.ForeignKey(User, related_name='settlements_paid', on_delete=models.CASCADE)
    paid_to = models.ForeignKey(User, related_name='settlements_received', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    note = models.TextField(blank=True)

    def __str__(self):
        return f"{self.paid_by.username} paid {self.amount} to {self.paid_to.username}"

class ImportBatch(models.Model):
    group = models.ForeignKey('Group', on_delete=models.CASCADE, related_name='import_batches', null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='import_batches')
    file_name = models.CharField(max_length=255)

    def __str__(self):
        return f"Batch {self.id} - {self.file_name}"

class ImportAnomaly(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('auto_applied', 'Auto Applied'),
    ]
    import_batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='anomalies')
    row_reference = models.CharField(max_length=255) # e.g., "Row 15"
    anomaly_type = models.CharField(max_length=100)
    description = models.TextField()
    action_taken = models.TextField()
    raw_data = models.JSONField(null=True, blank=True)
    resolved_by_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='resolved_anomalies')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    def __str__(self):
        return f"{self.anomaly_type} at {self.row_reference} ({self.status})"
