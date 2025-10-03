const db = require('../config/database');

class ParkingLot {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.total_slots = data.total_slots;
    this.video_url = data.video_url;
    this.slot_configuration = data.slot_configuration;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new parking lot
  static async create(lotData) {
    try {
      const query = `
        INSERT INTO parking_lots (name, total_slots, video_url, slot_configuration, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const values = [
        lotData.name,
        lotData.total_slots,
        lotData.video_url || null,
        JSON.stringify(lotData.slot_configuration || {}),
        lotData.is_active !== undefined ? lotData.is_active : true
      ];
      
      const result = await db.query(query, values);
      return new ParkingLot(result.rows[0]);
    } catch (error) {
      console.error('Error creating parking lot:', error);
      throw error;
    }
  }

  // Find parking lot by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM parking_lots WHERE id = $1';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new ParkingLot(result.rows[0]);
    } catch (error) {
      console.error('Error finding parking lot by ID:', error);
      throw error;
    }
  }

  // Get all parking lots
  static async findAll(includeInactive = false) {
    try {
      let query = 'SELECT * FROM parking_lots';
      const values = [];
      
      if (!includeInactive) {
        query += ' WHERE is_active = $1';
        values.push(true);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await db.query(query, values);
      return result.rows.map(row => new ParkingLot(row));
    } catch (error) {
      console.error('Error finding all parking lots:', error);
      throw error;
    }
  }

  // Update parking lot
  async update(updateData) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = $${paramIndex}`);
          if (key === 'slot_configuration' && typeof updateData[key] === 'object') {
            values.push(JSON.stringify(updateData[key]));
          } else {
            values.push(updateData[key]);
          }
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(this.id);

      const query = `
        UPDATE parking_lots 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Parking lot not found');
      }

      // Update current instance
      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error updating parking lot:', error);
      throw error;
    }
  }

  // Delete parking lot (soft delete by setting is_active to false)
  async delete() {
    try {
      const query = `
        UPDATE parking_lots 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Parking lot not found');
      }

      this.is_active = false;
      return this;
    } catch (error) {
      console.error('Error deleting parking lot:', error);
      throw error;
    }
  }

  // Get parking lot statistics
  async getStatistics() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_slots,
          COUNT(CASE WHEN is_occupied = true THEN 1 END) as occupied_slots,
          COUNT(CASE WHEN is_occupied = false THEN 1 END) as available_slots,
          ROUND(
            (COUNT(CASE WHEN is_occupied = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
            2
          ) as occupancy_rate
        FROM parking_slots 
        WHERE parking_lot_id = $1
      `;
      
      const result = await db.query(query, [this.id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting parking lot statistics:', error);
      throw error;
    }
  }

  // Get parking slots for this lot
  async getSlots() {
    try {
      const ParkingSlot = require('./ParkingSlot');
      return await ParkingSlot.findByLotId(this.id);
    } catch (error) {
      console.error('Error getting parking slots:', error);
      throw error;
    }
  }

  // Get recent video analyses for this lot
  async getRecentAnalyses(limit = 10) {
    try {
      const query = `
        SELECT * FROM video_analysis 
        WHERE parking_lot_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `;
      
      const result = await db.query(query, [this.id, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting recent analyses:', error);
      throw error;
    }
  }

  // Get analytics data for this lot
  async getAnalytics(days = 7) {
    try {
      const query = `
        SELECT 
          date,
          hour,
          occupancy_rate,
          total_vehicles,
          revenue
        FROM parking_analytics 
        WHERE parking_lot_id = $1 
          AND date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC, hour DESC
      `;
      
      const result = await db.query(query, [this.id]);
      return result.rows;
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  // Convert to JSON (for API responses)
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      total_slots: this.total_slots,
      video_url: this.video_url,
      slot_configuration: typeof this.slot_configuration === 'string' 
        ? JSON.parse(this.slot_configuration) 
        : this.slot_configuration,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = ParkingLot;
