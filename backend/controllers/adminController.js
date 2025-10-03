const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const VideoAnalysis = require('../models/VideoAnalysis');
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

// Validation schemas
const createLotSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  total_slots: Joi.number().integer().min(1).max(1000).required(),
  video_url: Joi.string().uri().optional(),
  slot_configuration: Joi.object({
    rows: Joi.number().integer().min(1).required(),
    columns: Joi.number().integer().min(1).required(),
    slot_width: Joi.number().min(1).optional(),
    slot_height: Joi.number().min(1).optional()
  }).required()
});

const updateLotSchema = Joi.object({
  name: Joi.string().min(3).max(255).optional(),
  total_slots: Joi.number().integer().min(1).max(1000).optional(),
  video_url: Joi.string().uri().allow('').optional(),
  slot_configuration: Joi.object().optional(),
  is_active: Joi.boolean().optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const createUserSchema = Joi.object({
  username: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'user').default('user')
});

class AdminController {
  // Admin authentication
  static async login(req, res) {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const { username, password } = value;

      // Find user
      const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
      const result = await db.query(query, [username]);

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username, 
          role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({
        error: 'Login failed',
        message: error.message
      });
    }
  }

  // Create new user
  static async createUser(req, res) {
    try {
      const { error, value } = createUserSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const { username, email, password, role } = value;

      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'User with this username or email already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const query = `
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, role, created_at
      `;

      const result = await db.query(query, [username, email, hashedPassword, role]);
      const newUser = result.rows[0];

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          user: newUser
        }
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        error: 'Failed to create user',
        message: error.message
      });
    }
  }

  // Create new parking lot
  static async createParkingLot(req, res) {
    try {
      const { error, value } = createLotSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const { name, total_slots, video_url, slot_configuration } = value;

      // Create parking lot
      const parkingLot = await ParkingLot.create({
        name,
        total_slots,
        video_url,
        slot_configuration
      });

      // Create parking slots based on configuration
      const { rows, columns } = slot_configuration;
      const slotWidth = slot_configuration.slot_width || 2.5;
      const slotHeight = slot_configuration.slot_height || 5.0;

      const slots = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const slotNumber = row * columns + col + 1;
          
          if (slotNumber <= total_slots) {
            const slot = await ParkingSlot.create({
              parking_lot_id: parkingLot.id,
              slot_number: slotNumber,
              coordinates: {
                x: col * (slotWidth * 20) + (slotWidth * 10), // Convert to pixels
                y: row * (slotHeight * 20) + (slotHeight * 10),
                width: slotWidth * 18,
                height: slotHeight * 18
              }
            });
            slots.push(slot);
          }
        }
      }

      res.status(201).json({
        success: true,
        message: 'Parking lot created successfully',
        data: {
          parking_lot: parkingLot.toJSON(),
          slots_created: slots.length
        }
      });
    } catch (error) {
      console.error('Error creating parking lot:', error);
      res.status(500).json({
        error: 'Failed to create parking lot',
        message: error.message
      });
    }
  }

  // Update parking lot
  static async updateParkingLot(req, res) {
    try {
      const { lotId } = req.params;
      const { error, value } = updateLotSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      const parkingLot = await ParkingLot.findById(parseInt(lotId));
      if (!parkingLot) {
        return res.status(404).json({
          error: 'Parking lot not found'
        });
      }

      // Update parking lot
      await parkingLot.update(value);

      res.json({
        success: true,
        message: 'Parking lot updated successfully',
        data: {
          parking_lot: parkingLot.toJSON()
        }
      });
    } catch (error) {
      console.error('Error updating parking lot:', error);
      res.status(500).json({
        error: 'Failed to update parking lot',
        message: error.message
      });
    }
  }

  // Delete parking lot
  static async deleteParkingLot(req, res) {
    try {
      const { lotId } = req.params;

      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      const parkingLot = await ParkingLot.findById(parseInt(lotId));
      if (!parkingLot) {
        return res.status(404).json({
          error: 'Parking lot not found'
        });
      }

      await parkingLot.delete();

      res.json({
        success: true,
        message: 'Parking lot deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting parking lot:', error);
      res.status(500).json({
        error: 'Failed to delete parking lot',
        message: error.message
      });
    }
  }

  // Get system analytics
  static async getSystemAnalytics(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;

      // Defaults in case tables are missing or empty
      let overallStatistics = {
        total_lots: 0,
        total_slots: 0,
        occupied_slots: 0,
        overall_occupancy_rate: 0
      };

      let dailyAnalyticsRows = [];
      let hourlyAnalyticsRows = [];
      let processingStats = [];
      let recentActivityRows = [];

      // Get overall statistics (safe)
      try {
        const overallStats = await db.query(`
          SELECT 
            COUNT(DISTINCT pl.id) as total_lots,
            COUNT(ps.id) as total_slots,
            COUNT(CASE WHEN ps.is_occupied = true THEN 1 END) as occupied_slots,
            CASE 
              WHEN COUNT(ps.id) = 0 THEN 0
              ELSE ROUND(
                (COUNT(CASE WHEN ps.is_occupied = true THEN 1 END)::DECIMAL / NULLIF(COUNT(ps.id), 0)) * 100,
                2
              )
            END as overall_occupancy_rate
          FROM parking_lots pl
          LEFT JOIN parking_slots ps ON pl.id = ps.parking_lot_id
          WHERE pl.is_active = true
        `);
        overallStatistics = overallStats.rows[0] || overallStatistics;
      } catch (_) {}

      // Get daily analytics (safe)
      try {
        const dailyAnalytics = await db.query(`
          SELECT 
            date,
            COALESCE(AVG(occupancy_rate), 0) as avg_occupancy_rate,
            COALESCE(SUM(total_vehicles), 0) as total_vehicles,
            COALESCE(SUM(revenue), 0) as total_revenue
          FROM parking_analytics 
          WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY date
          ORDER BY date DESC
        `);
        dailyAnalyticsRows = dailyAnalytics.rows;
      } catch (_) {}

      // Get hourly analytics for today (safe)
      try {
        const hourlyAnalytics = await db.query(`
          SELECT 
            hour,
            COALESCE(AVG(occupancy_rate), 0) as avg_occupancy_rate,
            COALESCE(SUM(total_vehicles), 0) as total_vehicles,
            COALESCE(SUM(revenue), 0) as total_revenue
          FROM parking_analytics 
          WHERE date = CURRENT_DATE
          GROUP BY hour
          ORDER BY hour ASC
        `);
        hourlyAnalyticsRows = hourlyAnalytics.rows;
      } catch (_) {}

      // Get processing statistics (safe)
      try {
        processingStats = await VideoAnalysis.getProcessingStats();
      } catch (_) {}

      // Get recent activity (safe)
      try {
        const recentActivity = await db.query(`
          SELECT 
            'booking' as activity_type,
            ps.slot_number,
            pl.name as parking_lot_name,
            b.created_at as timestamp
          FROM bookings b
          JOIN parking_slots ps ON b.parking_slot_id = ps.id
          JOIN parking_lots pl ON ps.parking_lot_id = pl.id
          WHERE b.created_at >= NOW() - INTERVAL '24 hours'
          
          UNION ALL
          
          SELECT 
            'video_analysis' as activity_type,
            va.video_filename as slot_number,
            pl.name as parking_lot_name,
            va.created_at as timestamp
          FROM video_analysis va
          JOIN parking_lots pl ON va.parking_lot_id = pl.id
          WHERE va.created_at >= NOW() - INTERVAL '24 hours'
          
          ORDER BY timestamp DESC
          LIMIT 20
        `);
        recentActivityRows = recentActivity.rows;
      } catch (_) {}

      res.json({
        success: true,
        data: {
          overall_statistics: overallStatistics,
          daily_analytics: dailyAnalyticsRows,
          hourly_analytics: hourlyAnalyticsRows,
          processing_statistics: processingStats,
          recent_activity: recentActivityRows
        }
      });
    } catch (error) {
      console.error('Error getting system analytics:', error);
      // Return safe defaults instead of 500 to avoid breaking the dashboard
      res.json({
        success: true,
        data: {
          overall_statistics: {
            total_lots: 0,
            total_slots: 0,
            occupied_slots: 0,
            overall_occupancy_rate: 0
          },
          daily_analytics: [],
          hourly_analytics: [],
          processing_statistics: [],
          recent_activity: []
        },
        warning: 'System analytics degraded: ' + (error?.message || 'unknown error')
      });
    }
  }

  // Get parking lot analytics
  static async getParkingLotAnalytics(req, res) {
    try {
      const { lotId } = req.params;
      const days = parseInt(req.query.days) || 7;

      if (!lotId || isNaN(lotId)) {
        return res.status(400).json({
          error: 'Invalid parking lot ID'
        });
      }

      const parkingLot = await ParkingLot.findById(parseInt(lotId));
      if (!parkingLot) {
        return res.status(404).json({
          error: 'Parking lot not found'
        });
      }

      // Get lot analytics
      const analytics = await parkingLot.getAnalytics(days);
      const statistics = await parkingLot.getStatistics();
      const recentAnalyses = await parkingLot.getRecentAnalyses(10);

      // Get peak hours
      const peakHours = await db.query(`
        SELECT 
          hour,
          AVG(occupancy_rate) as avg_occupancy_rate
        FROM parking_analytics 
        WHERE parking_lot_id = $1 
          AND date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY hour
        ORDER BY avg_occupancy_rate DESC
        LIMIT 5
      `, [parseInt(lotId)]);

      res.json({
        success: true,
        data: {
          parking_lot: parkingLot.toJSON(),
          current_statistics: statistics,
          analytics: analytics,
          peak_hours: peakHours.rows,
          recent_analyses: recentAnalyses
        }
      });
    } catch (error) {
      console.error('Error getting parking lot analytics:', error);
      res.status(500).json({
        error: 'Failed to get parking lot analytics',
        message: error.message
      });
    }
  }

  // Get system configuration
  static async getSystemConfiguration(req, res) {
    try {
      // Get configuration from environment variables and database
      const config = {
        system: {
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0',
          uptime: process.uptime(),
          memory_usage: process.memoryUsage()
        },
        database: {
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || 5432,
          database: process.env.DB_NAME || 'ai_parking_system'
        },
        ai_services: {
          python_path: process.env.PYTHON_PATH || 'python',
          video_processing_enabled: true,
          max_file_size: '500MB'
        },
        features: {
          real_time_updates: true,
          video_analysis: true,
          chatbot: true,
          analytics: true
        }
      };

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Error getting system configuration:', error);
      res.status(500).json({
        error: 'Failed to get system configuration',
        message: error.message
      });
    }
  }

  // Update system configuration
  static async updateSystemConfiguration(req, res) {
    try {
      // This would typically update configuration in database or config files
      // For now, we'll just return the updated configuration
      const { configuration } = req.body;

      if (!configuration || typeof configuration !== 'object') {
        return res.status(400).json({
          error: 'Invalid configuration data'
        });
      }

      // In a real implementation, you would validate and save the configuration
      console.log('Configuration update requested:', configuration);

      res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: {
          updated_configuration: configuration
        }
      });
    } catch (error) {
      console.error('Error updating system configuration:', error);
      res.status(500).json({
        error: 'Failed to update system configuration',
        message: error.message
      });
    }
  }

  // Get all users
  static async getAllUsers(req, res) {
    try {
      const query = `
        SELECT 
          id, username, email, role, is_active, created_at, updated_at
        FROM users 
        ORDER BY created_at DESC
      `;

      const result = await db.query(query);

      res.json({
        success: true,
        data: {
          users: result.rows,
          count: result.rows.length
        }
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      res.status(500).json({
        error: 'Failed to get users',
        message: error.message
      });
    }
  }

  // Update user
  static async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const { username, email, role, is_active } = req.body;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          error: 'Invalid user ID'
        });
      }

      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (username) {
        fields.push(`username = $${paramIndex}`);
        values.push(username);
        paramIndex++;
      }

      if (email) {
        fields.push(`email = $${paramIndex}`);
        values.push(email);
        paramIndex++;
      }

      if (role) {
        fields.push(`role = $${paramIndex}`);
        values.push(role);
        paramIndex++;
      }

      if (typeof is_active === 'boolean') {
        fields.push(`is_active = $${paramIndex}`);
        values.push(is_active);
        paramIndex++;
      }

      if (fields.length === 0) {
        return res.status(400).json({
          error: 'No fields to update'
        });
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(userId));

      const query = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, role, is_active, created_at, updated_at
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        error: 'Failed to update user',
        message: error.message
      });
    }
  }

  // Delete user
  static async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          error: 'Invalid user ID'
        });
      }

      const query = `
        UPDATE users 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, username, email
      `;

      const result = await db.query(query, [parseInt(userId)]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User deactivated successfully',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        error: 'Failed to delete user',
        message: error.message
      });
    }
  }

  // Generate system report
  static async generateSystemReport(req, res) {
    try {
      const reportType = req.query.type || 'summary';
      const days = parseInt(req.query.days) || 30;

      let report = {};

      switch (reportType) {
        case 'occupancy':
          report = await AdminController.generateOccupancyReport(days);
          break;
        case 'revenue':
          report = await AdminController.generateRevenueReport(days);
          break;
        case 'performance':
          report = await AdminController.generatePerformanceReport(days);
          break;
        default:
          report = await AdminController.generateSummaryReport(days);
      }

      res.json({
        success: true,
        data: {
          report_type: reportType,
          period_days: days,
          generated_at: new Date().toISOString(),
          ...report
        }
      });
    } catch (error) {
      console.error('Error generating system report:', error);
      res.status(500).json({
        error: 'Failed to generate system report',
        message: error.message
      });
    }
  }

  // Helper methods for report generation
  static async generateSummaryReport(days) {
    const overallStats = await db.query(`
      SELECT 
        COUNT(DISTINCT pl.id) as total_lots,
        COUNT(ps.id) as total_slots,
        COUNT(CASE WHEN ps.is_occupied = true THEN 1 END) as occupied_slots
      FROM parking_lots pl
      LEFT JOIN parking_slots ps ON pl.id = ps.parking_lot_id
      WHERE pl.is_active = true
    `);

    const analytics = await db.query(`
      SELECT 
        AVG(occupancy_rate) as avg_occupancy_rate,
        SUM(total_vehicles) as total_vehicles,
        SUM(revenue) as total_revenue
      FROM parking_analytics 
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
    `);

    return {
      summary: overallStats.rows[0],
      analytics: analytics.rows[0]
    };
  }

  static async generateOccupancyReport(days) {
    const dailyOccupancy = await db.query(`
      SELECT 
        date,
        AVG(occupancy_rate) as avg_occupancy_rate,
        MAX(occupancy_rate) as max_occupancy_rate,
        MIN(occupancy_rate) as min_occupancy_rate
      FROM parking_analytics 
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY date
      ORDER BY date DESC
    `);

    return {
      daily_occupancy: dailyOccupancy.rows
    };
  }

  static async generateRevenueReport(days) {
    const revenueData = await db.query(`
      SELECT 
        date,
        SUM(revenue) as daily_revenue,
        SUM(total_vehicles) as daily_vehicles
      FROM parking_analytics 
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY date
      ORDER BY date DESC
    `);

    return {
      revenue_data: revenueData.rows
    };
  }

  static async generatePerformanceReport(days) {
    const processingStats = await VideoAnalysis.getProcessingStats();
    
    const systemMetrics = {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage()
    };

    return {
      processing_statistics: processingStats,
      system_metrics: systemMetrics
    };
  }
}

module.exports = AdminController;
