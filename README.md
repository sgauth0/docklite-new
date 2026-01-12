# DockLite Complete Distribution

The complete DockLite stack - a minimal Docker management system with three modes of operation:
1. **Headless** - Agent only (no GUI)
2. **TUI** - Terminal UI client
3. **Full Stack** - Web GUI + Agent + TUI

## What's Included

- **`docklite-agent`** (17MB) - Go-based API server for Docker operations
- **`docklite-tui`** (8.5MB) - Terminal UI client with remote access
- **`webapp/`** - Next.js web interface with full dashboard
- **Headless mode** - Run the agent without any GUI
- **Full-stack mode** - Complete web interface + API + TUI

## Quick Start Options

### Option 1: Full Stack (Web GUI + Agent + TUI)

**One command to start everything:**
```bash
./start-fullstack.sh
```

Then open http://localhost:3000 in your browser!

### Option 2: Headless Mode (Agent Only)

**Start just the agent:**
```bash
./start-agent.sh
```

**Connect with TUI:**
```bash
./start-tui.sh
```

### Option 3: Development Mode

**Terminal 1 - Agent:**
```bash
make run-agent
```

**Terminal 2 - GUI:**
```bash
make run-gui
```

**Terminal 3 - TUI:**
```bash
make run-tui
```

## Features

**Web GUI (Next.js):**
- Full container dashboard with drag-and-drop organization
- Database management (PostgreSQL, MySQL, MongoDB)
- File browser and code editor
- Real-time container stats and logs
- Backup system with multiple destinations (S3, SFTP, local)
- DNS management (Cloudflare integration)
- SSL certificate status and management
- User management with role-based access control

**TUI Client:**
- Real-time container stats
- Log viewer
- File browser and editor
- Container management (start/stop/restart/remove)
- Remote access (connect to any agent)
- Persistent config storage

**Agent:**
- Direct Docker API integration
- SQLite metadata storage
- Token-based authentication
- Headless operation (no GUI required)
- Optional Next.js GUI proxy
- Single binary deployment

## Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide with all modes
- **[start-fullstack.sh](start-fullstack.sh)** - Start GUI + Agent together
- **[start-agent.sh](start-agent.sh)** - Agent startup script (headless)
- **[start-tui.sh](start-tui.sh)** - TUI client startup script
- **[stop-all.sh](stop-all.sh)** - Stop all running services

## Architecture

**Full Stack Mode:**
```
Browser → Agent (port 3000) ──┬→ Next.js GUI (port 3001)
                              │
TUI Client → Agent ───────────┴→ Docker Daemon
                              │
                              ↓
                          SQLite DB
```

**Headless Mode:**
```
TUI Client → Agent (port 3000) → Docker Daemon
                                    ↓
                                SQLite DB
```

## Deployment Modes

### Full Stack (Recommended)
```bash
# One command starts everything
./start-fullstack.sh

# Access:
# - Browser: http://localhost:3000
# - TUI: Use token from startup output
```

### Headless (CLI/TUI Only)
```bash
# Server
./start-agent.sh

# Client (local or remote)
./start-tui.sh
```

### Manual Control
```bash
# Start GUI on port 3001
cd webapp && PORT=3001 npm start &

# Start agent on port 3000 (proxies to GUI)
NEXTJS_URL=http://localhost:3001 ./bin/docklite-agent &

# Or headless (no GUI)
NEXTJS_URL=disabled ./bin/docklite-agent
```

## Building from Source

Requirements:
- Go 1.21+ (TUI)
- Go 1.24+ (Agent)
- Node.js 18+ (GUI)

```bash
make build-all     # Build everything (agent + TUI + GUI)
make build-agent   # Build agent only
make build-tui     # Build TUI only
make build-gui     # Build Next.js GUI
make install-gui   # Install GUI dependencies only
make clean         # Remove all build artifacts
```

Development mode:
```bash
make run-agent     # Run agent in dev mode
make run-tui       # Run TUI in dev mode
make run-gui       # Run GUI in dev mode (port 3000)
```

## Environment Variables

**Agent:**
- `LISTEN_ADDR` - Port to listen on (default: `:3000`)
- `DATABASE_PATH` - SQLite database path (default: `data/docklite.db`)
- `DOCKER_SOCKET_PATH` - Docker socket (default: `unix:///var/run/docker.sock`)
- `NEXTJS_URL` - Next.js proxy URL or `disabled` (default: `http://localhost:3001`)
- `DOCKLITE_TOKEN` - Authentication token (recommended: 32+ chars)

**GUI (Next.js):**
- `PORT` - Port to listen on (default: `3000`)
- `DATABASE_PATH` - SQLite database path (default: `data/docklite.db`)
- `AGENT_URL` - Agent API URL (default: `http://localhost:3000`)
- `AGENT_TOKEN` - Agent authentication token
- `SESSION_SECRET` - Session encryption key (32+ chars in production)

**TUI:**
- `DOCKLITE_URL` - Agent URL (default: `http://localhost:3000`)
- `DOCKLITE_TOKEN` - Authentication token

## Security

Generate secure tokens:
```bash
openssl rand -hex 32
```

Use HTTPS in production (reverse proxy recommended):
```bash
# Example with Caddy
caddy reverse-proxy --from docklite.example.com --to localhost:3000
```

## License

See main DockLite repository for license information.
