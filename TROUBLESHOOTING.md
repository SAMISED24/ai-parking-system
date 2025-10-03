# 🔧 AI Parking System - Troubleshooting Guide

## 🚨 Database Connection Issues

### **Problem**: `ECONNREFUSED ::1:5432` Error

This error means PostgreSQL is not running or not accessible.

### **Quick Solutions**:

#### **Option 1: Use Docker (Recommended)**

1. **Install Docker Desktop** (if not already installed):
   - Download from: https://www.docker.com/products/docker-desktop
   - Install and start Docker Desktop

2. **Start Database Services**:
   ```bash
   # Windows
   setup-database.bat
   
   # Linux/Mac
   chmod +x setup-database.sh
   ./setup-database.sh
   
   # Or manually
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Verify Database is Running**:
   ```bash
   docker ps
   # Should show ai-parking-postgres-dev container running
   ```

4. **Test Connection**:
   ```bash
   # Connect to database
   docker exec -it ai-parking-postgres-dev psql -U postgres -d ai_parking_system
   
   # List tables (should show parking system tables)
   \dt
   
   # Exit
   \q
   ```

#### **Option 2: Install PostgreSQL Locally**

1. **Download and Install PostgreSQL**:
   - Windows: https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql` or https://postgresapp.com/
   - Linux: `sudo apt-get install postgresql postgresql-contrib`

2. **Start PostgreSQL Service**:
   ```bash
   # Windows (as Administrator)
   net start postgresql-x64-15
   
   # Mac
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

3. **Create Database and User**:
   ```bash
   # Connect as postgres user
   psql -U postgres
   
   # Create database
   CREATE DATABASE ai_parking_system;
   
   # Create user (optional, or use postgres)
   CREATE USER parking_user WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE ai_parking_system TO parking_user;
   
   # Exit
   \q
   ```

4. **Run Database Schema**:
   ```bash
   psql -U postgres -d ai_parking_system -f database/init.sql
   ```

#### **Option 3: Use SQLite (Development Only)**

If you can't get PostgreSQL working, you can temporarily use SQLite:

1. **Install SQLite Dependencies**:
   ```bash
   cd backend
   npm install sqlite3
   ```

2. **Create SQLite Database Config** (`backend/config/database-sqlite.js`):
   ```javascript
   const sqlite3 = require('sqlite3').verbose();
   const path = require('path');
   
   const dbPath = path.join(__dirname, '../data/parking.db');
   
   // Create data directory if it doesn't exist
   const fs = require('fs');
   const dataDir = path.dirname(dbPath);
   if (!fs.existsSync(dataDir)) {
     fs.mkdirSync(dataDir, { recursive: true });
   }
   
   const db = new sqlite3.Database(dbPath);
   
   // Export compatible interface
   module.exports = {
     query: (text, params = []) => {
       return new Promise((resolve, reject) => {
         // Convert PostgreSQL queries to SQLite
         const sqliteQuery = text
           .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
           .replace(/CURRENT_TIMESTAMP/g, "datetime('now')")
           .replace(/JSONB/g, 'TEXT');
         
         db.all(sqliteQuery, params, (err, rows) => {
           if (err) reject(err);
           else resolve({ rows });
         });
       });
     }
   };
   ```

3. **Update Database Import** in `backend/server.js`:
   ```javascript
   // Replace
   const db = require('./config/database');
   
   // With
   const db = require('./config/database-sqlite');
   ```

### **Environment Configuration**

Create a `.env` file in the project root:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_parking_system
DB_USER=postgres
DB_PASSWORD=password

# Server Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

## 🐛 Common Issues and Solutions

### **Issue**: Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Kill the process
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Mac/Linux

# Or use different port
PORT=3001 npm run dev
```

### **Issue**: Node Modules Missing

**Error**: `Cannot find module 'express'`

**Solution**:
```bash
cd backend
npm install

cd ../frontend
npm install

cd ../ai-services
pip install -r requirements.txt
```

### **Issue**: Python/AI Services Not Working

**Error**: Python script errors or YOLO model issues

**Solution**:
```bash
# Install Python dependencies
cd ai-services
pip install -r requirements.txt

# For YOLO model issues, it will download automatically on first use
# Or download manually:
# pip install ultralytics
```

### **Issue**: Frontend Not Loading

**Error**: Blank page or connection refused

**Solution**:
```bash
# Check if backend is running
curl http://localhost:3000/api/health

# Start frontend
cd frontend
npm run dev

# Check for build errors
npm run build
```

### **Issue**: WebSocket Connection Failed

**Error**: Real-time updates not working

**Solution**:
1. Ensure backend is running on port 3000
2. Check CORS configuration in backend
3. Verify WebSocket connection in browser console

### **Issue**: File Upload Fails

**Error**: Video upload not working

**Solution**:
1. Check file size (max 500MB)
2. Verify supported formats (MP4, AVI, MOV, etc.)
3. Ensure uploads directory exists:
   ```bash
   mkdir -p backend/uploads
   ```

## 🔍 Debugging Steps

### **1. Check System Status**

```bash
# Check if services are running
docker ps                              # Docker containers
netstat -an | grep :3000              # Backend server
netstat -an | grep :5432              # PostgreSQL
netstat -an | grep :5173              # Frontend server
```

### **2. Check Logs**

```bash
# Backend logs
cd backend && npm run dev

# Database logs (Docker)
docker logs ai-parking-postgres-dev

# Frontend logs
cd frontend && npm run dev
```

### **3. Test Database Connection**

```bash
# Using psql
psql -h localhost -p 5432 -U postgres -d ai_parking_system

# Using Docker
docker exec -it ai-parking-postgres-dev psql -U postgres -d ai_parking_system
```

### **4. Test API Endpoints**

```bash
# Health check
curl http://localhost:3000/api/health

# Get parking lots
curl http://localhost:3000/api/parking/lots

# Login test
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🚀 Quick Start Commands

### **Full System Startup**:

```bash
# 1. Start database
docker-compose -f docker-compose.dev.yml up -d

# 2. Start backend (in new terminal)
cd backend
npm install
npm run dev

# 3. Start frontend (in new terminal)
cd frontend
npm install
npm run dev

# 4. Open browser
# http://localhost:5173
```

### **Reset Everything**:

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down -v

# Remove node modules
rm -rf backend/node_modules frontend/node_modules

# Reinstall
cd backend && npm install
cd ../frontend && npm install

# Restart
docker-compose -f docker-compose.dev.yml up -d
```

## 📞 Getting Help

If you're still having issues:

1. **Check the logs** for specific error messages
2. **Verify all prerequisites** are installed (Node.js, Docker, etc.)
3. **Try the reset steps** above
4. **Check firewall/antivirus** settings that might block ports
5. **Run on a different port** if there are conflicts

### **System Requirements**:
- Node.js 18+
- Docker Desktop (recommended) OR PostgreSQL 12+
- Python 3.8+ (for AI services)
- 4GB RAM minimum
- 10GB free disk space

### **Supported Platforms**:
- Windows 10/11
- macOS 10.15+
- Ubuntu 18.04+
- Other Linux distributions with Docker support


