# 🚛 Smart Logistics Platform — SIH26002

> **Disaster-Aware Logistics Intelligence System for the North Eastern Region of India**

A full-stack, AI-powered logistics platform built for the **Smart India Hackathon (SIH)** under problem statement **SIH26002**. The platform helps logistics operators predict risks, visualize disruptions, and respond faster with smarter route decisions in India's disaster-prone North Eastern Region.

---

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Frontend Pages & Components](#frontend-pages--components)
- [AI / Intelligence Layer](#ai--intelligence-layer)
- [Deployment](#deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Future Scope](#future-scope)
- [License](#license)

---

## About the Project

The **North Eastern Region (NER)** of India faces unique supply chain challenges — mountain roads vulnerable to landslides, sudden flooding, rapidly changing weather, and fragmented incident reporting. Delayed deliveries and poor coordination during critical situations cost lives.

**Smart Logistics Platform** addresses this by combining **AI-based risk prediction**, **dynamic routing**, **real-time vehicle tracking**, and a **live disaster dashboard** into a single unified platform. It transforms logistics from reactive decision-making into **proactive, data-driven planning**.

### Problem It Solves

| Challenge | Our Solution |
|---|---|
| Landslides & roadblocks on mountain roads | AI-powered route risk evaluation with alternate safe paths |
| Sudden flooding isolating districts | Real-time hazard mapping with live weather intelligence |
| Delayed field incident reporting | One-click incident reporting with GPS + offline support |
| No unified view for operators | Interactive dashboard with live map, shipments & alerts |
| Connectivity issues in remote areas | Offline-first PWA with local caching & background sync |
| Language barriers across NER states | Bhashini API integration for multilingual translation |

---

## Key Features

### 🗺️ Live Interactive Map & Dashboard
- Real-time shipment tracking on interactive Leaflet maps
- Multi-layer map views: Esri World Street Map, OpenStreetMap, Satellite imagery
- Live vehicle movement tracking via WebSockets (Socket.IO)
- Color-coded route risk visualization (low / moderate / high)

### 🤖 AI-Powered Intelligence
- **Risk Prediction Engine** — Evaluates route risks using live weather data, historical disaster records, and terrain analysis
- **Agentic AI Loop** — Multi-step autonomous reasoning for complex incident analysis and response recommendations
- **RAG (Retrieval-Augmented Generation)** — Queries historical disaster data for context-aware AI responses with streaming output
- **Groq LLM Integration** — Ultra-fast AI inference using Groq's LLaMA models
- **Google Gemini API** — Fallback AI model for prediction and analysis

### 🌦️ Weather-Aware Routing
- Live weather data from OpenWeatherMap & Open-Meteo APIs
- Weather-based risk scoring using sigmoid functions & weighted parameters
- Automated weather monitoring via scheduled cron jobs
- City-level hazard zone mapping with flood/landslide risk assessment

### 📡 Real-Time Communication
- WebSocket-based live vehicle location updates using Socket.IO
- Push notifications for weather alerts and route disruptions
- Email alerts via Nodemailer (Gmail SMTP)
- SMS alerts via Twilio integration

### 🔒 Authentication & Security
- JWT-based authentication with role-based access (admin, operator, driver)
- Bcrypt password hashing
- CORS-protected API endpoints
- Rate limiting middleware

### 📱 Offline-First Progressive Web App (PWA)
- Service Worker with Workbox for offline caching
- `NetworkFirst` strategy for API routes & shipment data
- `CacheFirst` strategy for map tiles (offline maps)
- Background sync worker for queuing actions when offline
- Install-to-homescreen support with app manifest

### 🌐 Multilingual Translation
- Bhashini API (Government of India ULCA Pipeline) for Indian language translation
- Support for NER regional languages

### 📊 Analytics & Visualization
- Recharts-based data visualization and charts
- Connectivity matrix between NER cities
- Route risk assessment dashboard
- Shipment analytics and tracking history

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React 18** | UI library for building component-based interface |
| **Vite 5** | Next-generation frontend build tool & dev server |
| **Tailwind CSS 3** | Utility-first CSS framework for rapid UI development |
| **React Router DOM v6** | Client-side routing and navigation |
| **React Leaflet** | Interactive map components (built on Leaflet.js) |
| **Leaflet 1.9** | Open-source JavaScript library for mobile-friendly maps |
| **Socket.IO Client** | Real-time WebSocket communication with backend |
| **Axios** | Promise-based HTTP client for API requests |
| **Recharts** | Composable charting library for React |
| **Lucide React** | Modern icon library |
| **React Hot Toast** | Toast notification system |
| **Vite Plugin PWA** | Progressive Web App support with Workbox |
| **PostCSS** | CSS transformation tool (used with Tailwind) |
| **Autoprefixer** | Adds vendor prefixes to CSS |

### Backend (Node.js)

| Technology | Purpose |
|---|---|
| **Node.js 20** | JavaScript runtime for the server |
| **Express.js 5** | Minimalist web framework for REST API |
| **MongoDB** | NoSQL database for storing shipments, routes, incidents |
| **Mongoose 9** | Elegant MongoDB object modeling for Node.js |
| **Socket.IO 4** | Real-time bidirectional event-based communication |
| **JSON Web Token (JWT)** | Stateless authentication tokens |
| **bcryptjs** | Password hashing and verification |
| **Nodemailer 10** | Email sending (SMTP via Gmail) |
| **Twilio 6** | SMS notifications and alerts |
| **node-cron** | Scheduled background jobs (weather monitoring) |
| **CORS** | Cross-Origin Resource Sharing middleware |
| **dotenv** | Environment variable management |

### AI / Intelligence Layer (Python)

| Technology | Purpose |
|---|---|
| **Python 3** | Programming language for AI microservice |
| **FastAPI** | High-performance async Python web framework |
| **Uvicorn** | Lightning-fast ASGI server |
| **Groq SDK** | Ultra-fast LLM inference (LLaMA models) |
| **Google Generative AI** | Gemini API for AI predictions |
| **NumPy** | Numerical computing for risk scoring algorithms |
| **httpx** | Async HTTP client for external API calls |
| **PyMongo + Motor** | MongoDB driver (sync & async) for Python |
| **Pydantic** | Data validation with Python type annotations |
| **python-dotenv** | Environment variable loading |

### DevOps & Tooling

| Technology | Purpose |
|---|---|
| **Docker** | Containerization for all services |
| **Docker Compose** | Multi-container orchestration (MongoDB, Backend, Frontend, AI) |
| **GitHub Actions** | CI/CD pipeline for automated builds |
| **Nginx** | Reverse proxy for frontend production serving |
| **Prettier** | Code formatting for JS/JSX/Python files |
| **Concurrently** | Run backend + frontend + FastAPI servers simultaneously |
| **Vercel** | Frontend deployment support (vercel.json configured) |

### External APIs & Services

| Service | Purpose |
|---|---|
| **OpenWeatherMap API** | Live weather data for risk assessment |
| **Open-Meteo API** | Free weather forecasting API |
| **Bhashini API (ULCA)** | Government of India multilingual translation |
| **DuckDuckGo Search** | Web search for official disaster source verification |
| **Twilio** | SMS alert delivery |
| **Gmail SMTP** | Email alert delivery |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser / PWA)                       │
│   React + Vite + Tailwind CSS + Leaflet Maps + Socket.IO Client      │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │  REST API (HTTP)                 │  WebSocket
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    NODE.JS BACKEND (Express.js)                      │
│  Auth · Shipments · Routes · Incidents · Notifications · Tracking    │
│  Cron Jobs (Weather) · Sync Worker · Socket.IO Server                │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │  MongoDB Driver                  │  HTTP Proxy
                ▼                                  ▼
┌──────────────────────┐         ┌─────────────────────────────────────┐
│     MongoDB 7        │         │     FASTAPI AI MICROSERVICE         │
│  (Atlas / Local)     │         │  Risk Prediction · RAG · Agentic   │
│                      │◄────────│  Graph Routing · Weather · Hazards  │
│  Collections:        │  Motor  │  Groq LLM · Gemini · NumPy          │
│  • users             │         └─────────────────────────────────────┘
│  • shipments         │
│  • routes            │
│  • incidents         │
│  • vehicles          │
│  • notifications     │
└──────────────────────┘
```

---

## Project Structure

```
disaster-management/
├── .env.example                # Environment variable template
├── .github/
│   └── workflows/
│       └── main.yml            # GitHub Actions CI pipeline
├── docker-compose.yml          # Multi-container Docker setup
├── Dockerfile                  # Backend Docker image
├── package.json                # Root (backend) dependencies & scripts
├── server.js                   # Entry point — starts Express + Socket.IO
├── PITCH_DECK.md               # 5-minute hackathon pitch script
│
├── src/                        # ── Node.js Backend Source ──
│   ├── app.js                  # Express app bootstrap (routes, middleware, Socket.IO)
│   ├── config/
│   │   └── db.js               # MongoDB connection config
│   ├── controllers/
│   │   ├── ai.controller.js    # AI proxy endpoints
│   │   ├── auth.controller.js  # Login, register, JWT
│   │   ├── incident.controller.js
│   │   ├── notification.controller.js
│   │   ├── route.controller.js
│   │   ├── shipment.controller.js
│   │   └── tracking.controller.js
│   ├── middlewares/
│   │   ├── auth.middleware.js   # JWT verification guard
│   │   ├── error.middleware.js  # Global error handler
│   │   ├── rateLimiter.js       # API rate limiting
│   │   └── upload.middleware.js # File upload handling
│   ├── models/
│   │   ├── IncidentReport.js   # Disaster incident schema
│   │   ├── Notification.js     # Push/email/SMS notification schema
│   │   ├── Route.js            # Logistics route schema
│   │   ├── Shipment.js         # Shipment tracking schema
│   │   ├── Vehicle.js          # Fleet vehicle schema
│   │   └── user.js             # User authentication schema
│   ├── routes/
│   │   ├── ai.routes.js        # /api/ai/*
│   │   ├── auth.routes.js      # /api/auth/*
│   │   ├── dashboard.routes.js # /api/dashboard/*
│   │   ├── incident.routes.js  # /api/incidents/*
│   │   ├── notification.routes.js
│   │   ├── route.routes.js     # /api/routes/*
│   │   ├── shipment.routes.js  # /api/shipments/*
│   │   ├── tracking.routes.js  # /api/tracking/*
│   │   └── translate.routes.js # /api/translate/*
│   ├── services/
│   │   ├── aiRoute.service.js       # AI route evaluation logic
│   │   ├── gis.service.js           # GIS / geospatial calculations
│   │   ├── notification.service.js  # Notification dispatch
│   │   ├── notificationService.js   # Extended notification service
│   │   ├── offlineSync.service.js   # Offline sync queue processing
│   │   └── weather.service.js       # Weather data fetching
│   ├── jobs/
│   │   ├── weatherCron.js      # Scheduled weather monitoring
│   │   └── syncWorker.js       # Background offline data sync
│   └── utils/
│       ├── apiResponse.js      # Standardized API response helper
│       ├── bhashini.js         # Bhashini translation API client
│       ├── geoHelpers.js       # Haversine, coordinates helpers
│       ├── logger.js           # Console logger utility
│       └── seed.js             # Database seeding script
│
├── fastapi-server/             # ── Python AI Microservice ──
│   ├── main.py                 # FastAPI app — all AI endpoints
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # Python-specific env vars
│   ├── data/                   # Historical disaster data files
│   └── utils/
│       └── weather.py          # Weather fetching utilities
│
├── frontend/                   # ── React Frontend ──
│   ├── package.json            # Frontend dependencies
│   ├── vite.config.js          # Vite + PWA + Workbox configuration
│   ├── tailwind.config.js      # Tailwind CSS config
│   ├── postcss.config.js       # PostCSS config
│   ├── index.html              # HTML entry point
│   ├── Dockerfile              # Frontend Docker image (Nginx)
│   ├── nginx.conf              # Nginx production config
│   ├── vercel.json             # Vercel deployment config
│   └── src/
│       ├── App.jsx             # Root component with routing
│       ├── main.jsx            # React DOM entry point
│       ├── index.css           # Global styles (Tailwind directives)
│       ├── api/                # Axios API client modules
│       ├── context/            # React Context providers
│       ├── components/
│       │   ├── Chatbot.jsx            # AI chatbot interface
│       │   ├── CityDetailMap.jsx      # City-level detail map view
│       │   ├── ConnectivityMatrix.jsx # NER city connectivity matrix
│       │   ├── DisasterMap.jsx        # Disaster incident map overlay
│       │   ├── HazardMap.jsx          # Hazard zone visualization
│       │   ├── LiveNavigator.jsx      # Live turn-by-turn navigation
│       │   ├── Loader.jsx             # Loading spinner component
│       │   ├── MapViewer.jsx          # Main interactive map viewer
│       │   ├── Navbar.jsx             # Top navigation bar
│       │   ├── NavigationSidebar.jsx  # Side navigation panel
│       │   ├── ReportIncidentModal.jsx# Incident reporting modal
│       │   ├── RoutePlanner.jsx       # Route planning interface
│       │   ├── RouteRisk.jsx          # Route risk display card
│       │   └── WeatherWidget.jsx      # Live weather widget
│       ├── pages/
│       │   ├── Dashboard.jsx   # Main operator dashboard
│       │   ├── DriverView.jsx  # Driver-specific interface
│       │   └── Login.jsx       # Authentication page
│       └── utils/              # Frontend utility functions
│
├── python-ai/                  # ── AI Dockerfile (legacy) ──
│   └── Dockerfile
│
└── tests/
    └── auth.test.js            # Authentication tests
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ |
| Python | 3.10+ |
| MongoDB | 7.0+ (local or Atlas) |
| npm | 10+ |
| pip | Latest |

### 1. Clone the Repository

```bash
git clone https://github.com/yashchavans777/disaster-management.git
cd disaster-management
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys (see [Environment Variables](#environment-variables) section below).

### 3. Install Dependencies

```bash
# Install backend (Node.js) dependencies
npm install

# Install frontend dependencies
npm --prefix frontend install

# Install Python AI dependencies
pip install -r fastapi-server/requirements.txt
```

### 4. Seed the Database (Optional)

```bash
npm run seed
```

### 5. Run All Services (Development)

```bash
# Starts backend, frontend, and FastAPI server concurrently
npm run dev
```

This runs all three services in parallel:

| Service | URL | Color in Terminal |
|---|---|---|
| **Backend** (Express.js) | `http://localhost:5055` | 🔵 Blue |
| **Frontend** (Vite) | `http://localhost:5173` | 🟢 Green |
| **FastAPI** (Uvicorn) | `http://localhost:8000` | 🟣 Magenta |

### Run Services Individually

```bash
# Backend only
npm run backend

# Frontend only
npm run frontend

# FastAPI AI server only
npm run fastapi
```

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

| Variable | Description | Example |
|---|---|---|
| `PORT` | Backend server port | `5055` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/disaster-management` |
| `JWT_SECRET` | Secret key for JWT signing | `your_strong_secret_here` |
| `JWT_EXPIRES_IN` | JWT token expiry duration | `7d` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `FASTAPI_URL` | FastAPI microservice URL | `http://localhost:8000` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `GROQ_API_KEY` | Groq API key for LLM inference | `gsk_...` |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key | `your_key` |
| `BHASHINI_API_KEY` | Bhashini translation API key | `your_key` |
| `BHASHINI_USER_ID` | Bhashini user ID | `your_id` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `ACXXX...` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `your_token` |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone number | `+1234567890` |
| `EMAIL_SERVICE` | Email service provider | `gmail` |
| `EMAIL_USER` | Sender email address | `admin@example.com` |
| `EMAIL_PASS` | Email app password | `your_app_password` |

---

## API Endpoints

### Node.js Backend (`/api`)

#### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT |

#### Shipments
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/shipments` | List all shipments |
| `POST` | `/api/shipments` | Create a shipment |

#### Routes
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/routes` | List all logistics routes |
| `POST` | `/api/routes` | Create a new route |

#### Incidents
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/incidents` | List all incident reports |
| `POST` | `/api/incidents` | Report a new incident |

#### Tracking
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tracking` | Get vehicle tracking data |
| `POST` | `/api/tracking` | Update vehicle location |

#### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/*` | Dashboard analytics & stats |

#### AI Proxy
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/*` | Proxy to FastAPI AI endpoints |

#### Translation
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/translate` | Translate text via Bhashini API |

#### Health Check
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health status |

### FastAPI AI Microservice

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root / welcome |
| `GET` | `/health` | Health check |
| `POST` | `/predict-risk` | AI-powered route risk prediction |
| `POST` | `/evaluate-risk` | Evaluate risk for given route |
| `POST` | `/rag-query` | RAG query with streaming response |
| `POST` | `/graph-route` | A* graph-based route computation |
| `POST` | `/agentic-loop` | Multi-step agentic AI reasoning |
| `POST` | `/sync-data-to-db` | Sync data from files to MongoDB |
| `GET` | `/api/weather/{city}` | City weather data |
| `GET` | `/api/hazard-zones/{city}` | City hazard zone data |
| `GET` | `/api/hazard-zones` | All hazard zones |

---

## Frontend Pages & Components

### Pages

| Page | Description |
|---|---|
| **Login** | User authentication with role-based login (admin / operator / driver) |
| **Dashboard** | Main command center with live map, shipment table, weather, and analytics |
| **DriverView** | Simplified driver interface with navigation and delivery status |

### Key Components

| Component | Description |
|---|---|
| **MapViewer** | Interactive Leaflet map with multi-layer support, shipment markers & route polylines |
| **HazardMap** | Hazard zone visualization with flood/landslide risk overlays |
| **DisasterMap** | Real-time disaster incident pins on the map |
| **RoutePlanner** | Plan and evaluate logistics routes between NER cities |
| **LiveNavigator** | Turn-by-turn live navigation for drivers |
| **Chatbot** | AI-powered chatbot for logistics queries and analysis |
| **ConnectivityMatrix** | Visual matrix showing connectivity between NER cities |
| **ReportIncidentModal** | Modal form to report field incidents with GPS coordinates |
| **WeatherWidget** | Live weather conditions display for selected cities |
| **RouteRisk** | Route risk level card with color-coded severity |
| **CityDetailMap** | Zoomed-in city-level map with detailed infrastructure |

---

## AI / Intelligence Layer

The FastAPI microservice powers the AI features:

### Risk Prediction Engine
- Combines **live weather data** (temperature, wind, rain, humidity) with **historical disaster records** to compute risk scores
- Uses a **sigmoid-based scoring model** with weighted parameters
- Returns risk level (Low / Moderate / High) with confidence percentage

### A* Graph Routing
- Pre-built **graph of NER cities and roads** with edge weights based on distance
- **A\* pathfinding** algorithm to compute optimal routes
- Supports **blocked road segments** — dynamically finds alternate paths

### RAG (Retrieval-Augmented Generation)
- Loads historical disaster data from local text files as context
- **Chunking + similarity matching** to find the most relevant historical records
- Streams AI responses using Groq LLaMA for real-time output

### Agentic AI Loop
- Multi-step reasoning pipeline that autonomously:
  1. Fetches live weather for the area
  2. Searches official disaster sources (DuckDuckGo)
  3. Loads historical records for context
  4. Synthesizes a comprehensive risk assessment

---

## Deployment

### Docker Compose (Recommended)

```bash
docker-compose up --build
```

This starts 4 services:

| Service | Container | Port |
|---|---|---|
| MongoDB 7 | `disaster-management-mongodb` | `27017` |
| Python AI | `disaster-management-python-ai` | `8000` |
| Backend | `disaster-management-backend` | `5000` |
| Frontend | `disaster-management-frontend` | `3000` |

### Vercel (Frontend Only)

The frontend includes a `vercel.json` for Vercel deployment:

```bash
cd frontend
npx vercel deploy
```

### Manual Production Build

```bash
# Build frontend for production
cd frontend
npm run build
# Output in frontend/dist/ — serve with Nginx or any static host
```

---

## CI/CD Pipeline

The project uses **GitHub Actions** for continuous integration:

**Workflow:** `.github/workflows/main.yml`

| Step | Description |
|---|---|
| Checkout | Pulls latest code from `main` branch |
| Setup Node.js 20 | Installs Node.js with npm caching |
| Install Backend Deps | `npm install` at root |
| Install Frontend Deps | `npm install` in `frontend/` |
| Build Frontend | `npm run build` — ensures Vite build passes |

Triggered on every push to the `main` branch.

---

## NPM Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Run all 3 services concurrently (backend + frontend + FastAPI) |
| `npm run backend` | Start Node.js backend only |
| `npm run frontend` | Start Vite dev server only |
| `npm run fastapi` | Start FastAPI with Uvicorn (hot reload) |
| `npm run setup:python` | Install Python dependencies |
| `npm run seed` | Seed the MongoDB database |
| `npm run format` | Format all code with Prettier |
| `npm test` | Run authentication tests |

---

## Future Scope

- 🧠 **ML-based delay prediction** using historical shipment data
- 🛰️ **Satellite hazard data** integration with IMD/ISRO feeds
- 🔄 **Automatic rerouting** from GIS and road condition feeds
- 📱 **Mobile-first reporting app** for field workers
- 👥 **Role-specific dashboards** — admin, dispatcher, driver
- 🔔 **Predictive alerts** for supply shortages and route failures
- 🌍 **Multi-region expansion** beyond NER

---

## License

This project is licensed under the **ISC License**.

---

<p align="center">
  Built with ❤️ for <strong>Smart India Hackathon 2026</strong> — Problem Statement SIH26002
</p>
