# YourClub Driver App - Backend API

Backend API for YourClub driver app (PWA).

## Features
- Driver authentication (phone + password)
- Duty management (start/stop)
- Upcoming rides
- Ride history
- Customer OTP verification
- Digital signature capture
- Quality check with photos
- Data sync

## Tech Stack
- Node.js + Express
- Supabase (PostgreSQL)
- JWT Authentication

## API Endpoints

### Public
- `GET /` - Health check
- `POST /api/login` - Driver login

### Authenticated (JWT required)
- `GET /api/driver/me` - Get profile
- `POST /api/driver/duty` - Update duty status
- `GET /api/rides/upcoming` - Get upcoming rides
- `GET /api/rides/history` - Get ride history
- `POST /api/rides/:id/start` - Start ride (OTP)
- `POST /api/rides/:id/end` - End ride (signature)
- `POST /api/quality-check` - Submit quality check
- `GET /api/sync` - Sync all data

## Environment Variables
See `.env.example` for required variables.

## Deploy
Deployed on Render.com
