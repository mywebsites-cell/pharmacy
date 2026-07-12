import json
from channels.generic.websocket import AsyncWebsocketConsumer

class SignalingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # We expect pharmacy_id and branch_id in the URL
        self.pharmacy_id = self.scope['url_route']['kwargs']['pharmacy_id']
        self.branch_id = self.scope['url_route']['kwargs']['branch_id']
        
        # Room group name based on pharmacy_id
        # All branches in the same pharmacy join the same group so they can signal each other
        self.room_group_name = f'signaling_pharmacy_{self.pharmacy_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        
        # We expect WebRTC signaling data: 'type', 'target_branch_id', 'sender_branch_id', 'sdp', 'candidate'
        message_type = text_data_json.get('type')
        target_branch_id = text_data_json.get('target_branch_id')
        
        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'signaling_message',
                'sender_channel_name': self.channel_name, # So we don't echo back to sender
                'message': text_data_json
            }
        )

    # Receive message from room group
    async def signaling_message(self, event):
        message = event['message']
        sender_channel_name = event['sender_channel_name']

        # Don't send the message back to the sender
        if self.channel_name != sender_channel_name:
            # Only send if we are the intended target branch (or if it's a broadcast like 'discover')
            target = message.get('target_branch_id')
            if not target or target == self.branch_id:
                await self.send(text_data=json.dumps(message))
