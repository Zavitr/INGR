# INGR Backend Engine (Activepieces Headless)

This directory contains the automated workflow engine for INGR.

## Architecture
- **Activepieces (v0.82 CE)**: Workflow execution and connector runtime running on port `8080`.
- **PostgreSQL 15**: Primary database for flows, steps, connections, and runs.
- **Redis 7**: Distributed queue and job scheduler.

## Management Commands

### Start Engine
```bash
./start.sh
```
Or:
```bash
docker compose up -d
```

### Stop Engine
```bash
docker compose down
```

### View Logs
```bash
docker compose logs -f
```

## REST API Credentials (Local Dev)
- **Engine URL**: `http://localhost:8080`
- **Admin Email**: `admin@ingr.local`
- **Admin Password**: `IngrAdminPassword2026!`
- **Total Connectors Available**: 579 official pieces (including Supabase, Postgres, Discord, Slack, Telegram, HTTP, etc.)
