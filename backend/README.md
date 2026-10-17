# VeriChain Backend

FastAPI + PostgreSQL backend for VeriChain — Phase 2.

## Requirements

- Python 3.11+
- Docker (for PostgreSQL)

## Setup

```bash
# 1. Create and activate virtual environment
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1      # Windows
# source .venv/bin/activate     # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment file
cp .env.example .env

# 4. Start PostgreSQL (Docker)
docker compose up -d

# 5. Run database migrations
alembic upgrade head

# 6. Seed demo data
python -m $env:PYTHONIOENCODING='utf-8'; python seed.py

# 7. Start the backend
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | (required) |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:3000` |

## Database

PostgreSQL 15 via Docker Compose on **port 5435** (avoids conflicts with other services).

Connection: `postgresql+psycopg://verichain:verichain_dev_password@localhost:5435/verichain`

## Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "Description"

# Downgrade one step
alembic downgrade -1
```

## Seed Data

The seed script populates four canonical demo products used by the frontend:

| Product ID | Name | Status |
|---|---|---|
| VC-NIKE-001 | Nike Air Max 2026 | AUTHENTIC |
| VC-APPLE-002 | Apple Watch Series 11 | AUTHENTIC |
| VC-SONY-003 | Sony WH-1000XM6 | SUSPICIOUS |
| VC-FAKE-999 | Air Max 2026 (unverified) | CLONE SUSPECTED |

```bash
# Windows PowerShell
$env:PYTHONIOENCODING='utf-8'; python seed.py

# macOS/Linux
python seed.py
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/products` | List all products |
| GET | `/api/products/{id}` | Get product by ID |
| POST | `/api/products` | Create product |
| GET | `/api/products/{id}/provenance` | Supply chain events |
| GET | `/api/products/{id}/verification-history` | Verification scans |
| GET | `/api/products/{id}/risk` | Risk assessments |
| GET | `/api/alerts` | All alerts |
| GET | `/api/products/{id}/alerts` | Product-specific alerts |

Interactive API docs: http://localhost:8000/docs

## Testing

Tests use an isolated file-based SQLite database — they **never** touch the development PostgreSQL instance.

```bash
python -m pytest tests/ -v
```

## Connecting to the Frontend

The frontend service layer at `src/lib/api/config.ts` controls the data source:

- **Mock mode** (default): `VITE_USE_MOCK=true` — uses frontend mock data
- **Real backend**: `VITE_USE_MOCK=false` — calls this FastAPI backend

Set `VITE_USE_MOCK=false` in the frontend `.env` to use live data.
