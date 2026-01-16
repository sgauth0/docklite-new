# Repository Guidelines

## Project Structure & Module Organization
- `go-app/`: Go agent API server (Docker integration, HTTP handlers, SQLite storage in `internal/`).
- `cli-repo/`: Go TUI client.
- `webapp/`: Next.js dashboard (App Router in `app/`, server helpers in `lib/`, assets in `public/`).
- `bin/`: Built binaries (`docklite-agent`, `docklite-tui`).
- `data/`: Local SQLite DB files (e.g., `data/docklite.db`).
- Root scripts: `start-fullstack.sh`, `start-agent.sh`, `start-tui.sh`, `stop-all.sh`.

## Build, Test, and Development Commands
- `make build-all`: Build agent, TUI, and GUI.
- `make build-agent` / `make build-tui` / `make build-gui`: Build each component.
- `make run-agent` / `make run-tui` / `make run-gui`: Dev mode for each component.
- `./start-fullstack.sh`: Launch agent + web UI + TUI together.
- `./start-agent.sh` and `./start-tui.sh`: Headless mode.
- Webapp scripts in `webapp/`: `npm run dev`, `npm run build`, `npm start`, `npm run lint`.

## Coding Style & Naming Conventions
- Go: run `gofmt` on all Go files; keep package layout under `go-app/internal/`.
- Webapp: follow existing TypeScript/TSX formatting; lint with `npm run lint` in `webapp/`.
- Naming: Go files use `snake_case.go`, React components use `PascalCase.tsx`, API routes live under `webapp/app/api/`.

## Testing Guidelines
- There is no dedicated automated test suite in this repo today.
- If you add tests, prefer Go `_test.go` files (run with `go test ./...` from `go-app/`) and colocate web UI tests near `webapp/` modules.
- For changes without tests, do a quick manual pass: start the relevant service and validate the UI/API path you touched.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative summaries (e.g., `Fix ...`, `Add ...`). Follow that style.
- PRs should include: a brief description, key commands run, and any linked issue.
- UI changes should include screenshots (or a short GIF) from the dashboard.

## Security & Configuration Tips
- Environment defaults live in `README.md`; `webapp/.env.example` shows GUI variables.
- Tokens should be 32+ chars (example: `openssl rand -hex 32`).
- Avoid committing real credentials or production databases in `data/`.
