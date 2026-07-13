from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


def health_check(request):
    """Keep-alive health check endpoint. Returns 200 so Render never cold-starts."""
    return JsonResponse({"status": "ok", "service": "medicly-backend"})



def setup_superadmin(request):
    """Temporary endpoint to create the initial superadmin in production DB."""
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        u, created = User.objects.get_or_create(
            email='ahmadafridi979@gmail.com',
            defaults={'username': 'ahmadafridi979', 'first_name': 'Ahmad', 'last_name': 'Afridi'}
        )
        u.is_superuser = True
        u.is_staff = True
        u.set_password('Khankhan_11')
        u.save()
        action = 'Created' if created else 'Updated'
        return HttpResponse(f'SUCCESS! Superadmin {action}: ahmadafridi979@gmail.com')
    except Exception as e:
        return HttpResponse(f'ERROR: {e}', status=500)


def create_test_user(request):
    """Temporary endpoint to create a regular test user in production DB."""
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        u, created = User.objects.get_or_create(
            email='afridiahmad979@gmail.com',
            defaults={'username': 'afridiahmad979', 'first_name': 'Afridi', 'last_name': 'Ahmad'}
        )
        u.is_superuser = False
        u.is_staff = False
        u.set_password('Khankhan_11')
        u.save()
        action = 'Created' if created else 'Updated'
        return HttpResponse(f'SUCCESS! User {action}: afridiahmad979@gmail.com / Khankhan_11')
    except Exception as e:
        return HttpResponse(f'ERROR: {e}', status=500)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Health check (for keep-alive pings — prevents Render cold starts)
    path('health/', health_check),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # API Routes
    path('api/v1/admin/', include('apps.saas.urls')),
    path('api/v1/auth/', include('apps.authentication.urls')),
    path('api/v1/pharmacy/', include('apps.pharmacy.urls')),
    path('api/v1/inventory/', include('apps.inventory.urls')),
    path('api/v1/sales/', include('apps.sales.urls')),
    path('api/v1/purchases/', include('apps.purchases.urls')),
    path('api/v1/prescriptions/', include('apps.prescriptions.urls')),
    path('api/v1/customers/', include('apps.customers.urls')),
    path('api/v1/accounting/', include('apps.accounting.urls')),
    path('api/v1/delivery/', include('apps.delivery.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/analytics/', include('apps.analytics.urls')),
    
    # Temporary Setup Endpoints
    path('api/v1/setup-superadmin/', setup_superadmin),
    path('api/v1/create-test-user/', create_test_user),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
