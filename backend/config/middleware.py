import json
import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from rest_framework import status

logger = logging.getLogger(__name__)


class CustomHeaderMiddleware(MiddlewareMixin):
    """Add custom security headers to all responses."""
    
    def process_response(self, request, response):
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response


class AuditLoggingMiddleware(MiddlewareMixin):
    """Log all API requests for audit purposes."""
    
    def process_request(self, request):
        request.audit_start_time = request.META.get('HTTP_X_REQUEST_ID', 'no-id')
        return None
    
    def process_response(self, request, response):
        # Log sensitive operations
        if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            log_data = {
                'method': request.method,
                'path': request.path,
                'user': str(request.user),
                'status': response.status_code,
                'ip_address': self.get_client_ip(request),
            }
            logger.info(f"Audit: {json.dumps(log_data)}")
        return response
    
    @staticmethod
    def get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
