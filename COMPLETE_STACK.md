# DockLite Complete Stack - Ready to Deploy! ✅

## What You Have Now

The **complete DockLite stack** is now in `/home/docklite-new/` with all three components:

1. **Go Agent** (Backend API) - 17MB binary
2. **Terminal UI** (TUI Client) - 8.5MB binary
3. **Next.js Web GUI** (Full Dashboard) - Complete web interface

## Directory Structure

```
/home/docklite-new/
├── bin/
│   ├── docklite-agent (17MB)     ← Backend API server
│   └── docklite-tui (8.5MB)      ← Terminal UI client
├── go-app/                        ← Agent source code
├── cli-repo/                      ← TUI source code
├── webapp/                        ← Next.js GUI source code
│   ├── app/                       ← Next.js app router (pages & API routes)
│   ├── lib/                       ← Shared libraries (auth, Docker, DB)
│   ├── public/                    ← Static assets
│   ├── scripts/                   ← Deployment scripts
│   └── package.json               ← Dependencies
├── data/                          ← SQLite database storage
├── logs/                          ← Runtime logs
├── Makefile                       ← Build system
├── start-fullstack.sh             ← 🚀 ONE-COMMAND STARTUP
├── start-agent.sh                 ← Headless agent startup
├── start-tui.sh                   ← TUI client startup
├── stop-all.sh                    ← Stop all services
├── README.md                      ← Quick start guide
├── DEPLOYMENT.md                  ← Detailed deployment docs
└── COMPLETE_STACK.md              ← This file!
```

## Quick Start (Easiest Way)

### Run Full Stack with One Command:

```bash
cd /home/docklite-new
./start-fullstack.sh
```

This will:
1. ✅ Check all dependencies
2. ✅ Install npm packages if needed
3. ✅ Build Next.js if needed
4. ✅ Generate authentication token
5. ✅ Start GUI on port 3001
6. ✅ Start Agent on port 3000 (proxies to GUI)
7. ✅ Display access URLs and credentials

Then open **http://localhost:3000** in your browser!

## Three Modes of Operation

### Mode 1: Full Stack (Web + API + TUI)

**Best for:** Production use, team access, full features

```bash
./start-fullstack.sh
```

**Access:**
- 🌐 Web Browser: `http://localhost:3000`
- 🔧 API Endpoint: `http://localhost:3000/api/*`
- 💻 TUI Client: Use token from startup

**Features:**
- Complete web dashboard
- User management with roles
- Database provisioning (PostgreSQL, MySQL, MongoDB)
- File browser & code editor
- Backup system (S3, SFTP, local)
- DNS management (Cloudflare)
- SSL certificate tracking
- Container drag-and-drop organization

### Mode 2: Headless (API Only)

**Best for:** Remote servers, minimal resources, automation

```bash
./start-agent.sh
```

**Access:**
- 🔧 API Only: `http://localhost:3000/api/*`
- 💻 TUI: Connect remotely with token

**Features:**
- All Docker operations via API
- Token authentication
- Minimal resource usage
- No web interface overhead

### Mode 3: TUI Only

**Best for:** Terminal enthusiasts, SSH access, scripting

```bash
# Connect to local or remote agent
./start-tui.sh
```

**Features:**
- Interactive terminal UI
- Real-time container stats
- Log viewer with streaming
- File browser
- Remote connection support

## Architecture Overview

### Full Stack Architecture

```
┌─────────────┐
│   Browser   │ (You)
└──────┬──────┘
       │ HTTP
       ↓
┌──────────────────────┐
│  docklite-agent      │ Port 3000 (Public)
│  ├─ /api/* routes    │ → Handled by Agent
│  └─ /* (all else)    │ → Proxied to Next.js
└──────┬───────────────┘
       │
       ├──→ Next.js GUI (Port 3001, internal)
       │    └─ Full web dashboard
       │
       ├──→ Docker Daemon
       │    └─ Container operations
       │
       └──→ SQLite Database
            └─ Metadata storage

┌─────────────┐
│ docklite-tui│ (Optional, can connect anytime)
└──────┬──────┘
       │
       └──→ Agent API (with token)
```

