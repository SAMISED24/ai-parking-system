/** @jsxImportSource react */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ClockIcon, 
  MapPinIcon, 
  ChartBarIcon,
  ArrowPathIcon as RefreshIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { useParking } from '../contexts/ParkingContext';
import { useWebSocket } from '../services/websocket';
import ParkingSlotGrid from './ParkingSlotGrid';
import Chatbot from './Chatbot';
import LoadingSpinner from './LoadingSpinner';
import { formatTime, formatDuration } from '../utils/dateUtils';
import { toast } from 'react-hot-toast';

const UserDashboard = ({ selectedLotId, parkingLots, onLotChange }) => {
  const { 
    currentLot, 
    slots, 
    statistics, 
    loading, 
    lastUpdated,
    loadParkingStatus,
    refreshData,
    bookSlot
  } = useParking();
  
  const { isConnected } = useWebSocket();
  const [showChatbot, setShowChatbot] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load parking status when lot changes
  useEffect(() => {
    if (selectedLotId) {
      loadParkingStatus(selectedLotId);
    }
  }, [selectedLotId, loadParkingStatus]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle slot selection
  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
  };

  // Get available slots with predictions
  const availableSlotsWithPredictions = slots
    .filter(slot => !slot.is_occupied)
    .sort((a, b) => a.slot_number - b.slot_number);

  // Get occupied slots with durations
  const occupiedSlotsWithDurations = slots
    .filter(slot => slot.is_occupied)
    .sort((a, b) => b.current_duration - a.current_duration);

  // Get soon-to-be-vacant slots
  const soonVacantSlots = slots
    .filter(slot => slot.is_occupied && slot.predicted_vacancy_seconds > 0 && slot.predicted_vacancy_seconds < 1800)
    .sort((a, b) => a.predicted_vacancy_seconds - b.predicted_vacancy_seconds);

  if (loading && !currentLot) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" text="Loading parking data..." />
      </div>
    );
  }

  if (!selectedLotId) {
    return (
      <div className="text-center py-12">
        <MapPinIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Select a Parking Lot
        </h3>
        <p className="text-gray-600 mb-6">
          Choose a parking lot to view available spaces and real-time status.
        </p>
        {parkingLots.length > 0 && (
          <div className="max-w-sm mx-auto">
            <select
              value=""
              onChange={(e) => onLotChange(parseInt(e.target.value))}
              className="form-input w-full"
            >
              <option value="">Select Parking Lot</option>
              {parkingLots.map(lot => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {currentLot?.name || 'Parking Dashboard'}
            </h2>
            <div className="flex items-center mt-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              {lastUpdated && (
                <>
                  <span className="mx-2">•</span>
                  <span>Updated {formatTime(lastUpdated)}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-outline"
          >
            <RefreshIcon className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {statistics.availableSlots}
            </div>
            <div className="text-sm text-gray-600">Available</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {statistics.occupiedSlots}
            </div>
            <div className="text-sm text-gray-600">Occupied</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {statistics.totalSlots}
            </div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {statistics.occupancyRate}%
            </div>
            <div className="text-sm text-gray-600">Occupancy</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parking Grid */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Parking Slots
            </h3>
            <ParkingSlotGrid
              slots={slots}
              onSlotClick={handleSlotClick}
              selectedSlotId={selectedSlot?.id}
              showDetails={false}
              interactive={true}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Available Slots */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MapPinIcon className="w-5 h-5 mr-2 text-green-600" />
              Available Slots
            </h3>
            {availableSlotsWithPredictions.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableSlotsWithPredictions.slice(0, 10).map(slot => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center text-sm font-semibold mr-3">
                        {slot.slot_number}
                      </div>
                      <span className="text-sm text-gray-700">Available</span>
                    </div>
                    <button
                      onClick={() => handleSlotClick(slot)}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      Select
                    </button>
                  </motion.div>
                ))}
                {availableSlotsWithPredictions.length > 10 && (
                  <div className="text-center text-sm text-gray-500 pt-2">
                    +{availableSlotsWithPredictions.length - 10} more available
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <MapPinIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No available slots</p>
              </div>
            )}
          </div>

          {/* Soon to be Vacant */}
          {soonVacantSlots.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <ClockIcon className="w-5 h-5 mr-2 text-yellow-600" />
                Soon Available
              </h3>
              <div className="space-y-2">
                {soonVacantSlots.slice(0, 5).map(slot => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-yellow-600 text-white rounded-lg flex items-center justify-center text-sm font-semibold mr-3">
                        {slot.slot_number}
                      </div>
                      <div>
                        <div className="text-sm text-gray-700">
                          Est. {formatDuration(slot.predicted_vacancy_seconds, true)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Slot Details */}
          {selectedSlot && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Slot {selectedSlot.slot_number} Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${selectedSlot.is_occupied ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedSlot.is_occupied ? 'Occupied' : 'Available'}
                  </span>
                </div>
                {selectedSlot.is_occupied && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">
                        {formatDuration(selectedSlot.current_duration)}
                      </span>
                    </div>
                    {selectedSlot.predicted_vacancy_seconds > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Est. Vacant:</span>
                        <span className="font-medium text-yellow-600">
                          {formatDuration(selectedSlot.predicted_vacancy_seconds)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="font-medium">
                    {formatTime(selectedSlot.last_status_change)}
                  </span>
                </div>
                {!selectedSlot.is_occupied && (
                  <button
                    onClick={async () => {
                      const result = await bookSlot(selectedSlot.id, 3600);
                      if (result?.success) {
                        setSelectedSlot(result.slot);
                      }
                    }}
                    className="w-full btn btn-primary mt-4"
                  >
                    Book This Slot
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Chatbot Toggle */}
      <button
        onClick={() => setShowChatbot(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
      >
        <ChatBubbleLeftRightIcon className="w-6 h-6" />
      </button>

      {/* Chatbot Modal */}
      {showChatbot && (
        <Chatbot
          isOpen={showChatbot}
          onClose={() => setShowChatbot(false)}
          context={{
            parking_lots: parkingLots,
            current_lot: currentLot,
            statistics: statistics
          }}
        />
      )}
    </div>
  );
};

export default UserDashboard;
