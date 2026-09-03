# Smart Logistics Platform - SIH26002

![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/API-Express-000000?logo=express&logoColor=white)
![FastAPI](https://img.shields.io/badge/AI-FastAPI-009688?logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/DevOps-Docker-2496ED?logo=docker&logoColor=white)
![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)

Smart Logistics Platform is a hackathon-ready logistics intelligence system built for **Smart India Hackathon problem statement SIH26002**. The platform combines a MERN-based web application with a FastAPI intelligence service to support safer, smarter, and more responsive logistics operations during dynamic conditions such as weather disruptions, route risks, incidents, and fleet movement.

## Screenshots

> Add your latest product screenshots here before final judging.

### Dashboard Overview

![Dashboard Screenshot Placeholder](https://via.placeholder.com/1200x675.png?text=Dashboard+Screenshot)

### Route Risk Visualization

![Route Risk Screenshot Placeholder](https://via.placeholder.com/1200x675.png?text=Route+Risk+Visualization)

### Incident Reporting Modal

![Incident Modal Screenshot Placeholder](https://via.placeholder.com/1200x675.png?text=Incident+Reporting+Modal)

## Tech Stack

### MERN Stack

- **MongoDB** - database layer for shipments, users, vehicles, routes, incidents, and notifications
- **Express.js** - Node.js REST API backend
- **React** - frontend dashboard and user interface
- **Node.js** - backend runtime

### FastAPI Service

- **Python FastAPI** - AI/ML and route-intelligence microservice
- **Uvicorn** - ASGI server for running FastAPI locally

### Developer Tooling

- **Concurrently** - unified local startup for backend, frontend, and FastAPI services
- **Vite** - React frontend development server

## Key Features

- **Shipment Management** - create shipments and fetch shipment records with driver and vehicle details.
- **Route Risk Evaluation** - evaluate route risk using weather data and AI-assisted route scoring.
- **Fleet and Vehicle Support** - structure for linking shipments with assigned vehicles and drivers.
- **Incident Reporting Foundation** - backend modules for incident and disaster-management workflows.
- **Notification Service Foundation** - supports future real-time logistics alerts and updates.
- **Unified Local Development** - start the Node.js backend, React frontend, and FastAPI server with one command.

## Project Structure

```txt
disaster-management/
├── fastapi-server/
│   ├── main.py
│   └── requirements.txt
├── src/
│   ├── app.js
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
├── server.js
├── package.json
└── README.md
```

The React frontend is expected in the sibling folder:

```txt
../tourmitra-web-for-SIH-
```

## Prerequisites

Install the following before running the project:

- Node.js and npm
- Python 3.10+
- MongoDB, either local or cloud-hosted

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/yashchavans777/disaster-management.git
cd disaster-management
```

### 2. Install Node.js backend dependencies

```bash
npm install
```

The root package includes `concurrently` for running all services together.

### 3. Install React frontend dependencies

From the frontend project folder:

```bash
cd ../tourmitra-web-for-SIH-
npm install
```

Then return to the backend/root workspace:

```bash
cd ../disaster-management
```

### 4. Install FastAPI dependencies

```bash
cd fastapi-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

If you do not want to use a virtual environment, install the Python dependencies directly:

```bash
pip install -r fastapi-server/requirements.txt
```

## Environment Variables

Create a `.env` file in the root directory and add your backend configuration as needed:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
```

Additional API keys for weather, maps, Firebase, Redis, or AI services can be added as the integrations are completed.

## Running the Application

### Run with Docker Compose

From the root directory:

```bash
docker-compose up --build
```

This starts:

- MongoDB on `mongodb://localhost:27017`
- Node.js backend on `http://localhost:5000`
- React frontend on `http://localhost:3000`
- FastAPI AI service on `http://localhost:8000`

Docker internal networking is configured so:

- the backend connects to MongoDB using `mongodb`
- the backend can reach the FastAPI service using `python-ai`
- the frontend proxies `/api` and `/socket.io` traffic to `backend`

To stop the stack:

```bash
docker-compose down
```

### Start all services together

From the root directory:

```bash
npm run dev
```

This command starts:

- Node.js backend on `http://localhost:5000`
- React frontend through the sibling frontend app's Vite dev server
- FastAPI server on `http://localhost:8000`

### Start services individually

Backend only:

```bash
npm run backend
```

Frontend only:

```bash
npm run frontend
```

FastAPI only:

```bash
npm run fastapi
```

## API Endpoints

### Shipment APIs

```txt
POST /api/shipments
GET  /api/shipments
```

### Route Intelligence APIs

```txt
POST /api/routes/evaluate-risk
```

Example request body:

```json
{
  "lat": 19.076,
  "lng": 72.8777
}
```

### FastAPI Health Check

```txt
GET http://localhost:8000/health
```

## Docker Files Included

- `Dockerfile` - Node.js backend image
- `python-ai/Dockerfile` - FastAPI service image
- `frontend/Dockerfile` - multi-stage React + Nginx image
- `docker-compose.yml` - orchestrates MongoDB, backend, frontend, and FastAPI services

## Hackathon Impact

Smart Logistics Platform - SIH26002 is designed to improve logistics resilience by helping teams monitor shipments, evaluate weather-aware route risks, respond to incidents, and coordinate fleet movement from a single intelligent platform.

## Future Enhancements

- Real-time vehicle tracking with WebSockets
- Live weather and GIS overlays
- Predictive delay and risk scoring models
- Role-based dashboards for operators, drivers, and administrators
- Emergency route recommendations during disasters

## License

This project is prepared for hackathon and educational use.