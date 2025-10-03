import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('parking_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;
    
    if (response) {
      // Server responded with error status
      const { status, data } = response;
      
      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('parking_token');
          window.location.href = '/login';
          toast.error('Session expired. Please login again.');
          break;
        case 403:
          toast.error('Access denied. Insufficient permissions.');
          break;
        case 404:
          toast.error('Resource not found.');
          break;
        case 429:
          toast.error('Too many requests. Please try again later.');
          break;
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        default:
          toast.error(data?.error || 'An unexpected error occurred.');
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.');
    } else {
      // Other error
      toast.error('An unexpected error occurred.');
    }
    
    return Promise.reject(error);
  }
);

// Authentication service
export const authService = {
  async login(credentials) {
    // Use the credentials as provided (username and password)
    const loginData = {
      username: credentials.username,
      password: credentials.password
    };
    const response = await api.post('/admin/login', loginData);
    if (response.data.success && response.data.data.token) {
      localStorage.setItem('parking_token', response.data.data.token);
    }
    return response;
  },

  async logout() {
    localStorage.removeItem('parking_token');
    return Promise.resolve();
  },

  async validateToken() {
    const token = localStorage.getItem('parking_token');
    if (!token) {
      return { data: { valid: false } };
    }
    
    try {
      const response = await api.get('/admin/configuration');
      return { data: { valid: true, user: response.data } };
    } catch (error) {
      return { data: { valid: false } };
    }
  },

  async createUser(userData) {
    return api.post('/admin/create-user', userData);
  }
};

// Parking service
export const parkingService = {
  async getAllParkingLots() {
    return api.get('/parking/lots');
  },

  async getParkingStatus(lotId) {
    return api.get(`/parking/status/${lotId}`);
  },

  async getAvailableSlots(lotId) {
    return api.get(`/parking/available-slots/${lotId}`);
  },

  async getOccupiedSlots(lotId) {
    return api.get(`/parking/occupied-slots/${lotId}`);
  },

  async bookSlot(slotData) {
    return api.post('/parking/book-slot', slotData);
  },

  async releaseSlot(slotId) {
    return api.post(`/parking/release-slot/${slotId}`);
  },

  async updateSlotStatus(slotId, statusData) {
    return api.put(`/parking/slot-status/${slotId}`, statusData);
  },

  async bulkUpdateSlots(lotId, updates) {
    return api.put(`/parking/bulk-update-slots/${lotId}`, { slot_updates: updates });
  },

  async getSlotDetails(slotId) {
    return api.get(`/parking/slot-details/${slotId}`);
  },

  async updateSlotDurations(lotId) {
    return api.post(`/parking/update-durations/${lotId}`);
  }
};

// Video service
export const videoService = {
  async uploadVideo(formData, onProgress) {
    return api.post('/video/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });
  },

  async getAnalysisResults(analysisId) {
    return api.get(`/video/analysis/${analysisId}`);
  },

  async getLotAnalyses(lotId, limit = 20) {
    return api.get(`/video/lot-analyses/${lotId}?limit=${limit}`);
  },

  async getProcessingQueue() {
    return api.get('/video/processing-queue');
  },

  async cancelAnalysis(analysisId) {
    return api.post(`/video/cancel-analysis/${analysisId}`);
  },

  async getRecentAnalyses(limit = 20) {
    return api.get(`/video/recent-analyses?limit=${limit}`);
  },

  async deleteAnalysis(analysisId) {
    return api.delete(`/video/analysis/${analysisId}`);
  },

  async testVideoProcessing(lotId) {
    return api.post(`/video/test-processing/${lotId}`);
  }
};

// Admin service
export const adminService = {
  async createParkingLot(lotData) {
    return api.post('/admin/parking-lots', lotData);
  },

  async updateParkingLot(lotId, lotData) {
    return api.put(`/admin/parking-lots/${lotId}`, lotData);
  },

  async deleteParkingLot(lotId) {
    return api.delete(`/admin/parking-lots/${lotId}`);
  },

  async getSystemAnalytics(days = 7) {
    return api.get(`/admin/analytics/system?days=${days}`);
  },

  async getParkingLotAnalytics(lotId, days = 7) {
    return api.get(`/admin/analytics/parking-lot/${lotId}?days=${days}`);
  },

  async getSystemConfiguration() {
    return api.get('/admin/configuration');
  },

  async updateSystemConfiguration(config) {
    return api.put('/admin/configuration', { configuration: config });
  },

  async getAllUsers() {
    return api.get('/admin/users');
  },

  async updateUser(userId, userData) {
    return api.put(`/admin/users/${userId}`, userData);
  },

  async deleteUser(userId) {
    return api.delete(`/admin/users/${userId}`);
  },

  async generateReport(type = 'summary', days = 30) {
    return api.get(`/admin/reports?type=${type}&days=${days}`);
  }
};

// Chatbot service
export const chatbotService = {
  async sendMessage(message, context = null) {
    return api.post('/chatbot/query', {
      message,
      context,
      timestamp: new Date().toISOString()
    });
  },

  async getConversationHistory(sessionId) {
    return api.get(`/chatbot/history/${sessionId}`);
  },

  async getSuggestions(intent) {
    return api.get(`/chatbot/suggestions?intent=${intent}`);
  }
};

// Utility functions
export const apiUtils = {
  // Format error message from API response
  formatError(error) {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },

  // Check if error is network related
  isNetworkError(error) {
    return !error.response && error.request;
  },

  // Check if error is server error (5xx)
  isServerError(error) {
    return error.response?.status >= 500;
  },

  // Check if error is client error (4xx)
  isClientError(error) {
    return error.response?.status >= 400 && error.response?.status < 500;
  },

  // Retry function for failed requests
  async retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry client errors (4xx)
        if (this.isClientError(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError;
  },

  // Cancel token for request cancellation
  createCancelToken() {
    return axios.CancelToken.source();
  },

  // Check if request was cancelled
  isCancel(error) {
    return axios.isCancel(error);
  }
};

// Health check service
export const healthService = {
  async checkHealth() {
    return api.get('/health');
  },

  async checkDatabaseConnection() {
    return api.get('/health/database');
  },

  async checkAIServices() {
    return api.get('/health/ai-services');
  }
};

// Export the configured axios instance as default
export default api;
