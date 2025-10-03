# 🚨 QUICK FIX: Database Connection Error

## The Problem
Your AI Parking System backend is trying to connect to PostgreSQL database, but PostgreSQL is not running. This causes the `ECONNREFUSED ::1:5432` error.

## ⚡ **FASTEST SOLUTION** (Recommended)

### **Step 1: Start Database with Docker**
```bash
# Run this command in your project root directory:
docker-compose -f docker-compose.dev.yml up -d
```

### **Step 2: Wait for Database**
```bash
# Wait 10-15 seconds for PostgreSQL to start, then check:
docker ps
```
You should see `ai-parking-postgres-dev` container running.

### **Step 3: Restart Your Backend**
- Stop your current backend (Ctrl+C)
- Start it again:
```bash
cd backend
npm run dev
```

## 🔄 **Alternative Solutions**

### **Option A: Use the Setup Script**
```bash
# Windows
setup-database.bat

# The script will:
# 1. Check if Docker is installed
# 2. Start PostgreSQL and Redis containers
# 3. Wait for them to be ready
```

### **Option B: Install PostgreSQL Locally**
If you don't want to use Docker:

1. **Download PostgreSQL**: https://www.postgresql.org/download/
2. **Install and start the service**
3. **Create database**:
   ```sql
   CREATE DATABASE ai_parking_system;
   ```
4. **Run the schema**:
   ```bash
   psql -U postgres -d ai_parking_system -f database/init.sql
   ```

### **Option C: Use Complete Startup Script**
```bash
# Windows
start-system.bat

# This will:
# 1. Check all dependencies
# 2. Install npm packages if needed
# 3. Start database
# 4. Start backend and frontend
```

## ✅ **Verify It's Working**

After starting the database, you should see:
```
✅ Database initialized successfully!
🚗 AI Parking System Backend running on port 3000
```

Instead of the connection errors.

## 🆘 **Still Having Issues?**

### **Check if PostgreSQL is Running**:
```bash
# Check Docker containers
docker ps

# Should show ai-parking-postgres-dev running on port 5432
```

### **Test Database Connection**:
```bash
# Connect to database
docker exec -it ai-parking-postgres-dev psql -U postgres -d ai_parking_system

# You should see a PostgreSQL prompt
# Type \q to exit
```

### **Check Environment Variables**:
Make sure you have a `.env` file in your project root with:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_parking_system
DB_USER=postgres
DB_PASSWORD=password
```

## 🎯 **Expected Result**

After fixing the database connection, you should see:
```
🔄 Attempting database connection (attempt 1/5)...
✅ Database initialized successfully!
📊 Sample data inserted successfully
🚗 AI Parking System Backend running on port 3000
📊 Environment: development
🔗 Frontend URL: http://localhost:5173
```

## 📞 **Need More Help?**

Check the full `TROUBLESHOOTING.md` file for detailed solutions to other common issues.

---

**TL;DR**: Run `docker-compose -f docker-compose.dev.yml up -d` to start PostgreSQL, then restart your backend server.


