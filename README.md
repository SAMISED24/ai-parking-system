# AI Parking System

An end-to-end intelligent parking management platform with real-time slot tracking, admin and user dashboards, AI-powered video analysis (YOLO + OpenCV), and WebSocket live updates.

## Table of Contents
- Features
- Architecture
- Tech Stack
- Quick Start
- Configuration (.env)
- Database Setup
- Running (Manual & Docker)
- Workflows (Admin/User)
- Video Analysis Pipeline
- Slot Mapping Guidance
- API Overview (selected)
- Scripts
- Troubleshooting
- Production Notes
- License

## Features
- Admin and User portals (Vite + React)
- JWT auth with role-based access
- Parking lots, slots, booking/releasing
- Live updates via Socket.IO
- Video uploads and asynchronous analysis using Python (YOLOv8n)
- Processing queue, recent analyses, analytics (safe defaults)
- Force-delete processing analyses, cancel pending
- Robust API with validation and DB transactions (PostgreSQL)

## Architecture
```
frontend/        # React app (Vite, Tailwind)
backend/         # Node.js/Express API + WebSocket + PostgreSQL
ai-services/     # Python video processor (YOLO + OpenCV)
database/        # init.sql schema & seed
```
Data flow:
1) User/Admin uploads a video → backend stores file → creates `video_analysis` row.
2) Backend spawns Python process with slot config → Python returns JSON results.
3) Backend updates DB and emits `slot-status-changed` and `video-processing-*` events.
4) Frontend updates dashboards in real time.

## Tech Stack
- Frontend: React 18, Vite, TailwindCSS, react-hot-toast
- Backend: Node.js 18+, Express, Socket.IO, Joi, jsonwebtoken, Multer
- Database: PostgreSQL (SQL schema in `database/init.sql`)
- AI: Python 3.9–3.11, OpenCV, Ultralytics/YOLO

## Quick Start
Prereqs: Node.js 18+, npm, Python 3.9–3.11, PostgreSQL 13+, Git.

1) Clone
```
git clone <your-repo-url>
cd "Parking system"
```

2) Environment variables
- backend/.env
```
PORT=3001
JWT_SECRET=change-me
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_parking_system
DB_USER=postgres
DB_PASSWORD=postgres
PYTHON_PATH=python
NODE_ENV=development
```
- frontend/.env
```
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```
- ai-services/.env (optional)
```
YOLO_MODEL_PATH=../backend/yolov8n.pt
```

3) Install deps
```
# Backend
cd backend && npm ci

# AI services
cd ../ai-services
python -m venv .venv
# Windows
.venv\Scripts\pip install -r requirements.txt
# Linux/Mac
. .venv/bin/activate && pip install -r requirements.txt

# Frontend
cd ../frontend && npm ci
```

4) Initialize DB
```
# Windows
../setup-database.bat
# Mac/Linux
bash ../setup-database.sh
# Or
psql -h localhost -U postgres -f ../database/init.sql
```

5) Run
- Terminal A
```
cd backend
npm run dev
```
- Terminal B
```
cd frontend
npm run dev
# http://localhost:5173
```

Optional: Docker
```
docker compose up --build
# API http://localhost:3001, App http://localhost:5173
```

## Configuration Notes
- `backend/yolov8n.pt` lightweight model is referenced; replace with your own if needed.
- `PYTHON_PATH` must resolve to the Python used to install `ai-services/requirements.txt`.

## Database Setup
`database/init.sql` creates tables: `users`, `parking_lots`, `parking_slots`, `video_analysis`, `bookings`, `parking_analytics` (optional analytics). Seed includes a demo lot. Rerun scripts to reset.

## Running Workflows
### Admin
- Login → Admin Panel
- Parking Lots: create/edit lots; see slots and their states
- Video Analysis: upload video (.mp4 etc.), pick lot; manage queue (cancel/force-delete)
- Dashboard: overview, recent analyses, system health

### User
- Choose lot → see available/occupied slots
- Click a slot → Book This Slot; live updates propagate via WebSocket

## Video Analysis Pipeline
- Upload → `POST /api/video/upload` (multer)
- Backend validates, creates `video_analysis` row (pending), launches Python with args:
  - `--video_path`, `--analysis_type`, `--slot_config` (JSON), `--output_format json`
- Python returns detections; backend updates slots in bulk and marks analysis completed.

## Slot Mapping Guidance
Accurate results require slot rectangles aligned with the video frame.
- Current lot creation auto-generates a coarse grid; adjust by editing slot coordinates in DB or extend UI to draw rectangles.
- Each slot coordinates shape:
```
{"x": 100, "y": 220, "width": 60, "height": 120}
```
- Python expects `slot_config = [{ id, slot_number, coordinates }]`.

## API Overview (selected)
- Auth
  - POST `/api/admin/login`
- Admin
  - GET `/api/admin/analytics/system`
  - GET `/api/admin/analytics/parking-lot/:lotId`
  - POST `/api/admin/parking-lots`
  - PUT `/api/admin/parking-lots/:lotId`
  - DELETE `/api/admin/parking-lots/:lotId`
- Parking
  - GET `/api/parking/lots`
  - GET `/api/parking/status/:lotId`
  - POST `/api/parking/book-slot`
  - POST `/api/parking/release-slot/:slotId`
- Video
  - POST `/api/video/upload`
  - POST `/api/video/cancel-analysis/:analysisId`
  - DELETE `/api/video/analysis/:analysisId` (force deletes even if processing)

## Scripts
- Windows quick start: `start-system.bat`
- DB init: `setup-database.bat` / `setup-database.sh`

## Troubleshooting
- Analytics 500: endpoint returns defaults; hard refresh app.
- Cannot delete processing analysis: backend supports force-delete; restart backend after pulling.
- Booking “does nothing”: ensure vacant slot, check Network `POST /api/parking/book-slot` returns 200; Refresh if UI stale.
- Python OpenCV errors: ensure VC++ runtime (Windows) and matching Python version. Verify `python -c "import cv2; print(cv2.__version__)"`.
- WebSocket not updating: confirm `VITE_WS_URL` matches backend origin and no mixed http/https.

## Production Notes
- Use a GPU-enabled YOLO model and async workers for heavy video queues.
- Serve frontend statically (e.g., Nginx) and run backend behind a reverse proxy with TLS.
- Store videos on object storage (S3-compatible) rather than local disk.
- Add a slot-drawing editor to persist accurate rectangles per lot for best AI accuracy.

## License
MIT
