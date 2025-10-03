import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { parkingService } from '../services/api';
import { websocketService } from '../services/websocket';
import { toast } from 'react-hot-toast';

// Initial state
const initialState = {
  parkingLots: [],
  currentLot: null,
  slots: [],
  loading: false,
  error: null,
  lastUpdated: null,
  statistics: {
    totalSlots: 0,
    occupiedSlots: 0,
    availableSlots: 0,
    occupancyRate: 0,
  },
  realTimeUpdates: true,
};

// Action types
const PARKING_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_PARKING_LOTS: 'SET_PARKING_LOTS',
  SET_CURRENT_LOT: 'SET_CURRENT_LOT',
  SET_SLOTS: 'SET_SLOTS',
  UPDATE_SLOT: 'UPDATE_SLOT',
  UPDATE_MULTIPLE_SLOTS: 'UPDATE_MULTIPLE_SLOTS',
  SET_STATISTICS: 'SET_STATISTICS',
  SET_LAST_UPDATED: 'SET_LAST_UPDATED',
  TOGGLE_REAL_TIME: 'TOGGLE_REAL_TIME',
};

// Reducer function
function parkingReducer(state, action) {
  switch (action.type) {
    case PARKING_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case PARKING_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case PARKING_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case PARKING_ACTIONS.SET_PARKING_LOTS:
      return {
        ...state,
        parkingLots: action.payload,
        loading: false,
        error: null,
      };

    case PARKING_ACTIONS.SET_CURRENT_LOT:
      return {
        ...state,
        currentLot: action.payload,
      };

    case PARKING_ACTIONS.SET_SLOTS:
      return {
        ...state,
        slots: action.payload,
        loading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      };

    case PARKING_ACTIONS.UPDATE_SLOT:
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.payload.id
            ? { ...slot, ...action.payload }
            : slot
        ),
        lastUpdated: new Date().toISOString(),
      };

    case PARKING_ACTIONS.UPDATE_MULTIPLE_SLOTS:
      return {
        ...state,
        slots: state.slots.map(slot => {
          const update = action.payload.find(u => u.id === slot.id);
          return update ? { ...slot, ...update } : slot;
        }),
        lastUpdated: new Date().toISOString(),
      };

    case PARKING_ACTIONS.SET_STATISTICS:
      return {
        ...state,
        statistics: action.payload,
      };

    case PARKING_ACTIONS.SET_LAST_UPDATED:
      return {
        ...state,
        lastUpdated: action.payload,
      };

    case PARKING_ACTIONS.TOGGLE_REAL_TIME:
      return {
        ...state,
        realTimeUpdates: action.payload,
      };

    default:
      return state;
  }
}

// Create context
const ParkingContext = createContext();

