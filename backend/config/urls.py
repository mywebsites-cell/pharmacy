from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    
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
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