### Component Responsibilities

**Agent (Go):**
- Docker operations (containers, images, volumes)
- File system operations
- Database container provisioning
- Backup job execution
- Authentication & authorization
- Reverse proxy to Next.js

**GUI (Next.js):**
- User authentication (iron-session)
- User management & roles
- Site provisioning with templates
- Backup scheduling
- DNS record management
- UI for all operations

**TUI (Go + Bubble Tea):**
- Terminal-based interface
- Remote agent connection
- Real-time updates
- Credential storage

## Environment Configuration

### Minimal Configuration (Development)

```bash
# Agent will use defaults
./start-fullstack.sh
```

### Production Configuration

Create `.env` file in `/home/docklite-new/`:

```bash
# Agent
LISTEN_ADDR=:3000
DATABASE_PATH=./data/docklite.db
DOCKER_SOCKET_PATH=unix:///var/run/docker.sock
DOCKLITE_TOKEN=<generate-with-openssl-rand-hex-32>

# GUI
PORT=3001
SESSION_SECRET=<generate-with-openssl-rand-hex-32>
AGENT_URL=http://localhost:3000
AGENT_TOKEN=<same-as-DOCKLITE_TOKEN>
```

Generate secure tokens:
```bash
openssl rand -hex 32
```

## Building from Source

### Build Everything

```bash
cd /home/docklite-new
make build-all
```

This builds:
1. `bin/docklite-agent` (Go binary)
2. `bin/docklite-tui` (Go binary)
3. `webapp/.next/` (Next.js production build)

### Build Individual Components

```bash
make build-agent    # Just the agent (17MB)
make build-tui      # Just the TUI (8.5MB)
make build-gui      # Just the Next.js app
```

### Development Mode

Run each component in separate terminals:

```bash
# Terminal 1: Agent
make run-agent

# Terminal 2: GUI
make run-gui

# Terminal 3: TUI
make run-tui
```

## Database Setup

### Copy Existing Database

If you have an existing DockLite database:

```bash
cp /home/docklite/data/docklite.db /home/docklite-new/data/
```

### Initialize New Database

The database will be auto-initialized on first run via migrations in `webapp/lib/migrations/`.

Default credentials (development):
- Username: `superadmin`
- Password: `admin`

**⚠️ Change these immediately in production!**

## Stopping Services

### Stop Everything

```bash
./stop-all.sh
```

Or manually:
```bash
# Find PIDs
ps aux | grep docklite

# Kill by PID
kill <GUI_PID> <AGENT_PID>
```

## Deployment Checklist

### Development Setup
- [x] Copy code to `/home/docklite-new/`
- [x] Build binaries with `make build-all`
- [x] Run `./start-fullstack.sh`
- [x] Access at `http://localhost:3000`

### Production Setup
- [ ] Generate secure tokens (`openssl rand -hex 32`)
- [ ] Create `.env` file with production secrets
- [ ] Change default admin password
- [ ] Set up reverse proxy (nginx/Caddy) with HTTPS
- [ ] Configure firewall rules
- [ ] Set up systemd services (see `webapp/scripts/systemd/`)
- [ ] Configure backup destinations
- [ ] Set up DNS records (if using DNS management)

## Security Considerations

### Authentication

1. **Agent Token**: Shared secret for API access
   - Used by GUI to communicate with Agent
   - Used by TUI for remote access
   - Should be 32+ characters

2. **Session Secret**: Encrypts user sessions
   - Used by Next.js GUI only
   - Should be 32+ characters
   - Change in production

3. **User Passwords**: Web GUI login
   - Hashed with Argon2
   - Role-based: super_admin > admin > user
   - Change default credentials

### Network Security

1. **Production**: Use HTTPS
   ```bash
   # Example with Caddy
   caddy reverse-proxy --from docklite.example.com --to localhost:3000
   ```

