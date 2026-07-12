from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomTokenObtainPairView, RoleViewSet, PermissionViewSet, UserRoleViewSet,
    MFAMethodViewSet, PasswordResetViewSet, LoginHistoryViewSet, ChangePasswordView, RegisterViewSet
)

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'user-roles', UserRoleViewSet, basename='user-role')
router.register(r'mfa-methods', MFAMethodViewSet, basename='mfa-method')
router.register(r'password-reset', PasswordResetViewSet, basename='password-reset')
router.register(r'login-history', LoginHistoryViewSet, basename='login-history')
router.register(r'register', RegisterViewSet, basename='register')

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('', include(router.urls)),
]
