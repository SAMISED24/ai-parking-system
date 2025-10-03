const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ai_parking_system',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', (client) => {
  console.log('🗄️  Connected to PostgreSQL database');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client:', err);
  process.exit(-1);
});

// Database helper functions
const db = {
  // Execute a query
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('📊 Query executed:', { text: text.substring(0, 100), duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
  },

  // Get a client from the pool for transactions
  getClient: async () => {
    try {
      const client = await pool.connect();
      return client;
    } catch (error) {
      console.error('❌ Error getting database client:', error);
      throw error;
    }
  },

  // Initialize database tables
  initializeTables: async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create parking_lots table
      await client.query(`
        CREATE TABLE IF NOT EXISTS parking_lots (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          total_slots INTEGER NOT NULL,
          video_url VARCHAR(500),
          slot_configuration JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create parking_slots table
      await client.query(`
        CREATE TABLE IF NOT EXISTS parking_slots (
          id SERIAL PRIMARY KEY,
          parking_lot_id INTEGER REFERENCES parking_lots(id) ON DELETE CASCADE,
          slot_number INTEGER NOT NULL,
          coordinates JSONB,
          is_occupied BOOLEAN DEFAULT false,
          last_status_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          current_duration INTEGER DEFAULT 0,
          predicted_vacancy_seconds INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(parking_lot_id, slot_number)
        )
      `);

      // Create video_analysis table
      await client.query(`
        CREATE TABLE IF NOT EXISTS video_analysis (
          id SERIAL PRIMARY KEY,
          parking_lot_id INTEGER REFERENCES parking_lots(id) ON DELETE CASCADE,
          video_filename VARCHAR(255) NOT NULL,
          processing_status VARCHAR(50) DEFAULT 'pending',
          analysis_data JSONB,
          error_message TEXT,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create users table for authentication
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create bookings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          parking_slot_id INTEGER REFERENCES parking_slots(id) ON DELETE CASCADE,
          booking_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          booking_end TIMESTAMP,
          estimated_duration INTEGER,
          actual_duration INTEGER,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create analytics table for historical data
      await client.query(`
        CREATE TABLE IF NOT EXISTS parking_analytics (
          id SERIAL PRIMARY KEY,
          parking_lot_id INTEGER REFERENCES parking_lots(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          hour INTEGER NOT NULL,
          occupancy_rate DECIMAL(5,2),
          total_vehicles INTEGER DEFAULT 0,
          revenue DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(parking_lot_id, date, hour)
        )
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_parking_slots_lot_id ON parking_slots(parking_lot_id);
        CREATE INDEX IF NOT EXISTS idx_parking_slots_occupied ON parking_slots(is_occupied);
        CREATE INDEX IF NOT EXISTS idx_video_analysis_lot_id ON video_analysis(parking_lot_id);
        CREATE INDEX IF NOT EXISTS idx_video_analysis_status ON video_analysis(processing_status);
        CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(parking_slot_id);
        CREATE INDEX IF NOT EXISTS idx_analytics_lot_date ON parking_analytics(parking_lot_id, date);
      `);

      await client.query('COMMIT');
      console.log('✅ Database tables initialized successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error initializing database tables:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Insert sample data for testing
  insertSampleData: async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if sample data already exists
      const existingLots = await client.query('SELECT COUNT(*) FROM parking_lots');
      if (parseInt(existingLots.rows[0].count) > 0) {
        console.log('📊 Sample data already exists, skipping insertion');
        await client.query('ROLLBACK');
        return;
      }

      // Insert sample parking lot
      const lotResult = await client.query(`
        INSERT INTO parking_lots (name, total_slots, slot_configuration, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        'Main Parking Lot',
        50,
        JSON.stringify({
          rows: 5,
          columns: 10,
          slot_width: 2.5,
          slot_height: 5.0
        }),
        true
      ]);

      const lotId = lotResult.rows[0].id;

      // Insert sample parking slots
      for (let i = 1; i <= 50; i++) {
        const row = Math.floor((i - 1) / 10);
        const col = (i - 1) % 10;
        const isOccupied = Math.random() < 0.3; // 30% occupancy rate
        
        await client.query(`
          INSERT INTO parking_slots (
            parking_lot_id, slot_number, coordinates, is_occupied, 
            current_duration, predicted_vacancy_seconds
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          lotId,
          i,
          JSON.stringify({
            x: col * 50 + 25,
            y: row * 100 + 50,
            width: 45,
            height: 90
          }),
          isOccupied,
          isOccupied ? Math.floor(Math.random() * 7200) : 0, // 0-2 hours
          isOccupied ? Math.floor(Math.random() * 3600) + 300 : 0 // 5-65 minutes
        ]);
      }

      // Insert sample admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await client.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
      `, ['admin', 'admin@parking.com', hashedPassword, 'admin']);

      // Insert sample analytics data for the last 7 days
      const today = new Date();
      for (let day = 0; day < 7; day++) {
        const date = new Date(today);
        date.setDate(date.getDate() - day);
        
        for (let hour = 0; hour < 24; hour++) {
          const occupancyRate = Math.random() * 100;
          const totalVehicles = Math.floor(occupancyRate * 0.5);
          const revenue = totalVehicles * (2 + Math.random() * 3); // $2-5 per vehicle
          
          await client.query(`
            INSERT INTO parking_analytics (parking_lot_id, date, hour, occupancy_rate, total_vehicles, revenue)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [lotId, date.toISOString().split('T')[0], hour, occupancyRate, totalVehicles, revenue]);
        }
      }

      await client.query('COMMIT');
      console.log('✅ Sample data inserted successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error inserting sample data:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Close the pool
  close: async () => {
    await pool.end();
    console.log('🔒 Database connection pool closed');
  }
};

// Initialize database on startup with retry logic
const initializeDatabase = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Attempting database connection (attempt ${i + 1}/${retries})...`);
      await db.initializeTables();
      await db.insertSampleData();
      console.log('✅ Database initialized successfully!');
      return;
    } catch (error) {
      console.error(`❌ Database initialization failed (attempt ${i + 1}/${retries}):`, error.message);
      
      if (i === retries - 1) {
        console.error('💀 All database connection attempts failed!');
        console.error('📋 Please ensure PostgreSQL is running:');
        console.error('   • Run: docker-compose -f docker-compose.dev.yml up -d');
        console.error('   • Or install PostgreSQL locally');
        console.error('   • Check connection details in .env file');
        return;
      }
      
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Start initialization
initializeDatabase();

module.exports = db;
