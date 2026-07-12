import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store';

// Assuming the signaling server is running on the same host but different port/path
// Or via the SERVER_URL env
const SIGNALING_URL = 'ws://localhost:8000/ws/signaling'; 

export const useWebRTC = () => {
  const { user } = useAuthStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [remoteData, setRemoteData] = useState<any>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // Initialize Signaling WebSocket
  useEffect(() => {
    if (!user || !user.pharmacy_id || !user.branch_id) return;

    const wsUrl = `${SIGNALING_URL}/${user.pharmacy_id}/${user.branch_id}/`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebRTC] Connected to Signaling Server');
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      if (message.target_branch_id !== user.branch_id) return;

      if (!peerConnectionRef.current) {
        initPeerConnection(message.sender_branch_id);
      }

      const pc = peerConnectionRef.current!;

      if (message.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({
          type: 'answer',
          target_branch_id: message.sender_branch_id,
          sender_branch_id: user.branch_id,
          sdp: pc.localDescription
        }));
      } else if (message.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
      } else if (message.type === 'ice-candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    };

    ws.onclose = () => {
      console.log('[WebRTC] Disconnected from Signaling Server');
    };

    return () => {
      ws.close();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [user]);

  const initPeerConnection = (targetBranchId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          target_branch_id: targetBranchId,
          sender_branch_id: user.branch_id,
          candidate: event.candidate
        }));
      }
    };

    // Receive data channel
    pc.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.onmessage = (e) => {
        setRemoteData(JSON.parse(e.data));
      };
      receiveChannel.onopen = () => setConnectionStatus('connected');
      receiveChannel.onclose = () => setConnectionStatus('disconnected');
    };
  };

  const connectToBranch = async (targetBranchId: string) => {
    setConnectionStatus('connecting');
    initPeerConnection(targetBranchId);

    const pc = peerConnectionRef.current!;
    
    // Create data channel
    const dataChannel = pc.createDataChannel('sync-channel');
    dataChannelRef.current = dataChannel;
    
    dataChannel.onopen = () => setConnectionStatus('connected');
    dataChannel.onclose = () => setConnectionStatus('disconnected');
    dataChannel.onmessage = (e) => setRemoteData(JSON.parse(e.data));

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    wsRef.current?.send(JSON.stringify({
      type: 'offer',
      target_branch_id: targetBranchId,
      sender_branch_id: user.branch_id,
      sdp: pc.localDescription
    }));
  };

  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  const requestData = (queryType: string) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'query', queryType }));
    }
  };

  return {
    connectionStatus,
    connectToBranch,
    disconnect,
    remoteData,
    requestData
  };
};
