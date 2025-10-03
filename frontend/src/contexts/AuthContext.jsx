import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services/api';
import { toast } from 'react-hot-toast';

// Initial state
const initialState = {
  user: null,
  token: null,
  loading: true,
  error: null,
  isAuthenticated: false,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer function
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null,
        isAuthenticated: true,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: action.payload.error,
        isAuthenticated: false,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: null,
        isAuthenticated: false,
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        loading: false,
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Create context
const AuthContext = createContext();

// Auth provider component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on mount
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      try {
        const token = localStorage.getItem('parking_token');
        
        if (token) {
          // Validate token with server
          const response = await authService.validateToken();
          
          if (response.data.valid) {
            // Extract user info from token or make API call
            const userInfo = parseTokenPayload(token) || {
              username: 'User',
              role: 'user',
              email: 'user@example.com'
            };

            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: {
                user: userInfo,
                token: token,
              },
            });
          } else {
            // Token is invalid
            localStorage.removeItem('parking_token');
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
          }
        } else {
          // No token found
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('parking_token');
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await authService.login(credentials);
      
      if (response.data.success) {
        const { token, user } = response.data.data;
        
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token },
        });

        toast.success(`Welcome back, ${user.username}!`);
        return { success: true, user };
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: errorMessage },
      });

      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Update user function
  const updateUser = (userData) => {
    dispatch({
      type: AUTH_ACTIONS.SET_USER,
      payload: { ...state.user, ...userData },
    });
  };

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  // Check if user has specific role
  const hasRole = (role) => {
    return state.user?.role === role;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    return roles.includes(state.user?.role);
  };

  // Check if user is admin
  const isAdmin = () => {
    return state.user?.role === 'admin';
  };

  // Check if user is authenticated and has valid session
  const isValidSession = () => {
    return state.isAuthenticated && state.token && state.user;
  };

  // Get user permissions based on role
  const getPermissions = () => {
    const role = state.user?.role;
    
    const permissions = {
      user: {
        canViewDashboard: true,
        canBookSlots: true,
        canViewAnalytics: false,
        canManageUsers: false,
        canManageParkingLots: false,
        canUploadVideos: false,
        canViewSystemConfig: false,
      },
      admin: {
        canViewDashboard: true,
        canBookSlots: true,
        canViewAnalytics: true,
        canManageUsers: true,
        canManageParkingLots: true,
        canUploadVideos: true,
        canViewSystemConfig: true,
      },
      operator: {
        canViewDashboard: true,
        canBookSlots: true,
        canViewAnalytics: true,
        canManageUsers: false,
        canManageParkingLots: false,
        canUploadVideos: true,
        canViewSystemConfig: false,
      },
    };

    return permissions[role] || permissions.user;
  };

  // Context value
  const value = {
    // State
    user: state.user,
    token: state.token,
    loading: state.loading,
    error: state.error,
    isAuthenticated: state.isAuthenticated,

    // Actions
    login,
    logout,
    updateUser,
    clearError,

    // Utilities
    hasRole,
    hasAnyRole,
    isAdmin,
    isValidSession,
    getPermissions,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Utility function to parse JWT token payload
function parseTokenPayload(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
}

// Higher-order component for protected routes
export function withAuth(Component, requiredRoles = []) {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(user?.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// Hook for role-based access control
export function usePermissions() {
  const { getPermissions, hasRole, hasAnyRole, isAdmin } = useAuth();

  return {
    permissions: getPermissions(),
    hasRole,
    hasAnyRole,
    isAdmin,
  };
}

export default AuthContext;
