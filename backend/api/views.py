from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from core.models import Group, GroupMembership
from .serializers import UserSerializer, RegisterSerializer, GroupSerializer, GroupMembershipSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

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

from rest_framework.parsers import MultiPartParser
from core.importers import CSVImporter

class ImportBatchViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def create(self, request):
        file_obj = request.FILES.get('file')
        group_id = request.data.get('group_id')
        
        if not file_obj or not group_id:
            return Response({"error": "File and group_id are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            group = Group.objects.get(id=group_id, memberships__user=request.user)
        except Group.DoesNotExist:
            return Response({"error": "Group not found or access denied."}, status=status.HTTP_404_NOT_FOUND)
            
        importer = CSVImporter(group=group, uploaded_by=request.user, file_name=file_obj.name)
        batch = importer.process_file(file_obj)
        
        return Response({"message": "File uploaded and processed.", "batch_id": batch.id}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        try:
            from core.models import ImportBatch
            batch = ImportBatch.objects.get(pk=pk, uploaded_by=request.user)
        except ImportBatch.DoesNotExist:
            return Response({"error": "Batch not found."}, status=404)
        from .serializers import ImportBatchSerializer
        serializer = ImportBatchSerializer(batch)
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
        
        if not action_taken:
            return Response({"error": "action_taken is required"}, status=400)
            
        anomaly.status = 'resolved'
        anomaly.action_taken = action_taken
        anomaly.save()
        
        # Note: In the real app, this endpoint would accept the corrected payload 
        # and trigger the creation of the Expense + ExpenseSplits. 
        # For the assignment skeleton, updating the status to resolved is the primary requirement.
        
        return Response({"message": "Anomaly resolved successfully."})
