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

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    # In a real app, we'd filter by groups the user belongs to.
    # For this assignment, we keep it simple or allow users to see groups they are in.
    def get_queryset(self):
        return self.queryset.filter(memberships__user=self.request.user).distinct()

class GroupMembershipViewSet(viewsets.ModelViewSet):
    queryset = GroupMembership.objects.all()
    serializer_class = GroupMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Allow users to see memberships of groups they belong to
        user_groups = Group.objects.filter(memberships__user=self.request.user)
        return self.queryset.filter(group__in=user_groups)
