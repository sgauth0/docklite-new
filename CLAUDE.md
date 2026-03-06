# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DockLite is a minimal Docker management system with three components:
1. **Go Agent** (17MB binary) - Backend API server for Docker operations
2. **Terminal UI** (8.5MB binary) - Standalone TUI client with Bubble Tea interface
3. **Next.js Web GUI** - Full-featured web dashboard

The system operates in three modes:
- **Headless**: Agent only (no GUI)
- **TUI**: Terminal UI client connecting to agent
- **Full Stack**: Complete web interface + agent + TUI

## Technology Stack

**Backend (Go):**
- Go 1.22.0
- Docker SDK (`github.com/docker/docker`) - Native Docker API integration
- SQLite (`modernc.org/sqlite`) - Pure Go embedded database
- Gorilla WebSocket (`github.com/gorilla/websocket`) - Real-time communication
- Go Crypto (`golang.org/x/crypto`) - Password hashing

**Frontend (Next.js):**
- Next.js 14.2 (App Router)
- React 18.3
- TypeScript
- TailwindCSS - Utility-first CSS
- better-sqlite3 - SQLite driver for Node.js
- Dockerode - Docker API client
- iron-session - Encrypted session management
- xterm.js - Terminal emulation
- dnd-kit - Drag-and-drop library
- Phosphor Icons

**TUI Client (Go):**
- Bubble Tea (`github.com/charmbracelet/bubbletea`) - Terminal UI framework
- Config storage: `~/.config/docklite/config.json`

## Build Commands

```bash
# Build everything
make build-all

# Build individual components
make build-agent    # Go agent binary → bin/docklite-agent
make build-tui      # TUI client binary → bin/docklite-tui
make build-gui      # Next.js production build → webapp/.next/

# Development mode (run without building)
make run-agent      # Run agent from source
make run-tui        # Run TUI from source
make run-gui        # Run Next.js in dev mode (port 3000)

# Install GUI dependencies only
make install-gui

# Clean all build artifacts
make clean
```

## Running the Stack

```bash
# Quick start - Full stack mode
./start-fullstack.sh    # Starts GUI (port 3001) + Agent (port 3000)

# Headless mode - Agent only
./start-agent.sh        # Agent on port 3000, no GUI

# TUI client
./start-tui.sh          # Connect to agent

# Stop everything
./stop-all.sh
```

## Architecture

### Three-Tier Architecture

```
Browser/TUI → Agent (port 3000) → Docker Daemon
                 ↓                     ↓
            Next.js GUI           SQLite DB
           (port 3001)
```

**Agent responsibilities:**
- Direct Docker operations via Docker socket
- File system operations
- Database container provisioning
- Token-based authentication
- Reverse proxy to Next.js (when enabled)
- Backup job execution

**GUI responsibilities:**
- User authentication (iron-session with Argon2)
- User management with roles (super_admin, admin, user)
- Site provisioning with templates
- Backup scheduling
- DNS record management (Cloudflare integration)
- SSL certificate tracking
- UI for all operations

**TUI responsibilities:**
- Remote agent connection
- Real-time container stats and logs
- File browser
- Credential storage in `~/.config/docklite/config.json`

### Request Flow

1. **API requests** (`/api/*`) → Handled by Go agent directly
2. **All other requests** → Proxied from agent to Next.js GUI
3. **TUI connections** → Connect to agent via HTTP API with token auth

### Database Architecture

**SQLite database** (`data/docklite.db`) is shared between agent and GUI:
- Agent: Reads container metadata, folder organization, tokens
- GUI: Full access for users, sites, backups, DNS, etc.
- Migrations: Located in `webapp/lib/migrations/`
- Schema initialization: Auto-runs on first GUI startup

## Directory Structure

```
/home/docklite-new-new/
├── bin/
│   ├── docklite-agent     # Go agent binary (17MB)
│   └── docklite-tui       # TUI binary (8.5MB)
├── go-app/                # Agent source code (Go 1.22)
│   ├── cmd/
│   │   └── docklite-agent/main.go   # Agent entry point
│   └── internal/
│       ├── api/           # HTTP routing and proxy
│       ├── handlers/      # Request handlers (27+ files for all endpoints)
│       ├── docker/        # Docker client wrapper
│       │   ├── client.go
│       │   ├── containers.go
│       │   ├── databases.go
│       │   └── exec.go    # Container exec operations
│       ├── store/         # SQLite operations (all table CRUD)
│       ├── backup/        # Backup scheduler and execution
│       ├── cloudflare/    # DNS integration (Cloudflare API)
│       ├── config/        # Config loading
│       └── models/        # Data structures
├── cli-repo/              # TUI source code
│   ├── main.go            # TUI entry point
│   ├── tui/               # Bubble Tea UI components
│   └── api/               # Agent API client
├── webapp/                # Next.js GUI
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API routes (user mgmt, backups, DNS)
│   │   ├── (dashboard)/   # Main dashboard pages
│   │   └── (auth)/        # Login pages
│   ├── lib/               # Shared libraries
│   │   ├── db.ts          # SQLite operations
│   │   ├── auth.ts        # iron-session authentication
│   │   ├── docker.ts      # Dockerode wrapper
│   │   ├── agent-client.ts # Agent API client
│   │   ├── backup-scheduler.ts # Backup cron jobs
│   │   ├── cloudflare.ts  # DNS management
│   │   └── migrations/    # Database migrations
│   └── public/            # Static assets
├── data/
│   └── docklite.db        # SQLite database
└── logs/
    ├── agent.log          # Agent logs
    └── nextjs.log         # GUI logs
```

