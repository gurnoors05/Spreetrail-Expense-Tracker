from django.contrib import admin
from .models import Group, GroupMembership, Expense, ExpenseSplit, Settlement, ImportBatch, ImportAnomaly

@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ('expense', 'user', 'share_amount')
    list_filter = ('expense__group', 'user')
    search_fields = ('expense__description', 'user__username')

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('description', 'group', 'paid_by', 'amount', 'date', 'status')
    list_filter = ('group', 'status', 'date')
    search_fields = ('description', 'paid_by__username')

@admin.register(ImportAnomaly)
class ImportAnomalyAdmin(admin.ModelAdmin):
    list_display = ('import_batch', 'anomaly_type', 'status', 'row_reference')
    list_filter = ('status', 'anomaly_type')
    search_fields = ('description', 'row_reference')

admin.site.register(Group)
admin.site.register(GroupMembership)
admin.site.register(Settlement)
admin.site.register(ImportBatch)