// Parking provider component
export function ParkingProvider({ children }) {
  const [state, dispatch] = useReducer(parkingReducer, initialState);

  // Load parking lots
  const loadParkingLots = useCallback(async () => {
    dispatch({ type: PARKING_ACTIONS.SET_LOADING, payload: true });

    try {
      const response = await parkingService.getAllParkingLots();
      
      if (response.data.success) {
        dispatch({
          type: PARKING_ACTIONS.SET_PARKING_LOTS,
          payload: response.data.data.parking_lots,
        });
      } else {
        throw new Error(response.data.error || 'Failed to load parking lots');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load parking lots';
      dispatch({
        type: PARKING_ACTIONS.SET_ERROR,
        payload: errorMessage,
      });
      toast.error(errorMessage);
    }
  }, []);

  // Load parking status for a specific lot
  const loadParkingStatus = useCallback(async (lotId) => {
    if (!lotId) return;

    dispatch({ type: PARKING_ACTIONS.SET_LOADING, payload: true });

    try {
      const response = await parkingService.getParkingStatus(lotId);
      
      if (response.data.success) {
        const { parking_lot, slots, statistics } = response.data.data;
        
        dispatch({ type: PARKING_ACTIONS.SET_CURRENT_LOT, payload: parking_lot });
        dispatch({ type: PARKING_ACTIONS.SET_SLOTS, payload: slots });
        dispatch({ type: PARKING_ACTIONS.SET_STATISTICS, payload: statistics });
      } else {
        throw new Error(response.data.error || 'Failed to load parking status');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load parking status';
      dispatch({
        type: PARKING_ACTIONS.SET_ERROR,
        payload: errorMessage,
      });
      toast.error(errorMessage);
    }
  }, []);

  // Book a parking slot
  const bookSlot = useCallback(async (slotId, estimatedDuration = 3600) => {
    try {
      const response = await parkingService.bookSlot({
        slot_id: slotId,
        estimated_duration: estimatedDuration,
      });

      if (response.data.success) {
        const updatedSlot = response.data.data.slot;
        dispatch({
          type: PARKING_ACTIONS.UPDATE_SLOT,
          payload: updatedSlot,
        });
        
        // Update statistics
        updateStatistics();
        
        toast.success(`Slot ${updatedSlot.slot_number} booked successfully`);
        return { success: true, slot: updatedSlot };
      } else {
        throw new Error(response.data.error || 'Failed to book slot');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to book slot';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Release a parking slot
  const releaseSlot = useCallback(async (slotId) => {
    try {
      const response = await parkingService.releaseSlot(slotId);

      if (response.data.success) {
        const updatedSlot = response.data.data.slot;
        dispatch({
          type: PARKING_ACTIONS.UPDATE_SLOT,
          payload: updatedSlot,
        });
        
        // Update statistics
        updateStatistics();
        
        toast.success(`Slot ${updatedSlot.slot_number} released successfully`);
        return { success: true, slot: updatedSlot };
      } else {
        throw new Error(response.data.error || 'Failed to release slot');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to release slot';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Update slot status (for admin/system use)
  const updateSlotStatus = useCallback(async (slotId, isOccupied, predictedVacancySeconds = 0) => {
    try {
      const response = await parkingService.updateSlotStatus(slotId, {
        is_occupied: isOccupied,
        predicted_vacancy_seconds: predictedVacancySeconds,
      });

      if (response.data.success) {
        const updatedSlot = response.data.data.slot;
        dispatch({
          type: PARKING_ACTIONS.UPDATE_SLOT,
          payload: updatedSlot,
        });
        
        updateStatistics();
        return { success: true, slot: updatedSlot };
      } else {
        throw new Error(response.data.error || 'Failed to update slot status');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update slot status';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Get available slots
  const getAvailableSlots = useCallback(() => {
    return state.slots.filter(slot => !slot.is_occupied);
  }, [state.slots]);

  // Get occupied slots
  const getOccupiedSlots = useCallback(() => {
    return state.slots.filter(slot => slot.is_occupied);
  }, [state.slots]);

  // Get slot by ID
  const getSlotById = useCallback((slotId) => {
    return state.slots.find(slot => slot.id === slotId);
  }, [state.slots]);

  // Get slot by number
  const getSlotByNumber = useCallback((slotNumber) => {
    return state.slots.find(slot => slot.slot_number === slotNumber);
  }, [state.slots]);

  // Update statistics based on current slots
  const updateStatistics = useCallback(() => {
    const totalSlots = state.slots.length;
    const occupiedSlots = state.slots.filter(slot => slot.is_occupied).length;
    const availableSlots = totalSlots - occupiedSlots;
    const occupancyRate = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

    dispatch({
      type: PARKING_ACTIONS.SET_STATISTICS,
      payload: {
        totalSlots,
        occupiedSlots,
        availableSlots,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
      },
    });
  }, [state.slots]);

  // Toggle real-time updates
  const toggleRealTimeUpdates = useCallback((enabled) => {
    dispatch({
      type: PARKING_ACTIONS.TOGGLE_REAL_TIME,
      payload: enabled,
    });

    if (enabled && state.currentLot) {
      websocketService.joinParkingLot(state.currentLot.id);
    } else if (state.currentLot) {
      websocketService.leaveParkingLot(state.currentLot.id);
    }
  }, [state.currentLot]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: PARKING_ACTIONS.CLEAR_ERROR });
  }, []);

  // Refresh current lot data
  const refreshData = useCallback(() => {
    if (state.currentLot) {
      loadParkingStatus(state.currentLot.id);
    } else {
      loadParkingLots();
    }
  }, [state.currentLot, loadParkingStatus, loadParkingLots]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!state.realTimeUpdates) return;

    const handleSlotStatusChanged = (data) => {
      const { slot_id, is_occupied, predicted_vacancy_seconds, slot_number } = data;
      
      dispatch({
        type: PARKING_ACTIONS.UPDATE_SLOT,
        payload: {
          id: slot_id,
          is_occupied,
          predicted_vacancy_seconds,
          last_status_change: new Date().toISOString(),
        },
      });

      // Show notification for significant changes
      if (data.source !== 'duration_update') {
        const status = is_occupied ? 'occupied' : 'available';
        toast.success(`Slot ${slot_number} is now ${status}`, {
          duration: 2000,
          icon: is_occupied ? '🚗' : '🅿️',
        });
      }
    };

    const handleSlotDurationsUpdated = (data) => {
      const { updated_slots } = data;
      
      if (updated_slots && updated_slots.length > 0) {
        dispatch({
          type: PARKING_ACTIONS.UPDATE_MULTIPLE_SLOTS,
          payload: updated_slots.map(slot => ({
            id: slot.slot_id,
            current_duration: slot.current_duration,
            predicted_vacancy_seconds: slot.predicted_vacancy_seconds,
          })),
        });
      }
    };

    // Subscribe to WebSocket events
    websocketService.on('slot-status-changed', handleSlotStatusChanged);
    websocketService.on('slot-durations-updated', handleSlotDurationsUpdated);

    // Join current parking lot room if available
    if (state.currentLot) {
      websocketService.joinParkingLot(state.currentLot.id);
    }

    // Cleanup
    return () => {
      websocketService.off('slot-status-changed', handleSlotStatusChanged);
      websocketService.off('slot-durations-updated', handleSlotDurationsUpdated);
      
      if (state.currentLot) {
        websocketService.leaveParkingLot(state.currentLot.id);
      }
    };
  }, [state.realTimeUpdates, state.currentLot]);

  // Update statistics when slots change
  useEffect(() => {
    updateStatistics();
  }, [state.slots, updateStatistics]);

  // Load parking lots on mount
  useEffect(() => {
    loadParkingLots();
  }, [loadParkingLots]);

  // Context value
  const value = {
    // State
    parkingLots: state.parkingLots,
    currentLot: state.currentLot,
    slots: state.slots,
    loading: state.loading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    statistics: state.statistics,
    realTimeUpdates: state.realTimeUpdates,

    // Actions
    loadParkingLots,
    loadParkingStatus,
    bookSlot,
    releaseSlot,
    updateSlotStatus,
    toggleRealTimeUpdates,
    clearError,
    refreshData,

    // Utilities
    getAvailableSlots,
    getOccupiedSlots,
    getSlotById,
    getSlotByNumber,
  };

  return (
    <ParkingContext.Provider value={value}>
      {children}
    </ParkingContext.Provider>
  );
}

// Custom hook to use parking context
export function useParking() {
  const context = useContext(ParkingContext);
  
  if (!context) {
    throw new Error('useParking must be used within a ParkingProvider');
  }
  
  return context;
}

// Hook for slot-specific operations
export function useSlot(slotId) {
  const { getSlotById, bookSlot, releaseSlot, updateSlotStatus } = useParking();
  const slot = getSlotById(slotId);

  return {
    slot,
    bookSlot: (duration) => bookSlot(slotId, duration),
    releaseSlot: () => releaseSlot(slotId),
    updateStatus: (isOccupied, predictedVacancy) => 
      updateSlotStatus(slotId, isOccupied, predictedVacancy),
  };
}

// Hook for parking lot statistics
export function useParkingStatistics() {
  const { statistics, slots, currentLot } = useParking();

  const getDetailedStatistics = useCallback(() => {
    if (!slots.length) return statistics;

    const now = new Date();
    const recentlyChanged = slots.filter(slot => {
      if (!slot.last_status_change) return false;
      const changeTime = new Date(slot.last_status_change);
      return (now - changeTime) < 300000; // Last 5 minutes
    });

    const longTermParked = slots.filter(slot => {
      return slot.is_occupied && slot.current_duration > 7200; // More than 2 hours
    });

    const soonToBeVacant = slots.filter(slot => {
      return slot.is_occupied && slot.predicted_vacancy_seconds > 0 && slot.predicted_vacancy_seconds < 1800; // Less than 30 minutes
    });

    return {
      ...statistics,
      recentlyChanged: recentlyChanged.length,
      longTermParked: longTermParked.length,
      soonToBeVacant: soonToBeVacant.length,
      averageDuration: slots
        .filter(slot => slot.is_occupied && slot.current_duration > 0)
        .reduce((sum, slot) => sum + slot.current_duration, 0) / 
        Math.max(1, slots.filter(slot => slot.is_occupied).length),
    };
  }, [statistics, slots]);

  return {
    ...statistics,
    getDetailedStatistics,
    currentLot,
  };
}

export default ParkingContext;
