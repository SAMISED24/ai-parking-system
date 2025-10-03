const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const Joi = require('joi');

// Validation schemas
const bookSlotSchema = Joi.object({
  slot_id: Joi.number().integer().positive().required(),
  user_id: Joi.number().integer().positive().optional(),
  estimated_duration: Joi.number().integer().min(300).max(86400).optional() // 5 minutes to 24 hours
});

const updateSlotSchema = Joi.object({
  is_occupied: Joi.boolean().required(),
  predicted_vacancy_seconds: Joi.number().integer().min(0).optional()
});

class ParkingController {
  // Get parking lot status with all slots
  static async getParkingStatus(req, res) {
    try {
      const { lotId } = req.params;
      
      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      // Get parking lot details
      const parkingLot = await ParkingLot.findById(parseInt(lotId));
      if (!parkingLot) {
        return res.status(404).json({
          error: 'Parking lot not found'
        });
      }

      // Get all slots for this lot
      const slots = await ParkingSlot.findByLotId(parseInt(lotId));
      
      // Get lot statistics
      const stats = await parkingLot.getStatistics();

      res.json({
        success: true,
        data: {
          parking_lot: parkingLot.toJSON(),
          slots: slots.map(slot => slot.toJSON()),
          statistics: {
            total_slots: parseInt(stats.total_slots),
            occupied_slots: parseInt(stats.occupied_slots),
            available_slots: parseInt(stats.available_slots),
            occupancy_rate: parseFloat(stats.occupancy_rate)
          }
        }
      });
    } catch (error) {
      console.error('Error getting parking status:', error);
      res.status(500).json({
        error: 'Failed to get parking status',
        message: error.message
      });
    }
  }

  // Get available parking slots
  static async getAvailableSlots(req, res) {
    try {
      const { lotId } = req.params;
      
      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      const availableSlots = await ParkingSlot.getAvailableSlots(parseInt(lotId));
      
      res.json({
        success: true,
        data: {
          available_slots: availableSlots.map(slot => slot.toJSON()),
          count: availableSlots.length
        }
      });
    } catch (error) {
      console.error('Error getting available slots:', error);
      res.status(500).json({
        error: 'Failed to get available slots',
        message: error.message
      });
    }
  }

  // Get occupied parking slots
  static async getOccupiedSlots(req, res) {
    try {
      const { lotId } = req.params;
      
      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      const occupiedSlots = await ParkingSlot.getOccupiedSlots(parseInt(lotId));
      
      res.json({
        success: true,
        data: {
          occupied_slots: occupiedSlots.map(slot => slot.toJSON()),
          count: occupiedSlots.length
        }
      });
    } catch (error) {
      console.error('Error getting occupied slots:', error);
      res.status(500).json({
        error: 'Failed to get occupied slots',
        message: error.message
      });
    }
  }

