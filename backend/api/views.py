from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from core.models import Group, GroupMembership
from .serializers import UserSerializer, RegisterSerializer, GroupSerializer, GroupMembershipSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

class UserListView(generics.ListAPIView):
    """Returns all registered users so the frontend can show a username dropdown."""
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

from rest_framework.decorators import action
from core.services import calculate_group_balances

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(memberships__user=self.request.user).distinct()

    def perform_create(self, serializer):
        import datetime
        group = serializer.save()
        # Auto-enroll the creator as an active member from today
        GroupMembership.objects.create(
            group=group,
            user=self.request.user,
            joined_date=datetime.date.today(),
        )

    @action(detail=True, methods=['get'])
    def balances(self, request, pk=None):
        group = self.get_object()
        balances = calculate_group_balances(group.id)
        return Response(balances)

class GroupMembershipViewSet(viewsets.ModelViewSet):
    queryset = GroupMembership.objects.all()
    serializer_class = GroupMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Allow users to see memberships of groups they belong to
        user_groups = Group.objects.filter(memberships__user=self.request.user)
        return self.queryset.filter(group__in=user_groups)

from core.models import Expense
from .serializers import ExpenseSerializer

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_groups = Group.objects.filter(memberships__user=self.request.user)
        return self.queryset.filter(group__in=user_groups)

from core.models import ImportBatch
from .serializers import ImportBatchSerializer

class ImportBatchViewSet(viewsets.ModelViewSet):
    queryset = ImportBatch.objects.all().order_by('-timestamp')
    serializer_class = ImportBatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_parsers(self):
        if self.action == 'create':
            from rest_framework.parsers import MultiPartParser
            return [MultiPartParser()]
        return super().get_parsers()

    def get_queryset(self):
        from core.models import Group
        user_groups = Group.objects.filter(memberships__user=self.request.user)
        group_id = self.request.query_params.get('group')
        qs = self.queryset.filter(group__in=user_groups)
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        group_id = request.data.get('group_id')
        
        if not file_obj or not group_id:
            return Response({"error": "File and group_id are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            from core.models import Group
            group = Group.objects.get(id=group_id, memberships__user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found or access denied."}, status=status.HTTP_404_NOT_FOUND)
            
        from core.importers import CSVImporter
        importer = CSVImporter(group=group, uploaded_by=request.user, file_name=file_obj.name)
        batch = importer.process_file(file_obj)
        
        return Response({"message": "File uploaded and processed.", "batch_id": batch.id}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        batch = self.get_object()
        serializer = self.get_serializer(batch)
        return Response(serializer.data)

from core.models import ImportAnomaly
from .serializers import ImportAnomalySerializer

class ImportAnomalyViewSet(viewsets.ModelViewSet):
    queryset = ImportAnomaly.objects.all()
    serializer_class = ImportAnomalySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(import_batch__uploaded_by=self.request.user)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        anomaly = self.get_object()
        action_taken = request.data.get('action_taken')
        resolution_data = request.data.get('resolution_data', {})
        
        if not action_taken:
            return Response({"error": "action_taken is required"}, status=400)
            
        row = anomaly.raw_data
        if not row:
            return Response({"error": "Cannot resolve this anomaly: original row data is missing."}, status=400)

        # 1. Apply structural changes to the row based on anomaly type
        from django.contrib.auth.models import User
        if anomaly.anomaly_type == 'Missing/Unknown Payer':
            payer_id = resolution_data.get('payer_id')
            if not payer_id: return Response({"error": "payer_id required"}, status=400)
            try:
                user = User.objects.get(id=payer_id)
                row['paid_by'] = user.username
            except User.DoesNotExist:
                return Response({"error": "Payer not found"}, status=400)
                
        elif anomaly.anomaly_type == 'Percentage Sum Mismatch' or anomaly.anomaly_type == 'Validation Error':
            if resolution_data.get('action') == 'equalize':
                row['split_type'] = 'equal'
                row['split_details'] = ''
            elif resolution_data.get('split_details'):
                row['split_details'] = resolution_data.get('split_details')
                
        elif anomaly.anomaly_type == 'Non-member in Split':
            reassigned_user_id = resolution_data.get('reassigned_user_id')
            target_name = resolution_data.get('target_name')
            if reassigned_user_id and target_name:
                try:
                    user = User.objects.get(id=reassigned_user_id)
                    row['split_with'] = row['split_with'].replace(target_name, user.username)
                    if row.get('split_details'):
                        row['split_details'] = row['split_details'].replace(target_name, user.username)
                except User.DoesNotExist:
                    return Response({"error": "Target user not found"}, status=400)
                    
        elif anomaly.anomaly_type == 'Conflicting Duplicate':
            if resolution_data.get('action') == 'discard':
                anomaly.status = 'resolved'
                anomaly.action_taken = "Discarded duplicate"
                anomaly.save()
                return Response({"message": "Anomaly resolved successfully."})
            if resolution_data.get('action') == 'keep':
                row['description'] = row.get('description', '') + ' (Confirmed)'

        elif anomaly.anomaly_type == 'Split Details Mismatch':
            if resolution_data.get('action') == 'force_equal':
                row['split_type'] = 'equal'
                row['split_details'] = ''

        # 2. Re-run the importer processing for this row
        from core.importers import CSVImporter
        from core.models import ImportAnomaly
        importer = CSVImporter(group=anomaly.import_batch.group, uploaded_by=request.user, file_name=anomaly.import_batch.file_name)
        
        row_num = int(anomaly.row_reference.replace('Row ', '')) if 'Row ' in anomaly.row_reference else 0
        
        # We process the row again
        importer.process_row(anomaly.import_batch, row_num, row)
        
        # Check if the exact same anomaly was re-created
        new_anomaly = ImportAnomaly.objects.filter(import_batch=anomaly.import_batch, row_reference=anomaly.row_reference, anomaly_type=anomaly.anomaly_type, status='pending').exclude(id=anomaly.id).first()
        if new_anomaly:
            new_anomaly.delete()
            return Response({"error": f"Resolution failed. The data still triggered '{anomaly.anomaly_type}' anomaly."}, status=400)
            
        anomaly.status = 'resolved'
        anomaly.action_taken = action_taken
        anomaly.save()
        return Response({"message": "Anomaly resolved successfully."})

from core.models import Settlement
from .serializers import SettlementSerializer

class SettlementViewSet(viewsets.ModelViewSet):
    queryset = Settlement.objects.all()
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_groups = Group.objects.filter(memberships__user=self.request.user)
        return self.queryset.filter(group__in=user_groups)