## Key Files to Know

### Agent Entry Point
- `go-app/cmd/docklite-agent/main.go` - Initializes Docker client, SQLite store, handlers, router, backup scheduler

### Agent Routing
- `go-app/internal/api/router.go` - Defines all `/api/*` routes and proxy fallback
- `go-app/internal/api/proxy.go` - Reverse proxy to Next.js

### Agent Handlers
All in `go-app/internal/handlers/`:
- `containers.go` - Container operations (list, start, stop, restart, logs, stats)
- `terminal.go` - WebSocket terminal connections for container exec
- `databases.go` + `databases_extra.go` - Database provisioning and management
- `files.go` + `files_extra.go` - File browser and editor
- `folders.go` - Container organization (drag-and-drop groups)
- `backups.go` - Backup operations
- `dns.go` - DNS record operations
- `ssl.go` - SSL certificate status
- `network.go` - Network overview and firewall management
- `server_overview.go` - System statistics and diagnostics
- `auth.go` + `tokens.go` - Authentication middleware

### Next.js Core Libraries
All in `webapp/lib/`:
- `db.ts` - SQLite operations, all table CRUD operations
- `auth.ts` - Session management with iron-session
- `agent-client.ts` - Communicates with Go agent for Docker operations
- `docker.ts` - Direct Dockerode usage (for operations not in agent)
- `backup-scheduler.ts` - Cron-based backup scheduling
- `cloudflare.ts` - DNS management via Cloudflare API

### Next.js API Routes
All in `webapp/app/api/`:
- `auth/*` - Login, logout, session management
- `users/*` - User CRUD, password changes
- `containers/*` - Container operations (proxies to agent mostly)
- `databases/*` - Database provisioning and query interface
- `files/*` - File operations (proxies to agent)
- `folders/*` - Folder management
- `backups/*` - Backup destinations, jobs, history
- `dns/*` - DNS zones and records
- `ssl/*` - SSL certificate management

## Environment Variables

### Agent
- `LISTEN_ADDR` - Port (default: `:3000`)
- `DATABASE_PATH` - SQLite path (default: `data/docklite.db`)
- `DOCKER_SOCKET_PATH` - Docker socket (default: `unix:///var/run/docker.sock`)
- `NEXTJS_URL` - Next.js URL or `disabled` for headless (default: `http://localhost:3001`)
- `DOCKLITE_TOKEN` - Authentication token (should be 32+ chars)

### GUI (Next.js)
- `PORT` - Port (default: `3000`)
- `DATABASE_PATH` - SQLite path (default: `data/docklite.db`)
- `AGENT_URL` - Agent API URL (default: `http://localhost:3000`)
- `AGENT_TOKEN` - Must match agent's `DOCKLITE_TOKEN`
- `SESSION_SECRET` - Session encryption (32+ chars in production)

### TUI
- `DOCKLITE_URL` - Agent URL (default: `http://localhost:3000`)
- `DOCKLITE_TOKEN` - Auth token

## Authentication Flow

### Agent Token Auth
- All `/api/*` requests require `Authorization: Bearer <token>` header
- Token validated in `handlers/auth.go` via `Auth()` middleware
- Tokens stored in SQLite `tokens` table
- Bootstrap token auto-created from `DOCKLITE_TOKEN` env var

### GUI Session Auth
- Users log in via `webapp/app/api/auth/login/route.ts`
- Sessions encrypted with iron-session using `SESSION_SECRET`
- Session stored in encrypted cookie
- Protected pages check session in middleware
- Three roles: `super_admin`, `admin`, `user` (stored in `users.role` column)

### TUI Token Auth
- TUI connects to agent with token
- Credentials stored in `~/.config/docklite/config.json`
- Token sent as Bearer token in all requests

## Database Schema

SQLite database with tables:
- `users` - User accounts with roles
- `sites` - Container site metadata
- `databases` - Database container metadata
- `database_permissions` - User access to databases
- `folders` - Container organization groups
- `folder_containers` - Many-to-many container assignments
- `tokens` - API authentication tokens
- `backup_destinations` - S3, SFTP, local backup targets
- `backup_jobs` - Scheduled backup configurations
- `backups` - Backup execution history
- `cloudflare_configs` - Cloudflare API credentials
- `dns_zones` - DNS zone configuration
- `dns_records` - DNS record management

Migrations in `webapp/lib/migrations/` run automatically on GUI startup.

## Testing Changes

When making changes to:

**Agent code:**
```bash
make run-agent           # Test agent changes immediately
# Or rebuild and test binary
make build-agent && ./bin/docklite-agent
```

