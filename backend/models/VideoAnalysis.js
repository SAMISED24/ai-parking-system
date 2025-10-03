const db = require('../config/database');

class VideoAnalysis {
  constructor(data) {
    this.id = data.id;
    this.parking_lot_id = data.parking_lot_id;
    this.video_filename = data.video_filename;
    this.processing_status = data.processing_status;
    this.analysis_data = data.analysis_data;
    this.error_message = data.error_message;
    this.started_at = data.started_at;
    this.completed_at = data.completed_at;
    this.created_at = data.created_at;
  }

  // Create a new video analysis record
  static async create(analysisData) {
    try {
      const query = `
        INSERT INTO video_analysis (
          parking_lot_id, video_filename, processing_status, analysis_data
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const values = [
        analysisData.parking_lot_id,
        analysisData.video_filename,
        analysisData.processing_status || 'pending',
        JSON.stringify(analysisData.analysis_data || {})
      ];
      
      const result = await db.query(query, values);
      return new VideoAnalysis(result.rows[0]);
    } catch (error) {
      console.error('Error creating video analysis:', error);
      throw error;
    }
  }

  // Find video analysis by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM video_analysis WHERE id = $1';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new VideoAnalysis(result.rows[0]);
    } catch (error) {
      console.error('Error finding video analysis by ID:', error);
      throw error;
    }
  }

  // Find all analyses for a parking lot
  static async findByLotId(lotId, limit = 50) {
    try {
      const query = `
        SELECT * FROM video_analysis 
        WHERE parking_lot_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `;
      
      const result = await db.query(query, [lotId, limit]);
      return result.rows.map(row => new VideoAnalysis(row));
    } catch (error) {
      console.error('Error finding analyses by lot ID:', error);
      throw error;
    }
  }

  // Find analyses by status
  static async findByStatus(status, limit = 50) {
    try {
      const query = `
        SELECT * FROM video_analysis 
        WHERE processing_status = $1 
        ORDER BY created_at ASC 
        LIMIT $2
      `;
      
      const result = await db.query(query, [status, limit]);
      return result.rows.map(row => new VideoAnalysis(row));
    } catch (error) {
      console.error('Error finding analyses by status:', error);
      throw error;
    }
  }

  // Get pending analyses (for processing queue)
  static async getPendingAnalyses(limit = 10) {
    try {
      const query = `
        SELECT * FROM video_analysis 
        WHERE processing_status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      return result.rows.map(row => new VideoAnalysis(row));
    } catch (error) {
      console.error('Error getting pending analyses:', error);
      throw error;
    }
  }

  // Update processing status
  async updateStatus(status, errorMessage = null) {
    try {
      const query = `
        UPDATE video_analysis 
        SET 
          processing_status = $1,
          error_message = $2,
          completed_at = CASE 
            WHEN $1 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP 
            ELSE completed_at 
          END
        WHERE id = $3
        RETURNING *
      `;
      
      const result = await db.query(query, [status, errorMessage, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Video analysis not found');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error updating analysis status:', error);
      throw error;
    }
  }

  // Update analysis data
  async updateAnalysisData(analysisData) {
    try {
      const query = `
        UPDATE video_analysis 
        SET 
          analysis_data = $1,
          processing_status = CASE 
            WHEN processing_status = 'processing' THEN 'completed'
            ELSE processing_status 
          END,
          completed_at = CASE 
            WHEN processing_status = 'processing' THEN CURRENT_TIMESTAMP
            ELSE completed_at 
          END
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [JSON.stringify(analysisData), this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Video analysis not found');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error updating analysis data:', error);
      throw error;
    }
  }

  // Mark as processing
  async startProcessing() {
    try {
      const query = `
        UPDATE video_analysis 
        SET 
          processing_status = 'processing',
          started_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND processing_status = 'pending'
        RETURNING *
      `;
      
      const result = await db.query(query, [this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Video analysis not found or not in pending status');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error starting processing:', error);
      throw error;
    }
  }

  // Mark as completed with results
  async complete(analysisResults) {
    try {
      const query = `
        UPDATE video_analysis 
        SET 
          processing_status = 'completed',
          analysis_data = $1,
          completed_at = CURRENT_TIMESTAMP,
          error_message = NULL
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [JSON.stringify(analysisResults), this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Video analysis not found');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error completing analysis:', error);
      throw error;
    }
  }

  // Mark as failed with error
  async fail(errorMessage) {
    try {
      const query = `
        UPDATE video_analysis 
        SET 
          processing_status = 'failed',
          error_message = $1,
          completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [errorMessage, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Video analysis not found');
      }

      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error failing analysis:', error);
      throw error;
    }
  }

  // Get processing statistics
  static async getProcessingStats() {
    try {
      const query = `
        SELECT 
          processing_status,
          COUNT(*) as count,
          AVG(
            CASE 
              WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (completed_at - started_at))
              ELSE NULL 
            END
          ) as avg_processing_time_seconds
        FROM video_analysis 
        GROUP BY processing_status
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting processing stats:', error);
      throw error;
    }
  }