2. **Firewall**: Restrict port 3000
   ```bash
   # Only allow from specific IPs
   ufw allow from 10.0.0.0/8 to any port 3000
   ```

3. **Docker Socket**: Agent needs access
   ```bash
   # Run as user in docker group
   sudo usermod -aG docker $USER
   ```

## Features by Mode

| Feature | Full Stack | Headless | TUI |
|---------|-----------|----------|-----|
| Container Management | ✅ Web | ✅ API | ✅ Terminal |
| Real-time Stats | ✅ | ✅ | ✅ |
| Logs Viewer | ✅ | ✅ | ✅ |
| File Browser | ✅ | ✅ | ✅ |
| Database Provisioning | ✅ | ✅ | ❌ |
| User Management | ✅ | ❌ | ❌ |
| Backup Scheduling | ✅ | ❌ | ❌ |
| DNS Management | ✅ | ❌ | ❌ |
| SSL Status | ✅ | ❌ | ❌ |
| Site Provisioning | ✅ | ❌ | ❌ |
| Remote Access | ✅ | ✅ | ✅ |

## Troubleshooting

### Agent won't start

```bash
# Check Docker
docker ps

# Check database path
ls -la data/docklite.db

# Check logs
tail -f logs/agent.log
```

### GUI won't start

```bash
# Check node_modules
cd webapp && npm install

# Check logs
tail -f logs/nextjs.log

# Rebuild
make build-gui
```

### Can't connect with TUI

```bash
# Test agent health
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/health

# Check token matches
echo $DOCKLITE_TOKEN

# Try with environment variable
DOCKLITE_URL=http://localhost:3000 DOCKLITE_TOKEN=YOUR_TOKEN ./bin/docklite-tui
```

## Distribution

### Create Release Package

```bash
# Create tarball
cd /home
tar czf docklite-complete-$(date +%Y%m%d).tar.gz \
  --exclude='docklite-new/webapp/node_modules' \
  --exclude='docklite-new/webapp/.next' \
  --exclude='docklite-new/data' \
  --exclude='docklite-new/logs' \
  docklite-new/

# Users extract and run:
tar xzf docklite-complete-*.tar.gz
cd docklite-new
./start-fullstack.sh
```

### Binary-Only Distribution

For just the binaries without source:

```bash
mkdir docklite-binaries
cp bin/* docklite-binaries/
cp start-*.sh stop-all.sh docklite-binaries/
cp README.md DEPLOYMENT.md docklite-binaries/
tar czf docklite-binaries.tar.gz docklite-binaries/
```

## What's Next?

### Immediate Steps

1. **Test Full Stack**:
   ```bash
   ./start-fullstack.sh
   ```

2. **Log in to Web GUI**:
   - URL: http://localhost:3000
   - User: `superadmin`
   - Pass: `admin`

3. **Change Password**: Settings → Password

4. **Test TUI**: Use token from startup

### Optional Enhancements

- Set up systemd services for auto-start
- Configure HTTPS with Let's Encrypt
- Set up backup destinations (S3, etc.)
- Configure DNS management (Cloudflare)
- Create additional user accounts
- Customize container templates

## Support & Documentation

- **README.md** - Quick start
- **DEPLOYMENT.md** - Detailed deployment
- **CLAUDE.md** - Architecture & patterns (in webapp/)
- **webapp/lib/** - Code documentation

## Summary

You now have the **complete DockLite stack** ready to deploy:

✅ **Agent**: Go-based API server with Docker integration
✅ **TUI**: Bubble Tea terminal interface
✅ **GUI**: Full Next.js web dashboard
✅ **Build System**: Makefile for all components
✅ **Startup Scripts**: One-command deployment
✅ **Documentation**: Complete guides
✅ **Three Modes**: Headless, TUI, or Full Stack

**Start now:**
```bash
cd /home/docklite-new
./start-fullstack.sh
```

Then open http://localhost:3000 and enjoy! 🚀
