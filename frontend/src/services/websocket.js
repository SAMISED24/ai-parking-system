import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventHandlers = new Map();
    this.currentParkingLot = null;
  }

  // Connect to WebSocket server
  connect(url = null) {
    if (this.socket && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    const socketUrl = url || import.meta.env.VITE_WS_URL || window.location.origin;
    
    console.log('Connecting to WebSocket:', socketUrl);

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventHandlers();
  }

  // Setup default event handlers
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Rejoin parking lot if previously connected
      if (this.currentParkingLot) {
        this.joinParkingLot(this.currentParkingLot);
      }

      // Emit custom connect event
      this.emit('connected', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔥 WebSocket connection error:', error);
      this.isConnected = false;
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        toast.error('Failed to connect to real-time updates');
      }
      
      this.emit('connection_error', { error, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
      toast.success('Reconnected to real-time updates');
      this.emit('reconnected', { attempts: attemptNumber });
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔥 WebSocket reconnection error:', error);
      this.emit('reconnect_error', { error });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('💀 WebSocket reconnection failed');
      toast.error('Failed to reconnect to real-time updates');
      this.emit('reconnect_failed');
    });

    // Parking-specific events
    this.socket.on('slot-status-changed', (data) => {
      console.log('🚗 Slot status changed:', data);
      this.emit('slot-status-changed', data);
    });

    this.socket.on('slot-durations-updated', (data) => {
      console.log('⏱️ Slot durations updated:', data);
      this.emit('slot-durations-updated', data);
    });

    this.socket.on('slot-booked', (data) => {
      console.log('📝 Slot booked:', data);
      this.emit('slot-booked', data);
      toast.success(`Slot ${data.slot_number} has been booked`);
    });

    this.socket.on('slot-released', (data) => {
      console.log('🚪 Slot released:', data);
      this.emit('slot-released', data);
      toast.success(`Slot ${data.slot_number} has been released`);
    });

    // Video processing events
    this.socket.on('video-processing-started', (data) => {
      console.log('🎬 Video processing started:', data);
      this.emit('video-processing-started', data);
      toast.success('Video processing started');
    });

    this.socket.on('video-processing-completed', (data) => {
      console.log('✅ Video processing completed:', data);
      this.emit('video-processing-completed', data);
      toast.success('Video processing completed successfully');
    });

    this.socket.on('video-processing-failed', (data) => {
      console.log('❌ Video processing failed:', data);
      this.emit('video-processing-failed', data);
      toast.error(`Video processing failed: ${data.error}`);
    });

    this.socket.on('video-processing-cancelled', (data) => {
      console.log('🚫 Video processing cancelled:', data);
      this.emit('video-processing-cancelled', data);
      toast.info('Video processing was cancelled');
    });

    // System events
    this.socket.on('system-alert', (data) => {
      console.log('🚨 System alert:', data);
      this.emit('system-alert', data);
      
      switch (data.level) {
        case 'error':
          toast.error(data.message);
          break;
        case 'warning':
          toast.error(data.message, { icon: '⚠️' });
          break;
        case 'info':
          toast(data.message, { icon: 'ℹ️' });
          break;
        default:
          toast(data.message);
      }
    });

    this.socket.on('analytics-updated', (data) => {
      console.log('📊 Analytics updated:', data);
      this.emit('analytics-updated', data);
    });
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting WebSocket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentParkingLot = null;
    }
  }

  // Join a parking lot room for real-time updates
  joinParkingLot(lotId) {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot join parking lot: WebSocket not connected');
      return;
    }

    console.log('Joining parking lot:', lotId);
    this.socket.emit('join-parking-lot', lotId);
    this.currentParkingLot = lotId;
  }

  // Leave a parking lot room
  leaveParkingLot(lotId) {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot leave parking lot: WebSocket not connected');
      return;
    }

    console.log('Leaving parking lot:', lotId);
    this.socket.emit('leave-parking-lot', lotId);
    
    if (this.currentParkingLot === lotId) {
      this.currentParkingLot = null;
    }
  }

  // Subscribe to events
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);

    // If socket is already connected, also listen on socket
    if (this.socket) {
      this.socket.on(event, handler);
    }
  }

  // Unsubscribe from events
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }

    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  // Emit custom events to registered handlers
  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Send message to server
  send(event, data) {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot send message: WebSocket not connected');
      return false;
    }

    this.socket.emit(event, data);
    return true;
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id || null,
      currentParkingLot: this.currentParkingLot,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // Force reconnection
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }

  // Utility methods for common parking operations
  requestSlotUpdate(lotId) {
    return this.send('request-slot-update', { lotId });
  }

  requestAnalyticsUpdate(lotId) {
    return this.send('request-analytics-update', { lotId });
  }

  // Heartbeat to keep connection alive
  startHeartbeat(interval = 30000) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, interval);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Clean up all event handlers
  removeAllListeners() {
    this.eventHandlers.clear();
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// React hook for using WebSocket in components
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(websocketService.isConnected);
  const [connectionStatus, setConnectionStatus] = useState(websocketService.getStatus());

  useEffect(() => {
    const updateConnectionStatus = () => {
      const status = websocketService.getStatus();
      setIsConnected(status.connected);
      setConnectionStatus(status);
    };

    // Listen for connection events
    websocketService.on('connected', updateConnectionStatus);
    websocketService.on('disconnected', updateConnectionStatus);
    websocketService.on('reconnected', updateConnectionStatus);

    // Initial status update
    updateConnectionStatus();

    return () => {
      websocketService.off('connected', updateConnectionStatus);
      websocketService.off('disconnected', updateConnectionStatus);
      websocketService.off('reconnected', updateConnectionStatus);
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    connect: websocketService.connect.bind(websocketService),
    disconnect: websocketService.disconnect.bind(websocketService),
    joinParkingLot: websocketService.joinParkingLot.bind(websocketService),
    leaveParkingLot: websocketService.leaveParkingLot.bind(websocketService),
    on: websocketService.on.bind(websocketService),
    off: websocketService.off.bind(websocketService),
    send: websocketService.send.bind(websocketService),
    reconnect: websocketService.reconnect.bind(websocketService),
  };
};

export { websocketService };
export default websocketService;
