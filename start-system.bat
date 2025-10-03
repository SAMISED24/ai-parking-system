@echo off
echo Starting AI Parking System...
echo.

echo [1/3] Starting PostgreSQL Database...
echo Make sure PostgreSQL is running on port 5432
echo.

echo [2/3] Starting Backend Server...
cd backend
start "Backend Server" cmd /k "npm start"
cd ..
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Server...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..

echo.
echo ✅ System Starting!
echo.
echo 📊 Backend:  http://localhost:3000
echo 🎨 Frontend: http://localhost:5173
echo 💾 Database: PostgreSQL on port 5432
echo.
echo Press any key to exit...
pause >nul