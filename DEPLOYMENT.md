# DockLite Standalone Deployment Guide

This directory contains the standalone TUI/CLI and Agent binaries for DockLite - a minimal Docker management system that can run **with or without** the Next.js GUI.

## Architecture

```
┌──────────────────┐
│  docklite-tui    │  (Standalone TUI Client)
│  - Bubble Tea UI │
│  - Remote capable │
└────────┬─────────┘
         │ HTTP API (port 3000)
         ↓
┌────────────────────────────┐
│   docklite-agent           │  (Go API Server)
│   ├─ /api/* routes         │  → Docker operations
│   └─ /* (all other routes) │  → Proxy to Next.js (optional)
└────────┬───────────────────┘
         │
         ↓
    Docker Daemon
         ↓
   SQLite Database

```

## Binaries

Built binaries are located in `./bin/`:

- **`docklite-agent`** (17MB) - Backend API server that handles Docker operations
- **`docklite-tui`** (8.5MB) - Standalone TUI client with Bubble Tea interface

## Quick Start

### 1. Build Everything

```bash
make build-all
```

This creates both binaries in `./bin/`

### 2. Run Headless (Agent Only, No GUI)

```bash
# Start the agent in headless mode
NEXTJS_URL=disabled \
DATABASE_PATH=./data/docklite.db \
LISTEN_ADDR=:3000 \
DOCKLITE_TOKEN=your-secret-token \
./bin/docklite-agent
```

The agent will:
- Listen on port 3000
- Handle all Docker operations directly
- NOT proxy to Next.js (headless mode)
- Store metadata in SQLite

### 3. Connect with TUI

In another terminal:

```bash
# Option 1: Use environment variables
DOCKLITE_URL=http://localhost:3000 \
DOCKLITE_TOKEN=your-secret-token \
./bin/docklite-tui

# Option 2: Let TUI prompt for connection details
./bin/docklite-tui
```

The TUI will:
- Connect to the agent on port 3000
- Store credentials in `~/.config/docklite/config.json`
- Display containers, stats, logs, and file browser

## Deployment Modes

### Mode 1: Headless (No GUI)

**Use Case:** Remote server management, CLI-only environments

```bash
# On the server
NEXTJS_URL=disabled \
DATABASE_PATH=/var/lib/docklite/docklite.db \
LISTEN_ADDR=:3000 \
DOCKLITE_TOKEN=generate-a-secure-token \
./bin/docklite-agent

# From your local machine
DOCKLITE_URL=https://your-server.com:3000 \
DOCKLITE_TOKEN=your-token \
./bin/docklite-tui
```

### Mode 2: Full Stack (Agent + Next.js GUI)

**Use Case:** Web dashboard + TUI/CLI access

```bash
# Start Next.js GUI (in the main docklite directory)
cd /home/docklite
npm run build
npm start  # Runs on port 3001

# Start agent with proxy to GUI
NEXTJS_URL=http://localhost:3001 \
DATABASE_PATH=/var/lib/docklite/docklite.db \
LISTEN_ADDR=:3000 \
DOCKLITE_TOKEN=your-token \
./bin/docklite-agent

# Access via browser: http://localhost:3000
# Or use TUI: DOCKLITE_URL=http://localhost:3000 ./bin/docklite-tui
```

## Environment Variables

### Agent (`docklite-agent`)

| Variable | Default | Description |
|----------|---------|-------------|
| `LISTEN_ADDR` | `:3000` | Port to listen on |
| `DATABASE_PATH` | `data/docklite.db` | SQLite database location |
| `DOCKER_SOCKET_PATH` | `unix:///var/run/docker.sock` | Docker socket path |
| `NEXTJS_URL` | `http://localhost:3001` | Next.js proxy URL (or `disabled` for headless) |
| `DOCKLITE_TOKEN` | (empty) | Shared secret for API authentication |

### TUI Client (`docklite-tui`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKLITE_URL` | `http://localhost:3000` | Agent API URL |
| `DOCKLITE_TOKEN` | (empty) | Authentication token |

