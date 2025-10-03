const ParkingSlot = require('../models/ParkingSlot');
const ParkingLot = require('../models/ParkingLot');
const db = require('../config/database');

class PredictionEngine {
  constructor() {
    this.models = {
      duration: new DurationPredictor(),
      occupancy: new OccupancyPredictor(),
      demand: new DemandPredictor()
    };
    
    this.updateInterval = 300000; // Update predictions every 5 minutes
    this.isRunning = false;
    
    this.startPredictionEngine();
  }

  // Start the prediction engine
  startPredictionEngine() {
    if (this.isRunning) {
      console.log('⚠️  Prediction engine is already running');
      return;
    }

    this.isRunning = true;
    console.log('🧠 Starting prediction engine...');

    // Update predictions periodically
    this.intervalId = setInterval(() => {
      this.updateAllPredictions();
    }, this.updateInterval);

    console.log('✅ Prediction engine started');
  }

  // Stop the prediction engine
  stopPredictionEngine() {
    if (!this.isRunning) {
      console.log('⚠️  Prediction engine is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Prediction engine stopped');
  }

  // Update all predictions
  async updateAllPredictions() {
    try {
      console.log('🔮 Updating all predictions...');
      
      const parkingLots = await ParkingLot.findAll();
      
      for (const lot of parkingLots) {
        await this.updateLotPredictions(lot.id);
      }
      
      console.log('✅ All predictions updated');
    } catch (error) {
      console.error('❌ Error updating predictions:', error);
    }
  }

  // Update predictions for a specific parking lot
  async updateLotPredictions(lotId) {
    try {
      const occupiedSlots = await ParkingSlot.getOccupiedSlots(lotId);
      const availableSlots = await ParkingSlot.getAvailableSlots(lotId);
      
      // Update duration predictions for occupied slots
      for (const slot of occupiedSlots) {
        const prediction = await this.models.duration.predict(slot);
        if (prediction.vacancy_seconds !== slot.predicted_vacancy_seconds) {
          await slot.updateStatus(true, prediction.vacancy_seconds);
        }
      }

      // Update occupancy predictions for available slots
      for (const slot of availableSlots) {
        const prediction = await this.models.occupancy.predict(slot);
        // Store occupancy prediction in slot metadata if needed
      }

      // Update demand predictions for the lot
      const demandPrediction = await this.models.demand.predict(lotId);
      // Store demand prediction in lot analytics if needed
      
    } catch (error) {
      console.error(`❌ Error updating predictions for lot ${lotId}:`, error);
    }
  }

  // Get predictions for a specific slot
  async getSlotPredictions(slotId) {
    try {
      const slot = await ParkingSlot.findById(slotId);
      if (!slot) {
        throw new Error('Slot not found');
      }

      const predictions = {};

      if (slot.is_occupied) {
        predictions.duration = await this.models.duration.predict(slot);
      } else {
        predictions.occupancy = await this.models.occupancy.predict(slot);
      }

      return predictions;
    } catch (error) {
      console.error('❌ Error getting slot predictions:', error);
      throw error;
    }
  }

  // Get predictions for a parking lot
  async getLotPredictions(lotId) {
    try {
      const demandPrediction = await this.models.demand.predict(lotId);
      const slots = await ParkingSlot.findByLotId(lotId);
      
      const slotPredictions = [];
      for (const slot of slots) {
        try {
          const prediction = await this.getSlotPredictions(slot.id);
          slotPredictions.push({
            slot_id: slot.id,
            slot_number: slot.slot_number,
            is_occupied: slot.is_occupied,
            ...prediction
          });
        } catch (error) {
          console.error(`Error getting prediction for slot ${slot.id}:`, error);
        }
      }

      return {
        parking_lot_id: lotId,
        demand_prediction: demandPrediction,
        slot_predictions: slotPredictions,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting lot predictions:', error);
      throw error;
    }
  }

  // Train models with historical data
  async trainModels() {
    try {
      console.log('🎓 Training prediction models...');
      
      await this.models.duration.train();
      await this.models.occupancy.train();
      await this.models.demand.train();
      
      console.log('✅ Model training completed');
    } catch (error) {
      console.error('❌ Error training models:', error);
      throw error;
    }
  }

  // Get engine status
  getStatus() {
    return {
      is_running: this.isRunning,
      update_interval: this.updateInterval,
      models: {
        duration: this.models.duration.getStatus(),
        occupancy: this.models.occupancy.getStatus(),
        demand: this.models.demand.getStatus()
      },
      last_update: new Date().toISOString()
    };
  }
}

// Duration Predictor - Predicts how long a vehicle will stay
class DurationPredictor {
  constructor() {
    this.modelType = 'duration';
    this.accuracy = 0.75; // Mock accuracy
    this.lastTrained = null;
  }

  async predict(slot) {
    try {
      const currentDuration = parseInt(slot.current_duration) || 0;
      const currentHour = new Date().getHours();
      const dayOfWeek = new Date().getDay();
      
      // Simple rule-based prediction
      let baseDuration = 3600; // 1 hour default
      
      // Adjust based on time of day
      if (currentHour >= 9 && currentHour <= 17) { // Business hours
        baseDuration = 7200; // 2 hours
      } else if (currentHour >= 18 && currentHour <= 22) { // Evening
        baseDuration = 5400; // 1.5 hours
      }
      
      // Adjust based on day of week
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
        baseDuration *= 1.5;
      }
      
      // Adjust based on current duration
      if (currentDuration > 0) {
        const remainingTime = Math.max(300, baseDuration - currentDuration); // At least 5 minutes
        const variance = remainingTime * 0.3; // 30% variance
        const prediction = remainingTime + (Math.random() - 0.5) * variance;
        
        return {
          vacancy_seconds: Math.max(300, Math.floor(prediction)),
          confidence: this.accuracy,
          factors: {
            current_duration: currentDuration,
            time_of_day: currentHour,
            day_of_week: dayOfWeek,
            base_duration: baseDuration
          }
        };
      }
      
      return {
        vacancy_seconds: Math.floor(baseDuration + (Math.random() - 0.5) * baseDuration * 0.5),
        confidence: this.accuracy * 0.8, // Lower confidence for new occupancy
        factors: {
          time_of_day: currentHour,
          day_of_week: dayOfWeek,
          base_duration: baseDuration
        }
      };
    } catch (error) {
      console.error('❌ Error in duration prediction:', error);
      return {
        vacancy_seconds: 1800, // Default 30 minutes
        confidence: 0.5,
        error: error.message
      };
    }
  }

  async train() {
    try {
      // Mock training with historical booking data
      const historicalData = await db.query(`
        SELECT 
          EXTRACT(HOUR FROM booking_start) as hour,
          EXTRACT(DOW FROM booking_start) as day_of_week,
          actual_duration,
          estimated_duration
        FROM bookings 
        WHERE actual_duration IS NOT NULL 
          AND booking_start >= NOW() - INTERVAL '30 days'
        LIMIT 1000
      `);

      // Simple accuracy calculation based on historical data
      if (historicalData.rows.length > 0) {
        const accuracySum = historicalData.rows.reduce((sum, row) => {
          const error = Math.abs(row.actual_duration - row.estimated_duration);
          const accuracy = Math.max(0, 1 - (error / row.actual_duration));
          return sum + accuracy;
        }, 0);
        
        this.accuracy = accuracySum / historicalData.rows.length;
      }

      this.lastTrained = new Date();
      console.log(`📊 Duration model trained with accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('❌ Error training duration model:', error);
    }
  }

  getStatus() {
    return {
      model_type: this.modelType,
      accuracy: this.accuracy,
      last_trained: this.lastTrained
    };
  }
}

// Occupancy Predictor - Predicts when a vacant slot will be occupied
class OccupancyPredictor {
  constructor() {
    this.modelType = 'occupancy';
    this.accuracy = 0.70;
    this.lastTrained = null;
  }

  async predict(slot) {
    try {
      const currentHour = new Date().getHours();
      const dayOfWeek = new Date().getDay();
      
      // Get historical occupancy patterns
      const occupancyRate = await this.getHistoricalOccupancy(slot.parking_lot_id, currentHour, dayOfWeek);
      
      // Simple probability-based prediction
      const occupancyProbability = occupancyRate / 100;
      const timeToOccupancy = this.calculateTimeToOccupancy(occupancyProbability);
      
      return {
        occupancy_probability: occupancyProbability,
        estimated_time_to_occupancy: timeToOccupancy,
        confidence: this.accuracy,
        factors: {
          historical_occupancy_rate: occupancyRate,
          time_of_day: currentHour,
          day_of_week: dayOfWeek
        }
      };
    } catch (error) {
      console.error('❌ Error in occupancy prediction:', error);
      return {
        occupancy_probability: 0.5,
        estimated_time_to_occupancy: 1800,
        confidence: 0.5,
        error: error.message
      };
    }
  }

  async getHistoricalOccupancy(lotId, hour, dayOfWeek) {
    try {
      const result = await db.query(`
        SELECT AVG(occupancy_rate) as avg_occupancy
        FROM parking_analytics 
        WHERE parking_lot_id = $1 
          AND hour = $2 
          AND EXTRACT(DOW FROM date) = $3
          AND date >= CURRENT_DATE - INTERVAL '30 days'
      `, [lotId, hour, dayOfWeek]);

      return result.rows[0]?.avg_occupancy || 50; // Default 50% if no data
    } catch (error) {
      console.error('❌ Error getting historical occupancy:', error);
      return 50;
    }
  }

  calculateTimeToOccupancy(probability) {
    // Higher probability = shorter time to occupancy
    const basetime = 3600; // 1 hour base
    const timeMultiplier = 1 / Math.max(0.1, probability);
    return Math.floor(basetime * timeMultiplier * (0.5 + Math.random()));
  }

  async train() {
    try {
      // Mock training with historical analytics data
      const historicalData = await db.query(`
        SELECT 
          hour,
          EXTRACT(DOW FROM date) as day_of_week,
          occupancy_rate
        FROM parking_analytics 
        WHERE date >= NOW() - INTERVAL '30 days'
        ORDER BY date DESC
        LIMIT 1000
      `);

      // Calculate model accuracy based on historical patterns
      if (historicalData.rows.length > 0) {
        // Simple variance-based accuracy calculation
        const occupancyRates = historicalData.rows.map(row => row.occupancy_rate);
        const mean = occupancyRates.reduce((sum, rate) => sum + rate, 0) / occupancyRates.length;
        const variance = occupancyRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / occupancyRates.length;
        
        // Lower variance = higher accuracy
        this.accuracy = Math.max(0.5, 1 - (variance / 10000));
      }

      this.lastTrained = new Date();
      console.log(`📊 Occupancy model trained with accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('❌ Error training occupancy model:', error);
    }
  }

  getStatus() {
    return {
      model_type: this.modelType,
      accuracy: this.accuracy,
      last_trained: this.lastTrained
    };
  }
}

// Demand Predictor - Predicts overall demand for a parking lot
class DemandPredictor {
  constructor() {
    this.modelType = 'demand';
    this.accuracy = 0.80;
    this.lastTrained = null;
  }

  async predict(lotId) {
    try {
      const currentHour = new Date().getHours();
      const dayOfWeek = new Date().getDay();
      
      // Get current lot statistics
      const lot = await ParkingLot.findById(lotId);
      const stats = await lot.getStatistics();
      
      // Get historical demand patterns
      const historicalDemand = await this.getHistoricalDemand(lotId, currentHour, dayOfWeek);
      
      // Predict demand for next few hours
      const hourlyPredictions = [];
      for (let i = 1; i <= 6; i++) { // Next 6 hours
        const futureHour = (currentHour + i) % 24;
        const futureDemand = await this.getHistoricalDemand(lotId, futureHour, dayOfWeek);
        
        hourlyPredictions.push({
          hour: futureHour,
          predicted_occupancy_rate: futureDemand.avg_occupancy,
          predicted_vehicles: Math.floor((futureDemand.avg_occupancy / 100) * stats.total_slots),
          confidence: this.accuracy
        });
      }
      
      return {
        current_demand: {
          occupancy_rate: parseFloat(stats.occupancy_rate),
          occupied_slots: parseInt(stats.occupied_slots),
          available_slots: parseInt(stats.available_slots)
        },
        historical_average: historicalDemand,
        hourly_predictions: hourlyPredictions,
        peak_hours: await this.getPeakHours(lotId),
        confidence: this.accuracy
      };
    } catch (error) {
      console.error('❌ Error in demand prediction:', error);
      return {
        current_demand: null,
        hourly_predictions: [],
        confidence: 0.5,
        error: error.message
      };
    }
  }

  async getHistoricalDemand(lotId, hour, dayOfWeek) {
    try {
      const result = await db.query(`
        SELECT 
          AVG(occupancy_rate) as avg_occupancy,
          AVG(total_vehicles) as avg_vehicles,
          COUNT(*) as data_points
        FROM parking_analytics 
        WHERE parking_lot_id = $1 
          AND hour = $2 
          AND EXTRACT(DOW FROM date) = $3
          AND date >= CURRENT_DATE - INTERVAL '30 days'
      `, [lotId, hour, dayOfWeek]);

      return result.rows[0] || { avg_occupancy: 50, avg_vehicles: 0, data_points: 0 };
    } catch (error) {
      console.error('❌ Error getting historical demand:', error);
      return { avg_occupancy: 50, avg_vehicles: 0, data_points: 0 };
    }
  }

  async getPeakHours(lotId) {
    try {
      const result = await db.query(`
        SELECT 
          hour,
          AVG(occupancy_rate) as avg_occupancy
        FROM parking_analytics 
        WHERE parking_lot_id = $1 
          AND date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY hour
        ORDER BY avg_occupancy DESC
        LIMIT 3
      `, [lotId]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting peak hours:', error);
      return [];
    }
  }

  async train() {
    try {
      // Mock training with comprehensive analytics data
      const historicalData = await db.query(`
        SELECT 
          parking_lot_id,
          hour,
          EXTRACT(DOW FROM date) as day_of_week,
          occupancy_rate,
          total_vehicles
        FROM parking_analytics 
        WHERE date >= NOW() - INTERVAL '60 days'
        ORDER BY date DESC
        LIMIT 5000
      `);

      // Calculate model accuracy based on prediction vs actual patterns
      if (historicalData.rows.length > 0) {
        // Group by lot, hour, day patterns and calculate consistency
        const patterns = {};
        
        historicalData.rows.forEach(row => {
          const key = `${row.parking_lot_id}-${row.hour}-${row.day_of_week}`;
          if (!patterns[key]) {
            patterns[key] = [];
          }
          patterns[key].push(row.occupancy_rate);
        });

        // Calculate average consistency across patterns
        let totalConsistency = 0;
        let patternCount = 0;

        Object.values(patterns).forEach(rates => {
          if (rates.length > 1) {
            const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
            const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
            const consistency = Math.max(0, 1 - (variance / 2500)); // Normalize variance
            totalConsistency += consistency;
            patternCount++;
          }
        });

        if (patternCount > 0) {
          this.accuracy = totalConsistency / patternCount;
        }
      }

      this.lastTrained = new Date();
      console.log(`📊 Demand model trained with accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('❌ Error training demand model:', error);
    }
  }

  getStatus() {
    return {
      model_type: this.modelType,
      accuracy: this.accuracy,
      last_trained: this.lastTrained
    };
  }
}

module.exports = PredictionEngine;
