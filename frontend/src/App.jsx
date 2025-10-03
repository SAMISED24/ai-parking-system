import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Import pages and components
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import UserPage from './pages/UserPage';
import LoadingSpinner from './components/LoadingSpinner';

// Import services
import { authService } from './services/api';
import { websocketService } from './services/websocket';

// Import context providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ParkingProvider } from './contexts/ParkingContext';

function App() {
  return (
    <AuthProvider>
      <ParkingProvider>
        <AppContent />
      </ParkingProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading, login, logout } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Initialize the application
    const initializeApp = async () => {
      try {
        // Check if user is already logged in
        const token = localStorage.getItem('parking_token');
        if (token) {
          // Validate token and get user info
          try {
            const response = await authService.validateToken();
            if (response.data.valid) {
              // Token is valid, user is already logged in
              console.log('User already authenticated');
            } else {
              // Token is invalid, remove it
              localStorage.removeItem('parking_token');
            }
          } catch (error) {
            console.error('Token validation failed:', error);
            localStorage.removeItem('parking_token');
          }
        }

        // Initialize WebSocket connection if user is authenticated
        if (user) {
          websocketService.connect();
          
          // Set up global WebSocket event handlers
          websocketService.on('connect', () => {
            console.log('Connected to parking system');
            toast.success('Connected to parking system');
          });

          websocketService.on('disconnect', () => {
            console.log('Disconnected from parking system');
            toast.error('Disconnected from parking system');
          });

          websocketService.on('error', (error) => {
            console.error('WebSocket error:', error);
            toast.error('Connection error occurred');
          });
        }

      } catch (error) {
        console.error('App initialization error:', error);
        toast.error('Failed to initialize application');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
    };
  }, [user]);

  // Show loading screen during initialization
  if (loading || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600 text-lg">
            Initializing AI Parking System...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            user ? (
              <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
            ) : (
              <LoginPage />
            )
          } 
        />

        {/* Protected routes */}
        <Route 
          path="/admin/*" 
          element={
            user && user.role === 'admin' ? (
              <AdminPage />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/dashboard/*" 
          element={
            user ? (
              <UserPage />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* Default redirects */}
        <Route 
          path="/" 
          element={
            user ? (
              <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* 404 page */}
        <Route 
          path="*" 
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 text-gray-400">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                          d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">Page not found</p>
                <button
                  onClick={() => window.history.back()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          } 
        />
      </Routes>
    </div>
  );
}

export default App;
