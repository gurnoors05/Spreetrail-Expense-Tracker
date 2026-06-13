from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, CurrentUserView, GroupViewSet, GroupMembershipViewSet, ExpenseViewSet, ImportBatchViewSet, ImportAnomalyViewSet

router = DefaultRouter()
router.register(r'groups', GroupViewSet)
router.register(r'memberships', GroupMembershipViewSet)
router.register(r'expenses', ExpenseViewSet)
router.register(r'import', ImportBatchViewSet, basename='import')
router.register(r'anomalies', ImportAnomalyViewSet, basename='anomalies')

urlpatterns = [
    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),

    # Core
    path('', include(router.urls)),
]