  // Book a parking slot
  static async bookSlot(req, res) {
    try {
      const { error, value } = bookSlotSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const { slot_id, user_id, estimated_duration } = value;

      // Get the slot
      const slot = await ParkingSlot.findById(slot_id);
      if (!slot) {
        return res.status(404).json({
          error: 'Parking slot not found'
        });
      }

      // Check if slot is available
      if (slot.is_occupied) {
        return res.status(409).json({
          error: 'Parking slot is already occupied'
        });
      }

      // Update slot status to occupied
      await slot.updateStatus(true, estimated_duration || 3600);

      // Emit real-time update
      req.io.to(`parking-lot-${slot.parking_lot_id}`).emit('slot-status-changed', {
        slot_id: slot.id,
        slot_number: slot.slot_number,
        is_occupied: true,
        predicted_vacancy_seconds: estimated_duration || 3600,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Parking slot booked successfully',
        data: {
          slot: slot.toJSON(),
          booking_details: {
            estimated_duration: estimated_duration || 3600,
            estimated_end_time: new Date(Date.now() + (estimated_duration || 3600) * 1000).toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Error booking slot:', error);
      res.status(500).json({
        error: 'Failed to book parking slot',
        message: error.message
      });
    }
  }

  // Release a parking slot
  static async releaseSlot(req, res) {
    try {
      const { slotId } = req.params;
      
      if (!slotId || isNaN(slotId)) {
        return res.status(400).json({
          error: 'Invalid slot ID'
        });
      }

      // Get the slot
      const slot = await ParkingSlot.findById(parseInt(slotId));
      if (!slot) {
        return res.status(404).json({
          error: 'Parking slot not found'
        });
      }

      // Check if slot is occupied
      if (!slot.is_occupied) {
        return res.status(409).json({
          error: 'Parking slot is already vacant'
        });
      }

      // Update slot status to vacant
      await slot.updateStatus(false);

      // Emit real-time update
      req.io.to(`parking-lot-${slot.parking_lot_id}`).emit('slot-status-changed', {
        slot_id: slot.id,
        slot_number: slot.slot_number,
        is_occupied: false,
        predicted_vacancy_seconds: 0,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Parking slot released successfully',
        data: {
          slot: slot.toJSON()
        }
      });
    } catch (error) {
      console.error('Error releasing slot:', error);
      res.status(500).json({
        error: 'Failed to release parking slot',
        message: error.message
      });
    }
  }

  // Update slot status (for AI system)
  static async updateSlotStatus(req, res) {
    try {
      const { slotId } = req.params;
      const { error, value } = updateSlotSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      if (!slotId || isNaN(slotId)) {
        return res.status(400).json({
          error: 'Invalid slot ID'
        });
      }

      const { is_occupied, predicted_vacancy_seconds } = value;

      // Get the slot
      const slot = await ParkingSlot.findById(parseInt(slotId));
      if (!slot) {
        return res.status(404).json({
          error: 'Parking slot not found'
        });
      }

      // Update slot status
      await slot.updateStatus(is_occupied, predicted_vacancy_seconds);

      // Emit real-time update
      req.io.to(`parking-lot-${slot.parking_lot_id}`).emit('slot-status-changed', {
        slot_id: slot.id,
        slot_number: slot.slot_number,
        is_occupied: is_occupied,
        predicted_vacancy_seconds: predicted_vacancy_seconds || 0,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Slot status updated successfully',
        data: {
          slot: slot.toJSON()
        }
      });
    } catch (error) {
      console.error('Error updating slot status:', error);
      res.status(500).json({
        error: 'Failed to update slot status',
        message: error.message
      });
    }
  }

  // Bulk update slot statuses (for video analysis results)
  static async bulkUpdateSlots(req, res) {
    try {
      const { lotId } = req.params;
      const { slot_updates } = req.body;

      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      if (!Array.isArray(slot_updates) || slot_updates.length === 0) {
        return res.status(400).json({
          error: 'slot_updates must be a non-empty array'
        });
      }

      // Validate each update
      for (const update of slot_updates) {
        if (!update.slot_id || typeof update.is_occupied !== 'boolean') {
          return res.status(400).json({
            error: 'Each update must have slot_id and is_occupied fields'
          });
        }
      }

      // Perform bulk update
      const updatedSlots = await ParkingSlot.bulkUpdateStatuses(slot_updates);

      // Emit real-time updates for each changed slot
      updatedSlots.forEach(slot => {
        req.io.to(`parking-lot-${slot.parking_lot_id}`).emit('slot-status-changed', {
          slot_id: slot.id,
          slot_number: slot.slot_number,
          is_occupied: slot.is_occupied,
          predicted_vacancy_seconds: slot.predicted_vacancy_seconds,
          timestamp: new Date().toISOString()
        });
      });

      res.json({
        success: true,
        message: `${updatedSlots.length} slots updated successfully`,
        data: {
          updated_slots: updatedSlots.map(slot => slot.toJSON())
        }
      });
    } catch (error) {
      console.error('Error bulk updating slots:', error);
      res.status(500).json({
        error: 'Failed to bulk update slots',
        message: error.message
      });
    }
  }

  // Get slot details with booking history
  static async getSlotDetails(req, res) {
    try {
      const { slotId } = req.params;
      
      if (!slotId || isNaN(slotId)) {
        return res.status(400).json({
          error: 'Invalid slot ID'
        });
      }

      const slot = await ParkingSlot.findById(parseInt(slotId));
      if (!slot) {
        return res.status(404).json({
          error: 'Parking slot not found'
        });
      }

      // Get booking history
      const bookingHistory = await slot.getBookingHistory(10);
      const currentBooking = await slot.getCurrentBooking();

      res.json({
        success: true,
        data: {
          slot: slot.toJSON(),
          current_booking: currentBooking,
          booking_history: bookingHistory
        }
      });
    } catch (error) {
      console.error('Error getting slot details:', error);
      res.status(500).json({
        error: 'Failed to get slot details',
        message: error.message
      });
    }
  }

  // Get all parking lots
  static async getAllParkingLots(req, res) {
    try {
      const includeInactive = req.query.include_inactive === 'true';
      const parkingLots = await ParkingLot.findAll(includeInactive);

      // Get statistics for each lot
      const lotsWithStats = await Promise.all(
        parkingLots.map(async (lot) => {
          const stats = await lot.getStatistics();
          return {
            ...lot.toJSON(),
            statistics: {
              total_slots: parseInt(stats.total_slots),
              occupied_slots: parseInt(stats.occupied_slots),
              available_slots: parseInt(stats.available_slots),
              occupancy_rate: parseFloat(stats.occupancy_rate)
            }
          };
        })
      );

      res.json({
        success: true,
        data: {
          parking_lots: lotsWithStats,
          count: lotsWithStats.length
        }
      });
    } catch (error) {
      console.error('Error getting parking lots:', error);
      res.status(500).json({
        error: 'Failed to get parking lots',
        message: error.message
      });
    }
  }

  // Update slot durations (called periodically for occupied slots)
  static async updateSlotDurations(req, res) {
    try {
      const { lotId } = req.params;
      
      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      // Get all occupied slots for this lot
      const occupiedSlots = await ParkingSlot.getOccupiedSlots(parseInt(lotId));

      // Update duration for each occupied slot
      const updatedSlots = [];
      for (const slot of occupiedSlots) {
        await slot.updateDuration();
        updatedSlots.push(slot.toJSON());
      }

      // Emit real-time duration updates
      updatedSlots.forEach(slot => {
        req.io.to(`parking-lot-${lotId}`).emit('slot-duration-updated', {
          slot_id: slot.id,
          slot_number: slot.slot_number,
          current_duration: slot.current_duration,
          timestamp: new Date().toISOString()
        });
      });

      res.json({
        success: true,
        message: `Updated durations for ${updatedSlots.length} slots`,
        data: {
          updated_slots: updatedSlots
        }
      });
    } catch (error) {
      console.error('Error updating slot durations:', error);
      res.status(500).json({
        error: 'Failed to update slot durations',
        message: error.message
      });
    }
  }
}

module.exports = ParkingController;