  // Get recent analyses with parking lot info
  static async getRecentWithLotInfo(limit = 20) {
    try {
      const query = `
        SELECT 
          va.*,
          pl.name as parking_lot_name
        FROM video_analysis va
        JOIN parking_lots pl ON va.parking_lot_id = pl.id
        ORDER BY va.created_at DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      return result.rows.map(row => ({
        ...new VideoAnalysis(row).toJSON(),
        parking_lot_name: row.parking_lot_name
      }));
    } catch (error) {
      console.error('Error getting recent analyses with lot info:', error);
      throw error;
    }
  }

  // Delete video analysis
  async delete() {
    try {
      const query = 'DELETE FROM video_analysis WHERE id = $1 RETURNING *';
      const result = await db.query(query, [this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Video analysis not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error deleting video analysis:', error);
      throw error;
    }
  }

  // Get analysis duration
  getProcessingDuration() {
    if (!this.started_at || !this.completed_at) {
      return null;
    }
    
    const start = new Date(this.started_at);
    const end = new Date(this.completed_at);
    return Math.round((end - start) / 1000); // Duration in seconds
  }

  // Check if analysis is complete
  isComplete() {
    return this.processing_status === 'completed';
  }

  // Check if analysis failed
  isFailed() {
    return this.processing_status === 'failed';
  }

  // Check if analysis is in progress
  isProcessing() {
    return this.processing_status === 'processing';
  }

  // Get slot detection results from analysis data
  getSlotDetections() {
    try {
      const data = typeof this.analysis_data === 'string' 
        ? JSON.parse(this.analysis_data) 
        : this.analysis_data;
      
      return data.slot_detections || [];
    } catch (error) {
      console.error('Error parsing slot detections:', error);
      return [];
    }
  }

  // Get vehicle count from analysis data
  getVehicleCount() {
    try {
      const data = typeof this.analysis_data === 'string' 
        ? JSON.parse(this.analysis_data) 
        : this.analysis_data;
      
      return data.vehicle_count || 0;
    } catch (error) {
      console.error('Error getting vehicle count:', error);
      return 0;
    }
  }

  // Convert to JSON (for API responses)
  toJSON() {
    return {
      id: this.id,
      parking_lot_id: this.parking_lot_id,
      video_filename: this.video_filename,
      processing_status: this.processing_status,
      analysis_data: typeof this.analysis_data === 'string' 
        ? JSON.parse(this.analysis_data) 
        : this.analysis_data,
      error_message: this.error_message,
      started_at: this.started_at,
      completed_at: this.completed_at,
      created_at: this.created_at,
      processing_duration: this.getProcessingDuration()
    };
  }
}

module.exports = VideoAnalysis;
