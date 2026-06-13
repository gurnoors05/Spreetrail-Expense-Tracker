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
