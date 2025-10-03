const db = require('../config/database');

class ParkingSlot {
  constructor(data) {
    this.id = data.id;
    this.parking_lot_id = data.parking_lot_id;
    this.slot_number = data.slot_number;
    this.coordinates = data.coordinates;
    this.is_occupied = data.is_occupied;
    this.last_status_change = data.last_status_change;
    this.current_duration = data.current_duration;
    this.predicted_vacancy_seconds = data.predicted_vacancy_seconds;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new parking slot
  static async create(slotData) {
    try {
      const query = `
        INSERT INTO parking_slots (
          parking_lot_id, slot_number, coordinates, is_occupied,
          current_duration, predicted_vacancy_seconds
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const values = [
        slotData.parking_lot_id,
        slotData.slot_number,
        JSON.stringify(slotData.coordinates || {}),
        slotData.is_occupied || false,
        slotData.current_duration || 0,
        slotData.predicted_vacancy_seconds || 0
      ];
      
      const result = await db.query(query, values);
      return new ParkingSlot(result.rows[0]);
    } catch (error) {
      console.error('Error creating parking slot:', error);
      throw error;
    }
  }

  // Find parking slot by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM parking_slots WHERE id = $1';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new ParkingSlot(result.rows[0]);
    } catch (error) {
      console.error('Error finding parking slot by ID:', error);
      throw error;
    }
  }

  // Find all slots for a parking lot
  static async findByLotId(lotId, includeOccupied = true) {
    try {
      let query = 'SELECT * FROM parking_slots WHERE parking_lot_id = $1';
      const values = [lotId];
      
      if (!includeOccupied) {
        query += ' AND is_occupied = false';
      }
      
      query += ' ORDER BY slot_number ASC';
      
      const result = await db.query(query, values);
      return result.rows.map(row => new ParkingSlot(row));
    } catch (error) {
      console.error('Error finding slots by lot ID:', error);
      throw error;
    }
  }

  // Get available slots for a parking lot
  static async getAvailableSlots(lotId) {
    try {
      const query = `
        SELECT * FROM parking_slots 
        WHERE parking_lot_id = $1 AND is_occupied = false
        ORDER BY slot_number ASC
      `;
      
      const result = await db.query(query, [lotId]);
      return result.rows.map(row => new ParkingSlot(row));
    } catch (error) {
      console.error('Error getting available slots:', error);
      throw error;
    }
  }

  // Get occupied slots for a parking lot
  static async getOccupiedSlots(lotId) {
    try {
      const query = `
        SELECT * FROM parking_slots 
        WHERE parking_lot_id = $1 AND is_occupied = true
        ORDER BY slot_number ASC
      `;
      
      const result = await db.query(query, [lotId]);
      return result.rows.map(row => new ParkingSlot(row));
    } catch (error) {
      console.error('Error getting occupied slots:', error);
      throw error;
    }
  }

  // Update slot status
  async updateStatus(isOccupied, predictionSeconds = null) {
    try {
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');

        // Capture prior occupancy state before updating
        const wasOccupied = this.is_occupied === true;

        // Update the slot status
        const query = `
          UPDATE parking_slots 
          SET 
            is_occupied = $1,
            last_status_change = CURRENT_TIMESTAMP,
            current_duration = CASE 
              WHEN $1 = true THEN 0 
              ELSE current_duration 
            END,
            predicted_vacancy_seconds = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *
        `;
        
        const result = await client.query(query, [
          isOccupied, 
          predictionSeconds || 0, 
          this.id
        ]);

        if (result.rows.length === 0) {
          throw new Error('Parking slot not found');
        }

        // Update current instance with new DB values
        Object.assign(this, result.rows[0]);

        // If slot transitioned from vacant -> occupied, create a booking record
        if (isOccupied && !wasOccupied) {
          await client.query(`
            INSERT INTO bookings (parking_slot_id, estimated_duration, status)
            VALUES ($1, $2, 'active')
          `, [this.id, predictionSeconds || 3600]); // Default 1 hour
        }

        // If slot transitioned from occupied -> vacant, complete the booking
        if (!isOccupied && wasOccupied) {
          await client.query(`
            UPDATE bookings 
            SET 
              booking_end = CURRENT_TIMESTAMP,
              actual_duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - booking_start)),
              status = 'completed'
            WHERE parking_slot_id = $1 AND status = 'active'
          `, [this.id]);
        }

        await client.query('COMMIT');
        return this;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error updating slot status:', error);
      throw error;
    }
  }

  // Update slot coordinates
  async updateCoordinates(coordinates) {
    try {
      const query = `
        UPDATE parking_slots 
        SET coordinates = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [JSON.stringify(coordinates), this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Parking slot not found');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error updating slot coordinates:', error);
      throw error;
    }
  }

  // Update current duration (for occupied slots)
  async updateDuration() {
    try {
      if (!this.is_occupied) {
        return this;
      }

      const query = `
        UPDATE parking_slots 
        SET 
          current_duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_status_change)),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Parking slot not found');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error updating slot duration:', error);
      throw error;
    }
  }

  // Bulk update slot statuses (for video analysis results)
  static async bulkUpdateStatuses(slotUpdates) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const results = [];
      
      for (const update of slotUpdates) {
        const query = `
          UPDATE parking_slots 
          SET 
            is_occupied = $1,
            last_status_change = CASE 
              WHEN is_occupied != $1 THEN CURRENT_TIMESTAMP 
              ELSE last_status_change 
            END,
            current_duration = CASE 
              WHEN $1 = true AND is_occupied = false THEN 0
              WHEN $1 = false THEN 0
              ELSE current_duration 
            END,
            predicted_vacancy_seconds = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *
        `;
        
        const result = await client.query(query, [
          update.is_occupied,
          update.predicted_vacancy_seconds || 0,
          update.slot_id
        ]);

        if (result.rows.length > 0) {
          results.push(new ParkingSlot(result.rows[0]));
        }
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error bulk updating slot statuses:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete parking slot
  async delete() {
    try {
      const query = 'DELETE FROM parking_slots WHERE id = $1 RETURNING *';
      const result = await db.query(query, [this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Parking slot not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error deleting parking slot:', error);
      throw error;
    }
  }

  // Get slot booking history
  async getBookingHistory(limit = 10) {
    try {
      const query = `
        SELECT 
          b.*,
          u.username,
          u.email
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.parking_slot_id = $1
        ORDER BY b.created_at DESC
        LIMIT $2
      `;
      
      const result = await db.query(query, [this.id, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting booking history:', error);
      throw error;
    }
  }

  // Get current booking for this slot
  async getCurrentBooking() {
    try {
      const query = `
        SELECT 
          b.*,
          u.username,
          u.email
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.parking_slot_id = $1 AND b.status = 'active'
        ORDER BY b.created_at DESC
        LIMIT 1
      `;
      
      const result = await db.query(query, [this.id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting current booking:', error);
      throw error;
    }
  }

  // Convert to JSON (for API responses)
  toJSON() {
    return {
      id: this.id,
      parking_lot_id: this.parking_lot_id,
      slot_number: this.slot_number,
      coordinates: typeof this.coordinates === 'string' 
        ? JSON.parse(this.coordinates) 
        : this.coordinates,
      is_occupied: this.is_occupied,
      last_status_change: this.last_status_change,
      current_duration: parseInt(this.current_duration) || 0,
      predicted_vacancy_seconds: parseInt(this.predicted_vacancy_seconds) || 0,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = ParkingSlot;
