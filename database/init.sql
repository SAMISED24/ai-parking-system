-- AI Parking System Database Initialization Script
-- PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create parking_lots table
CREATE TABLE IF NOT EXISTS parking_lots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    total_slots INTEGER NOT NULL CHECK (total_slots > 0),
    video_url VARCHAR(500),
    slot_configuration JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create parking_slots table
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
);

-- Create video_analysis table
CREATE TABLE IF NOT EXISTS video_analysis (
    id SERIAL PRIMARY KEY,
    parking_lot_id INTEGER REFERENCES parking_lots(id) ON DELETE CASCADE,
    video_filename VARCHAR(255) NOT NULL,
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    analysis_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'operator')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parking_slot_id INTEGER REFERENCES parking_slots(id) ON DELETE CASCADE,
    booking_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    booking_end TIMESTAMP,
    estimated_duration INTEGER, -- in seconds
    actual_duration INTEGER, -- in seconds
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create parking_analytics table for historical data
CREATE TABLE IF NOT EXISTS parking_analytics (
    id SERIAL PRIMARY KEY,
    parking_lot_id INTEGER REFERENCES parking_lots(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    occupancy_rate DECIMAL(5,2) CHECK (occupancy_rate >= 0 AND occupancy_rate <= 100),
    total_vehicles INTEGER DEFAULT 0 CHECK (total_vehicles >= 0),
    revenue DECIMAL(10,2) DEFAULT 0 CHECK (revenue >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parking_lot_id, date, hour)
);

-- Create system_logs table for audit trail
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chatbot_conversations table
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    intent VARCHAR(100),
    confidence DECIMAL(3,2),
    entities JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parking_slots_lot_id ON parking_slots(parking_lot_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_occupied ON parking_slots(is_occupied);
CREATE INDEX IF NOT EXISTS idx_parking_slots_status_change ON parking_slots(last_status_change);

CREATE INDEX IF NOT EXISTS idx_video_analysis_lot_id ON video_analysis(parking_lot_id);
CREATE INDEX IF NOT EXISTS idx_video_analysis_status ON video_analysis(processing_status);
CREATE INDEX IF NOT EXISTS idx_video_analysis_created ON video_analysis(created_at);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(parking_slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(booking_start);

CREATE INDEX IF NOT EXISTS idx_analytics_lot_date ON parking_analytics(parking_lot_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_date_hour ON parking_analytics(date, hour);

CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_chatbot_session ON chatbot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_user ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_created ON chatbot_conversations(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_parking_lots_updated_at 
    BEFORE UPDATE ON parking_lots 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parking_slots_updated_at 
    BEFORE UPDATE ON parking_slots 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
-- Create default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role) 
VALUES ('admin', 'admin@parking.com', '$2b$10$rQZ8Qx0jKqZ8Qx0jKqZ8QuKqZ8Qx0jKqZ8Qx0jKqZ8Qx0jKqZ8Qx0j', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Create sample user (password: user123)
INSERT INTO users (username, email, password_hash, role) 
VALUES ('user', 'user@parking.com', '$2b$10$rQZ8Qx0jKqZ8Qx0jKqZ8QuKqZ8Qx0jKqZ8Qx0jKqZ8Qx0jKqZ8Qx0j', 'user')
ON CONFLICT (username) DO NOTHING;

-- Create sample parking lot
INSERT INTO parking_lots (name, total_slots, slot_configuration, is_active)
VALUES (
    'Main Parking Lot',
    50,
    '{
        "rows": 5,
        "columns": 10,
        "slot_width": 2.5,
        "slot_height": 5.0,
        "layout_type": "grid"
    }',
    true
) ON CONFLICT DO NOTHING;

-- Create sample parking slots for the main lot
DO $$
DECLARE
    lot_id INTEGER;
    i INTEGER;
    row_num INTEGER;
    col_num INTEGER;
BEGIN
    -- Get the lot ID
    SELECT id INTO lot_id FROM parking_lots WHERE name = 'Main Parking Lot' LIMIT 1;
    
    -- Create 50 parking slots
    FOR i IN 1..50 LOOP
        row_num := (i - 1) / 10;
        col_num := (i - 1) % 10;
        
        INSERT INTO parking_slots (
            parking_lot_id, 
            slot_number, 
            coordinates, 
            is_occupied,
            current_duration,
            predicted_vacancy_seconds
        )
        VALUES (
            lot_id,
            i,
            json_build_object(
                'x', col_num * 50 + 25,
                'y', row_num * 100 + 50,
                'width', 45,
                'height', 90
            ),
            CASE WHEN random() < 0.3 THEN true ELSE false END, -- 30% occupancy
            CASE WHEN random() < 0.3 THEN floor(random() * 7200)::INTEGER ELSE 0 END, -- 0-2 hours
            CASE WHEN random() < 0.3 THEN floor(random() * 3600 + 300)::INTEGER ELSE 0 END -- 5-65 minutes
        )
        ON CONFLICT (parking_lot_id, slot_number) DO NOTHING;
    END LOOP;
END $$;

-- Create sample analytics data for the last 7 days
DO $$
DECLARE
    lot_id INTEGER;
    day_offset INTEGER;
    hour_val INTEGER;
    current_date DATE;
    occupancy_rate DECIMAL(5,2);
    total_vehicles INTEGER;
    revenue DECIMAL(10,2);
BEGIN
    -- Get the lot ID
    SELECT id INTO lot_id FROM parking_lots WHERE name = 'Main Parking Lot' LIMIT 1;
    
    -- Generate data for last 7 days
    FOR day_offset IN 0..6 LOOP
        current_date := CURRENT_DATE - day_offset;
        
        -- Generate data for each hour of the day
        FOR hour_val IN 0..23 LOOP
            -- Generate realistic occupancy patterns
            occupancy_rate := CASE 
                WHEN hour_val BETWEEN 8 AND 17 THEN 60 + random() * 30 -- Business hours: 60-90%
                WHEN hour_val BETWEEN 18 AND 22 THEN 40 + random() * 40 -- Evening: 40-80%
                ELSE 10 + random() * 30 -- Night/early morning: 10-40%
            END;
            
            total_vehicles := floor(occupancy_rate * 50 / 100)::INTEGER;
            revenue := total_vehicles * (2 + random() * 3); -- $2-5 per vehicle
            
            INSERT INTO parking_analytics (
                parking_lot_id, 
                date, 
                hour, 
                occupancy_rate, 
                total_vehicles, 
                revenue
            )
            VALUES (
                lot_id,
                current_date,
                hour_val,
                occupancy_rate,
                total_vehicles,
                revenue
            )
            ON CONFLICT (parking_lot_id, date, hour) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Create sample bookings
DO $$
DECLARE
    user_id INTEGER;
    slot_id INTEGER;
    i INTEGER;
BEGIN
    -- Get user ID
    SELECT id INTO user_id FROM users WHERE username = 'user' LIMIT 1;
    
    -- Create some sample bookings
    FOR i IN 1..10 LOOP
        -- Get a random occupied slot
        SELECT id INTO slot_id FROM parking_slots 
        WHERE is_occupied = true 
        ORDER BY random() 
        LIMIT 1;
        
        IF slot_id IS NOT NULL THEN
            INSERT INTO bookings (
                user_id,
                parking_slot_id,
                booking_start,
                estimated_duration,
                status
            )
            VALUES (
                user_id,
                slot_id,
                CURRENT_TIMESTAMP - (random() * interval '2 hours'),
                floor(random() * 7200 + 1800)::INTEGER, -- 30 minutes to 2 hours
                'active'
            );
        END IF;
    END LOOP;
END $$;

-- Create sample video analysis records
DO $$
DECLARE
    lot_id INTEGER;
    i INTEGER;
    status_val VARCHAR(50);
BEGIN
    -- Get the lot ID
    SELECT id INTO lot_id FROM parking_lots WHERE name = 'Main Parking Lot' LIMIT 1;
    
    -- Create sample video analysis records
    FOR i IN 1..5 LOOP
        status_val := CASE 
            WHEN i <= 3 THEN 'completed'
            WHEN i = 4 THEN 'processing'
            ELSE 'pending'
        END;
        
        INSERT INTO video_analysis (
            parking_lot_id,
            video_filename,
            processing_status,
            analysis_data,
            started_at,
            completed_at
        )
        VALUES (
            lot_id,
            'sample-video-' || i || '.mp4',
            status_val,
            CASE 
                WHEN status_val = 'completed' THEN 
                    json_build_object(
                        'processing_time', 15.5 + random() * 20,
                        'total_frames', floor(random() * 500 + 100)::INTEGER,
                        'vehicle_count', floor(random() * 15 + 5)::INTEGER,
                        'occupancy_rate', 60 + random() * 30,
                        'confidence_scores', json_build_object(
                            'overall', 0.85 + random() * 0.15,
                            'vehicle_detection', 0.90 + random() * 0.10,
                            'slot_classification', 0.80 + random() * 0.20
                        )
                    )
                ELSE '{}'::jsonb
            END,
            CASE WHEN status_val != 'pending' THEN CURRENT_TIMESTAMP - (random() * interval '1 hour') ELSE NULL END,
            CASE WHEN status_val = 'completed' THEN CURRENT_TIMESTAMP - (random() * interval '30 minutes') ELSE NULL END
        );
    END LOOP;
END $$;

-- Create sample system logs
INSERT INTO system_logs (user_id, action, entity_type, entity_id, details)
SELECT 
    u.id,
    'login',
    'user',
    u.id,
    json_build_object('timestamp', CURRENT_TIMESTAMP, 'success', true)
FROM users u
WHERE u.username IN ('admin', 'user');

-- Create sample chatbot conversations
DO $$
DECLARE
    user_id INTEGER;
    session_uuid UUID;
BEGIN
    -- Get user ID
    SELECT id INTO user_id FROM users WHERE username = 'user' LIMIT 1;
    session_uuid := uuid_generate_v4();
    
    -- Create sample conversation
    INSERT INTO chatbot_conversations (session_id, user_id, user_message, bot_response, intent, confidence)
    VALUES 
        (session_uuid, user_id, 'Where can I find parking?', 'I can help you find available parking! Based on current data, there are 18 available spots in the main parking lot.', 'find_parking', 0.95),
        (session_uuid, user_id, 'How much does it cost?', 'Parking rates are $2 per hour for the first 3 hours, then $5 per hour after that. Daily maximum is $25.', 'check_pricing', 0.90),
        (session_uuid, user_id, 'Thank you!', 'You''re welcome! Feel free to ask if you need any more help with parking.', 'general', 0.85);
END $$;

-- Create views for common queries
CREATE OR REPLACE VIEW parking_lot_summary AS
SELECT 
    pl.id,
    pl.name,
    pl.total_slots,
    COUNT(ps.id) as configured_slots,
    COUNT(CASE WHEN ps.is_occupied = true THEN 1 END) as occupied_slots,
    COUNT(CASE WHEN ps.is_occupied = false THEN 1 END) as available_slots,
    ROUND(
        (COUNT(CASE WHEN ps.is_occupied = true THEN 1 END)::DECIMAL / NULLIF(COUNT(ps.id), 0)) * 100, 
        2
    ) as current_occupancy_rate,
    pl.is_active,
    pl.created_at,
    pl.updated_at
FROM parking_lots pl
LEFT JOIN parking_slots ps ON pl.id = ps.parking_lot_id
GROUP BY pl.id, pl.name, pl.total_slots, pl.is_active, pl.created_at, pl.updated_at;

CREATE OR REPLACE VIEW recent_video_analysis AS
SELECT 
    va.id,
    va.parking_lot_id,
    pl.name as parking_lot_name,
    va.video_filename,
    va.processing_status,
    va.analysis_data,
    va.error_message,
    va.started_at,
    va.completed_at,
    va.created_at,
    CASE 
        WHEN va.completed_at IS NOT NULL AND va.started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (va.completed_at - va.started_at))
        ELSE NULL 
    END as processing_duration_seconds
FROM video_analysis va
JOIN parking_lots pl ON va.parking_lot_id = pl.id
ORDER BY va.created_at DESC;

CREATE OR REPLACE VIEW daily_analytics_summary AS
SELECT 
    pa.parking_lot_id,
    pl.name as parking_lot_name,
    pa.date,
    AVG(pa.occupancy_rate) as avg_occupancy_rate,
    MAX(pa.occupancy_rate) as peak_occupancy_rate,
    MIN(pa.occupancy_rate) as min_occupancy_rate,
    SUM(pa.total_vehicles) as total_vehicles,
    SUM(pa.revenue) as total_revenue
FROM parking_analytics pa
JOIN parking_lots pl ON pa.parking_lot_id = pl.id
GROUP BY pa.parking_lot_id, pl.name, pa.date
ORDER BY pa.date DESC;

-- Grant permissions (adjust as needed for your security requirements)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO parking_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO parking_app;

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'AI Parking System database initialized successfully!';
    RAISE NOTICE 'Sample data created with:';
    RAISE NOTICE '- 1 parking lot with 50 slots';
    RAISE NOTICE '- 2 users (admin/admin123, user/user123)';
    RAISE NOTICE '- 7 days of analytics data';
    RAISE NOTICE '- Sample bookings and video analysis records';
END $$;