**TUI code:**
```bash
make run-tui             # Test TUI changes immediately
# Or rebuild and test binary
make build-tui && ./bin/docklite-tui
```

**GUI code:**
```bash
make run-gui             # Hot reload on save (port 3000)
# Or build and test production
make build-gui && cd webapp && npm start
```

**Full integration test:**
```bash
./start-fullstack.sh     # Test complete stack
```

## Common Patterns

### Adding a new Agent API endpoint

1. Add handler function in `go-app/internal/handlers/[feature].go`
2. Register route in `go-app/internal/api/router.go`
3. Wrap with `handlers.Auth()` middleware for token auth
4. Add corresponding client call in `webapp/lib/agent-client.ts` if needed by GUI

Example:
```go
// In go-app/internal/handlers/feature.go
func (h *Handlers) NewFeature(w http.ResponseWriter, r *http.Request) {
    // Implementation
}

// In go-app/internal/api/router.go
mux.HandleFunc("/api/feature/new", handlers.Auth(handlers.NewFeature))
```

### Adding a new GUI API endpoint

1. Create route file in `webapp/app/api/[feature]/route.ts`
2. Export `GET`, `POST`, `PUT`, `DELETE` async functions
3. Check session with `getSession()` from `lib/auth.ts`
4. Use database functions from `lib/db.ts`
5. Call agent if needed via `lib/agent-client.ts`

Example:
```typescript
// webapp/app/api/feature/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Implementation
}
```

### Adding database table

1. Create migration in `webapp/lib/migrations/[number]_description.ts`
2. Export migration object with `up` and `down` SQL
3. Run GUI to auto-apply migration
4. Add CRUD functions in `webapp/lib/db.ts`

### Working with Docker

Agent uses native Docker API via `go-app/internal/docker/client.go`:
```go
client.ContainerList(ctx, types.ContainerListOptions{All: true})
```

GUI uses Dockerode via `webapp/lib/docker.ts`:
```typescript
const docker = getDockerClient();
const containers = await docker.listContainers();
```

Prefer agent for Docker operations when possible (better performance, no Node.js Docker socket access needed).

## Port Usage

- `3000` - Agent (public facing, proxies non-API to GUI)
- `3001` - Next.js GUI (internal, not exposed)
- Agent serves both API and web interface on single port

## Deployment Modes

**Development:**
- Use `make run-*` commands for hot reload
- Each component in separate terminal
- Direct port access

**Production (Full Stack):**
- Use `./start-fullstack.sh`
- GUI on 3001, agent on 3000
- Put reverse proxy (Caddy/nginx) in front with HTTPS

**Production (Headless):**
- Use `./start-agent.sh` with `NEXTJS_URL=disabled`
- TUI-only access
- Minimal resource usage

## Quick Reference for Common Tasks

### Where to look when...

**Adding a new container feature:**
1. Agent handler: `go-app/internal/handlers/containers.go`
2. Agent route: `go-app/internal/api/router.go`
3. GUI page: `webapp/app/(dashboard)/page.tsx` or `containers/[id]/page.tsx`
4. GUI client: `webapp/lib/agent-client.ts`

**Adding a database feature:**
1. Agent: `go-app/internal/handlers/databases.go`
2. GUI: `webapp/app/(dashboard)/databases/page.tsx`
3. Database operations: `webapp/lib/db.ts`

**Adding authentication/user management:**
1. Session logic: `webapp/lib/auth.ts`
2. Login page: `webapp/app/(auth)/login/page.tsx`
3. User API: `webapp/app/api/users/route.ts`
4. User DB: `webapp/lib/db.ts` (getUsers, createUser, etc.)

**Adding backup functionality:**
1. Agent scheduler: `go-app/internal/backup/scheduler.go`
2. Agent handler: `go-app/internal/handlers/backups.go`
3. GUI page: `webapp/app/(dashboard)/backups/page.tsx`
4. GUI API: `webapp/app/api/backups/`

**Modifying Docker operations:**
1. Docker wrapper: `go-app/internal/docker/client.go`
2. Container ops: `go-app/internal/docker/containers.go`
3. Alternative (GUI): `webapp/lib/docker.ts` (using Dockerode)

**Working with the database:**
- Schema migrations: `webapp/lib/migrations/` (auto-run on startup)
- Go operations: `go-app/internal/store/*.go`
- Node.js operations: `webapp/lib/db.ts`
- Database location: `data/docklite.db` (shared between agent and GUI)

**Styling and UI components:**
- Global styles: `webapp/globals.css`
- Tailwind config: `webapp/tailwind.config.ts`
- Dashboard components: `webapp/app/(dashboard)/components/`
- Layout: `webapp/app/(dashboard)/layout.tsx`

## Security Notes

- Always generate secure tokens: `openssl rand -hex 32`
- Change default admin credentials (`superadmin`/`admin`) immediately
- Use HTTPS in production (reverse proxy recommended)
- Database file permissions: `chmod 600 data/docklite.db`
- Agent needs Docker socket access (run as docker group or root)
- Don't expose port 3000 publicly without TLS
