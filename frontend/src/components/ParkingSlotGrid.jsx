import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { useParking } from '../contexts/ParkingContext';
import { formatDuration, formatTime } from '../utils/dateUtils';

const ParkingSlotGrid = ({
  slots = [],
  onSlotClick = null,
  selectedSlotId = null,
  showDetails = true,
  showPredictions = true,
  gridColumns = 'auto',
  className = '',
  interactive = true,
  compact = false
}) => {
  const { bookSlot, releaseSlot } = useParking();
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Memoized slot statistics
  const slotStats = useMemo(() => {
    const total = slots.length;
    const occupied = slots.filter(slot => slot.is_occupied).length;
    const available = total - occupied;
    const occupancyRate = total > 0 ? (occupied / total) * 100 : 0;

    return {
      total,
      occupied,
      available,
      occupancyRate: Math.round(occupancyRate * 10) / 10
    };
  }, [slots]);

  // Handle slot click
  const handleSlotClick = async (slot) => {
    if (!interactive) return;

    if (onSlotClick) {
      onSlotClick(slot);
      return;
    }

    // Default behavior: book/release slot
    if (actionLoading === slot.id) return;

    setActionLoading(slot.id);

    try {
      if (slot.is_occupied) {
        await releaseSlot(slot.id);
      } else {
        await bookSlot(slot.id);
      }
    } catch (error) {
      console.error('Slot action error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Get slot status info
  const getSlotStatusInfo = (slot) => {
    if (slot.is_occupied) {
      const duration = formatDuration(slot.current_duration);
      const prediction = slot.predicted_vacancy_seconds > 0 
        ? formatDuration(slot.predicted_vacancy_seconds)
        : null;

      return {
        status: 'occupied',
        icon: TruckIcon,
        color: 'red',
        title: `Occupied for ${duration}`,
        subtitle: prediction ? `Est. vacant in ${prediction}` : 'Duration unknown'
      };
    } else {
      return {
        status: 'available',
        icon: CheckCircleIcon,
        color: 'green',
        title: 'Available',
        subtitle: 'Ready for booking'
      };
    }
  };

  // Grid style based on columns setting
  const gridStyle = useMemo(() => {
    if (gridColumns === 'auto') {
      return {};
    }
    return {
      gridTemplateColumns: `repeat(${gridColumns}, 1fr)`
    };
  }, [gridColumns]);

  return (
    <div className={clsx('parking-slot-grid-container', className)}>
      {/* Statistics Header */}
      {showDetails && !compact && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <InformationCircleIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Slots</p>
                <p className="text-2xl font-bold text-gray-900">{slotStats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">{slotStats.available}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <TruckIcon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Occupied</p>
                <p className="text-2xl font-bold text-red-600">{slotStats.occupied}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Occupancy</p>
                <p className="text-2xl font-bold text-yellow-600">{slotStats.occupancyRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {showDetails && !compact && (
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded mr-2"></div>
            <span className="text-gray-600">Available</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded mr-2"></div>
            <span className="text-gray-600">Occupied</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded mr-2"></div>
            <span className="text-gray-600">Selected</span>
          </div>
        </div>
      )}

      {/* Parking Slots Grid */}
      <div 
        className={clsx(
          'grid gap-2 md:gap-3',
          gridColumns === 'auto' ? 'grid-parking-slots' : '',
          compact && 'gap-1'
        )}
        style={gridStyle}
      >
        <AnimatePresence>
          {slots.map((slot) => {
            const statusInfo = getSlotStatusInfo(slot);
            const isSelected = selectedSlotId === slot.id;
            const isHovered = hoveredSlot === slot.id;
            const isLoading = actionLoading === slot.id;

            return (
              <motion.div
                key={slot.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={interactive ? { scale: 1.05 } : {}}
                whileTap={interactive ? { scale: 0.95 } : {}}
                className={clsx(
                  'parking-slot relative transition-all duration-200',
                  statusInfo.status === 'available' && 'available',
                  statusInfo.status === 'occupied' && 'occupied',
                  isSelected && 'selected ring-2 ring-blue-500 ring-offset-2',
                  interactive && 'cursor-pointer hover:shadow-md',
                  isLoading && 'opacity-50',
                  compact ? 'min-h-12' : 'min-h-20'
                )}
                onClick={() => handleSlotClick(slot)}
                onMouseEnter={() => setHoveredSlot(slot.id)}
                onMouseLeave={() => setHoveredSlot(null)}
              >
                {/* Loading Overlay */}
                {isLoading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {/* Slot Number */}
                <div className="parking-slot-number">
                  <span className={clsx(
                    'font-semibold',
                    compact ? 'text-xs' : 'text-sm'
                  )}>
                    {slot.slot_number}
                  </span>
                </div>

                {/* Status Icon */}
                {!compact && (
                  <div className="absolute top-1 right-1">
                    <statusInfo.icon className={clsx(
                      'w-4 h-4',
                      statusInfo.color === 'green' && 'text-green-600',
                      statusInfo.color === 'red' && 'text-red-600'
                    )} />
                  </div>
                )}

                {/* Duration Indicator */}
                {!compact && slot.is_occupied && slot.current_duration > 0 && (
                  <div className="absolute bottom-1 left-1 right-1">
                    <div className="bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded text-center">
                      {formatDuration(slot.current_duration, true)}
                    </div>
                  </div>
                )}

                {/* Prediction Indicator */}
                {!compact && showPredictions && slot.is_occupied && slot.predicted_vacancy_seconds > 0 && (
                  <div className="absolute top-1 left-1">
                    <div className="bg-yellow-500 text-white text-xs px-1 py-0.5 rounded flex items-center">
                      <ClockIcon className="w-3 h-3 mr-1" />
                      {formatDuration(slot.predicted_vacancy_seconds, true)}
                    </div>
                  </div>
                )}

                {/* Hover Tooltip */}
                {isHovered && !compact && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-20"
                  >
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                      <div className="font-medium">{statusInfo.title}</div>
                      <div className="text-gray-300">{statusInfo.subtitle}</div>
                      {slot.last_status_change && (
                        <div className="text-gray-400 mt-1">
                          Last updated: {formatTime(slot.last_status_change)}
                        </div>
                      )}
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                        <div className="w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {slots.length === 0 && (
        <div className="text-center py-12">
          <TruckIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No parking slots</h3>
          <p className="text-gray-600">No parking slots are configured for this lot.</p>
        </div>
      )}
    </div>
  );
};

// Compact version for small displays
export const CompactParkingGrid = (props) => {
  return (
    <ParkingSlotGrid
      {...props}
      compact={true}
      showDetails={false}
      showPredictions={false}
    />
  );
};

// Mini version for dashboard widgets
export const MiniParkingGrid = ({ slots, className = '' }) => {
  const slotStats = useMemo(() => {
    const total = slots.length;
    const occupied = slots.filter(slot => slot.is_occupied).length;
    return { total, occupied, available: total - occupied };
  }, [slots]);

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex justify-between text-sm text-gray-600">
        <span>Occupancy</span>
        <span>{slotStats.occupied}/{slotStats.total}</span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {slots.slice(0, 20).map((slot) => (
          <div
            key={slot.id}
            className={clsx(
              'w-3 h-6 rounded-sm',
              slot.is_occupied ? 'bg-red-400' : 'bg-green-400'
            )}
            title={`Slot ${slot.slot_number}: ${slot.is_occupied ? 'Occupied' : 'Available'}`}
          />
        ))}
        {slots.length > 20 && (
          <div className="w-3 h-6 rounded-sm bg-gray-300 flex items-center justify-center">
            <span className="text-xs text-gray-600">+</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParkingSlotGrid;
