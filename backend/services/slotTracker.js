const ParkingSlot = require('../models/ParkingSlot');
const ParkingLot = require('../models/ParkingLot');

class SlotTracker {
  constructor(io) {
    this.io = io;
    this.updateInterval = 60000; // Update every minute
    this.durationInterval = 1000; // Update durations every second
    this.isRunning = false;
    this.intervalIds = [];
    this.dbConnectionErrorLogged = false; // Flag to prevent spam logging
    
    this.startTracking();
  }

  // Start the tracking service
  startTracking() {
    if (this.isRunning) {
      console.log('⚠️  Slot tracker is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting slot tracker service...');

    // Update slot durations every second
    const durationIntervalId = setInterval(() => {
      this.updateOccupiedSlotDurations();
    }, this.durationInterval);

    // Update predictions and analytics every minute
    const updateIntervalId = setInterval(() => {
      this.updatePredictions();
      this.updateAnalytics();
    }, this.updateInterval);

    this.intervalIds.push(durationIntervalId, updateIntervalId);
    console.log('✅ Slot tracker service started');
  }

  // Stop the tracking service
  stopTracking() {
    if (!this.isRunning) {
      console.log('⚠️  Slot tracker is not running');
      return;
    }

    this.isRunning = false;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    console.log('🛑 Slot tracker service stopped');
  }

  // Update durations for all occupied slots
  async updateOccupiedSlotDurations() {
    try {
      // Get all active parking lots
      const parkingLots = await ParkingLot.findAll();
      
      for (const lot of parkingLots) {
        // Get occupied slots for this lot
        const occupiedSlots = await ParkingSlot.getOccupiedSlots(lot.id);
        
        if (occupiedSlots.length === 0) continue;

        // Update duration for each occupied slot
        const updatedSlots = [];
        for (const slot of occupiedSlots) {
          await slot.updateDuration();
          updatedSlots.push({
            slot_id: slot.id,
            slot_number: slot.slot_number,
            current_duration: slot.current_duration,
            predicted_vacancy_seconds: Math.max(0, slot.predicted_vacancy_seconds - 1)
          });

          // Update predicted vacancy time (countdown)
          if (slot.predicted_vacancy_seconds > 0) {
            await slot.updateStatus(true, slot.predicted_vacancy_seconds - 1);
          }
        }

        // Emit real-time duration updates
        if (updatedSlots.length > 0) {
          this.io.to(`parking-lot-${lot.id}`).emit('slot-durations-updated', {
            parking_lot_id: lot.id,
            updated_slots: updatedSlots,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      // Only log database connection errors once to avoid spam
      if (error.code === 'ECONNREFUSED') {
        if (!this.dbConnectionErrorLogged) {
          console.error('❌ Database connection failed. Waiting for database to be available...');
          this.dbConnectionErrorLogged = true;
        }
      } else {
        console.error('❌ Error updating slot durations:', error);
      }
    }
  }

  // Update vacancy predictions using simple algorithms
  async updatePredictions() {
    try {
      const parkingLots = await ParkingLot.findAll();
      
      for (const lot of parkingLots) {
        const occupiedSlots = await ParkingSlot.getOccupiedSlots(lot.id);
        
        for (const slot of occupiedSlots) {
          // Simple prediction algorithm based on current duration
          const currentDuration = parseInt(slot.current_duration) || 0;
          let predictedVacancy = slot.predicted_vacancy_seconds;

          // If no prediction exists, estimate based on average parking duration
          if (predictedVacancy <= 0) {
            // Default prediction: 30 minutes to 2 hours based on current duration
            if (currentDuration < 1800) { // Less than 30 minutes
              predictedVacancy = Math.random() * 3600 + 1800; // 30-90 minutes
            } else if (currentDuration < 3600) { // Less than 1 hour
              predictedVacancy = Math.random() * 1800 + 900; // 15-45 minutes
            } else { // More than 1 hour
              predictedVacancy = Math.random() * 900 + 300; // 5-20 minutes
            }

            // Update the prediction
            await slot.updateStatus(true, Math.floor(predictedVacancy));
          }
        }
      }
    } catch (error) {
      console.error('❌ Error updating predictions:', error);
    }
  }

  // Update analytics data
  async updateAnalytics() {
    try {
      const db = require('../config/database');
      const currentHour = new Date().getHours();
      const currentDate = new Date().toISOString().split('T')[0];

      const parkingLots = await ParkingLot.findAll();
      
      for (const lot of parkingLots) {
        const stats = await lot.getStatistics();
        const occupancyRate = parseFloat(stats.occupancy_rate) || 0;
        const totalVehicles = parseInt(stats.occupied_slots) || 0;
        
        // Simple revenue calculation ($2-5 per vehicle per hour)
        const revenue = totalVehicles * (2 + Math.random() * 3);

        // Insert or update analytics record
        await db.query(`
          INSERT INTO parking_analytics (parking_lot_id, date, hour, occupancy_rate, total_vehicles, revenue)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (parking_lot_id, date, hour)
          DO UPDATE SET 
            occupancy_rate = $4,
            total_vehicles = $5,
            revenue = $6
        `, [lot.id, currentDate, currentHour, occupancyRate, totalVehicles, revenue]);
      }
    } catch (error) {
      console.error('❌ Error updating analytics:', error);
    }
  }

  // Simulate random slot changes (for demo purposes)
  async simulateSlotChanges() {
    try {
      const parkingLots = await ParkingLot.findAll();
      
      for (const lot of parkingLots) {
        // Randomly change 1-3 slots every few minutes
        const changeCount = Math.floor(Math.random() * 3) + 1;
        const allSlots = await ParkingSlot.findByLotId(lot.id);
        
        for (let i = 0; i < changeCount; i++) {
          const randomSlot = allSlots[Math.floor(Math.random() * allSlots.length)];
          const newStatus = Math.random() < 0.3; // 30% chance to be occupied
          
          if (randomSlot.is_occupied !== newStatus) {
            const predictionSeconds = newStatus ? Math.floor(Math.random() * 3600) + 300 : 0;
            await randomSlot.updateStatus(newStatus, predictionSeconds);

            // Emit real-time update
            this.io.to(`parking-lot-${lot.id}`).emit('slot-status-changed', {
              slot_id: randomSlot.id,
              slot_number: randomSlot.slot_number,
              is_occupied: newStatus,
              predicted_vacancy_seconds: predictionSeconds,
              timestamp: new Date().toISOString(),
              source: 'simulation'
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error simulating slot changes:', error);
    }
  }

  // Start simulation mode (for demo)
  startSimulation() {
    if (this.simulationInterval) {
      console.log('⚠️  Simulation is already running');
      return;
    }

    console.log('🎭 Starting slot change simulation...');
    this.simulationInterval = setInterval(() => {
      this.simulateSlotChanges();
    }, 30000); // Change slots every 30 seconds
  }

  // Stop simulation mode
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      console.log('🛑 Slot change simulation stopped');
    }
  }

  // Get tracking status
  getStatus() {
    return {
      is_running: this.isRunning,
      update_interval: this.updateInterval,
      duration_interval: this.durationInterval,
      simulation_running: !!this.simulationInterval,
      active_intervals: this.intervalIds.length
    };
  }

  // Manually trigger updates
  async triggerUpdate() {
    try {
      console.log('🔄 Manually triggering slot tracker update...');
      await this.updateOccupiedSlotDurations();
      await this.updatePredictions();
      await this.updateAnalytics();
      console.log('✅ Manual update completed');
    } catch (error) {
      console.error('❌ Error in manual update:', error);
      throw error;
    }
  }

  // Get statistics about tracked slots
  async getTrackingStatistics() {
    try {
      const db = require('../config/database');
      
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT pl.id) as total_lots,
          COUNT(ps.id) as total_slots,
          COUNT(CASE WHEN ps.is_occupied = true THEN 1 END) as occupied_slots,
          COUNT(CASE WHEN ps.is_occupied = false THEN 1 END) as available_slots,
          AVG(ps.current_duration) as avg_duration,
          AVG(ps.predicted_vacancy_seconds) as avg_prediction
        FROM parking_lots pl
        LEFT JOIN parking_slots ps ON pl.id = ps.parking_lot_id
        WHERE pl.is_active = true
      `);

      return {
        tracking_status: this.getStatus(),
        slot_statistics: stats.rows[0],
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting tracking statistics:', error);
      throw error;
    }
  }

  // Handle slot booking events
  async handleSlotBooked(slotId, estimatedDuration) {
    try {
      const slot = await ParkingSlot.findById(slotId);
      if (!slot) return;

      // Emit booking event
      this.io.to(`parking-lot-${slot.parking_lot_id}`).emit('slot-booked', {
        slot_id: slotId,
        slot_number: slot.slot_number,
        estimated_duration: estimatedDuration,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error handling slot booking:', error);
    }
  }

  // Handle slot release events
  async handleSlotReleased(slotId, actualDuration) {
    try {
      const slot = await ParkingSlot.findById(slotId);
      if (!slot) return;

      // Emit release event
      this.io.to(`parking-lot-${slot.parking_lot_id}`).emit('slot-released', {
        slot_id: slotId,
        slot_number: slot.slot_number,
        actual_duration: actualDuration,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error handling slot release:', error);
    }
  }
}

module.exports = SlotTracker;
