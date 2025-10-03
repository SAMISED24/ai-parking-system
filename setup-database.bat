@echo off
echo 🚀 Setting up AI Parking System Database...
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✅ Docker found
echo.

REM Start PostgreSQL and Redis using Docker Compose
echo 🐳 Starting PostgreSQL and Redis containers...
docker-compose -f docker-compose.dev.yml up -d

REM Wait for PostgreSQL to be ready
echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak >nul

REM Check if PostgreSQL is running
docker-compose -f docker-compose.dev.yml ps postgres

echo.
echo ✅ Database setup complete!
echo.
echo 📋 Database Connection Details:
echo    Host: localhost
echo    Port: 5432
echo    Database: ai_parking_system
echo    Username: postgres
echo    Password: password
echo.
echo 🚀 You can now start the backend server with: npm run dev
echo.
pause
