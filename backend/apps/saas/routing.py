from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/signaling/(?P<pharmacy_id>[\w-]+)/(?P<branch_id>[\w-]+)/$', consumers.SignalingConsumer.as_asgi()),
]