## Configuration

The TUI stores its configuration in `~/.config/docklite/config.json`:

```json
{
  "base_url": "http://localhost:3000",
  "token": "your-token-here"
}
```

## API Endpoints

The agent exposes these endpoints (all require `Authorization: Bearer <token>` header):

**Health & Stats:**
- `GET /api/health` - Health check
- `GET /api/summary` - Container/image/volume counts
- `GET /api/status` - Server stats (CPU, memory, disk)

**Containers:**
- `GET /api/containers` - List managed containers
- `GET /api/containers/all` - List all containers
- `POST /api/containers/{id}/start` - Start container
- `POST /api/containers/{id}/stop` - Stop container
- `POST /api/containers/{id}/restart` - Restart container
- `GET /api/containers/{id}/logs` - Get logs
- `GET /api/containers/{id}/stats` - Get stats stream
- `DELETE /api/containers/{id}` - Remove container

**Databases:**
- `GET /api/databases` - List database containers
- `POST /api/databases` - Create database container

**Files:**
- `GET /api/files?path=/path` - List files
- `GET /api/files/content?path=/path/file` - Read file
- `PUT /api/files/content` - Save file
- `POST /api/files/create` - Create file/folder
- `POST /api/files/delete` - Delete file/folder
- `POST /api/files/rename` - Rename file/folder

## Security Notes

1. **Generate a secure token:**
   ```bash
   openssl rand -hex 32
   ```

2. **File permissions:**
   - Database: `chmod 600 /path/to/docklite.db`
   - Config: `chmod 600 ~/.config/docklite/config.json`
   - Binaries: `chmod 755 ./bin/*`

3. **Docker socket access:**
   - Agent needs access to `/var/run/docker.sock`
   - Run as user in `docker` group or as root

4. **Network security:**
   - Use HTTPS in production (put behind reverse proxy)
   - Don't expose port 3000 publicly without TLS
   - Use firewall rules to restrict access

## Systemd Service (Optional)

Create `/etc/systemd/system/docklite-agent.service`:

```ini
[Unit]
Description=DockLite Agent
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/docklite
Environment="LISTEN_ADDR=:3000"
Environment="DATABASE_PATH=/var/lib/docklite/docklite.db"
Environment="DOCKER_SOCKET_PATH=unix:///var/run/docker.sock"
Environment="NEXTJS_URL=disabled"
Environment="DOCKLITE_TOKEN=your-secure-token-here"
ExecStart=/opt/docklite/bin/docklite-agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable docklite-agent
sudo systemctl start docklite-agent
```

## Building from Source

Requirements:
- Go 1.21+ (for TUI)
- Go 1.24+ (for Agent)

```bash
# Build both binaries
make build-all

# Build individually
make build-agent
make build-tui

# Run in development mode
make run-agent
make run-tui

# Clean binaries
make clean
```

## Troubleshooting

### Agent won't start

```bash
# Check database permissions
ls -la ./data/docklite.db

# Check Docker socket access
ls -la /var/run/docker.sock

# Test Docker connection
docker ps
```

### TUI can't connect

```bash
# Test agent health
curl -H "Authorization: Bearer your-token" http://localhost:3000/api/health

# Should return: {"status":"ok"}
```

### Database errors

```bash
# Database must exist before starting agent
# Copy from existing installation or create schema
cp /home/docklite/data/docklite.db ./data/

# Or initialize new database (requires Next.js to run migrations)
```

## Distribution

To distribute as a standalone package:

```bash
# Create release directory
mkdir -p docklite-release
cp -r bin/ docklite-release/
cp README.md DEPLOYMENT.md docklite-release/
cp Makefile docklite-release/

# Create tarball
tar czf docklite-standalone.tar.gz docklite-release/

# Users extract and run:
# tar xzf docklite-standalone.tar.gz
# cd docklite-release
# ./bin/docklite-agent
```

## License

See main DockLite repository for license information.
