from rest_framework import serializers
from django.contrib.auth.models import User
from core.models import Group, GroupMembership

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('username', 'email', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user

class GroupMembershipSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source='user', read_only=True)

    class Meta:
        model = GroupMembership
        fields = ('id', 'group', 'user', 'user_detail', 'joined_date', 'left_date')

class GroupSerializer(serializers.ModelSerializer):
    memberships = GroupMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ('id', 'name', 'created_at', 'memberships')

from core.models import Expense, ExpenseSplit
from decimal import Decimal, ROUND_HALF_EVEN

class ExpenseSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseSplit
        fields = ('id', 'user', 'share_amount')

class ExpenseSplitInputSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    value = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    split_details = ExpenseSplitInputSerializer(many=True, write_only=True)

    class Meta:
        model = Expense
        fields = ('id', 'group', 'description', 'date', 'paid_by', 'amount', 'original_amount', 'original_currency', 'exchange_rate_used', 'split_type', 'notes', 'created_at', 'is_settlement', 'status', 'superseded_by', 'splits', 'split_details')

    def validate(self, data):
        split_type = data.get('split_type')
        split_details = data.get('split_details', [])
        amount = data.get('amount')
        group = data.get('group')
        date = data.get('date')

        if not split_details:
            raise serializers.ValidationError({"split_details": "Split details are required."})

        # Validate that all users in split_details are active members of the group on 'date'
        users_in_split = [sd['user'] for sd in split_details]
        active_memberships = GroupMembership.objects.filter(
            group=group,
            user__in=users_in_split,
            joined_date__lte=date
        ).exclude(left_date__lt=date)
        
        active_user_ids = set(am.user.id for am in active_memberships)
        for user in users_in_split:
            if user.id not in active_user_ids:
                raise serializers.ValidationError({
                    "split_details": f"User {user.username} was not an active member of the group on {date}."
                })

        # Validate split logic
        if split_type == 'unequal':
            total_value = sum((sd.get('value') or Decimal('0.00')) for sd in split_details)
            if total_value != amount:
                raise serializers.ValidationError({"split_details": f"Unequal split amounts sum to {total_value}, expected {amount}."})
        elif split_type == 'percentage':
            total_pct = sum((sd.get('value') or Decimal('0.00')) for sd in split_details)
            if total_pct != Decimal('100.00'):
                raise serializers.ValidationError({"split_details": f"Percentages sum to {total_pct}%, expected 100%."})
        
        return data

    def create(self, validated_data):
        split_details = validated_data.pop('split_details')
        expense = super().create(validated_data)
        
        # Calculate exact shares and pennies
        amount = expense.amount
        split_type = expense.split_type
        
        calculated_splits = []
        
        if split_type == 'equal':
            n = len(split_details)
            base_share = (amount / Decimal(n)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
            calculated_splits = [{'user': sd['user'], 'share_amount': base_share} for sd in split_details]
        elif split_type == 'unequal':
            calculated_splits = [{'user': sd['user'], 'share_amount': sd['value']} for sd in split_details]
        elif split_type == 'percentage':
            base_shares = []
            for sd in split_details:
                pct = sd['value'] / Decimal('100.00')
                share = (amount * pct).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
                base_shares.append({'user': sd['user'], 'share_amount': share})
            calculated_splits = base_shares
        elif split_type == 'share':
            total_shares = sum((sd.get('value') or Decimal('1.00')) for sd in split_details)
            base_shares = []
            for sd in split_details:
                shares = sd.get('value') or Decimal('1.00')
                share_amt = (amount * (shares / total_shares)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
                base_shares.append({'user': sd['user'], 'share_amount': share_amt})
            calculated_splits = base_shares

        # Distribute remainder pennies if not unequal
        if split_type != 'unequal':
            total_calculated = sum(s['share_amount'] for s in calculated_splits)
            remainder = amount - total_calculated
            
            # Sort by user id to be deterministic
            calculated_splits.sort(key=lambda x: x['user'].id)
            
            if remainder != Decimal('0.00'):
                penny = Decimal('0.01') if remainder > 0 else Decimal('-0.01')
                steps = int(abs(remainder) / Decimal('0.01'))
                
                for i in range(steps):
                    calculated_splits[i % len(calculated_splits)]['share_amount'] += penny

        # Create ExpenseSplit objects
        for cs in calculated_splits:
            ExpenseSplit.objects.create(
                expense=expense,
                user=cs['user'],
                share_amount=cs['share_amount']
            )

        return expense

from core.models import ImportBatch, ImportAnomaly

class ImportAnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportAnomaly
        fields = '__all__'

class ImportBatchSerializer(serializers.ModelSerializer):
    anomalies = ImportAnomalySerializer(many=True, read_only=True)

    class Meta:
        model = ImportBatch
        fields = ('id', 'file_name', 'timestamp', 'anomalies')

from core.models import Settlement

class SettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settlement
        fields = '__all__'
