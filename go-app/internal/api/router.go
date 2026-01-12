package api

import (
	"net/http"
	"strings"

	"docklite-agent/internal/handlers"
)

func NewRouter(handlers *handlers.Handlers, nextjsURL string) http.Handler {
	mux := http.NewServeMux()

	// Agent-handled API routes (Docker operations)
	mux.HandleFunc("/api/health", handlers.Auth(handlers.Health))
	mux.HandleFunc("/api/status", handlers.Auth(handlers.Status))
	mux.HandleFunc("/api/summary", handlers.Auth(handlers.Summary))
	mux.HandleFunc("/api/containers", handlers.Auth(handlers.ListContainers))
	mux.HandleFunc("/api/containers/all", handlers.Auth(handlers.ListAllContainers))
	mux.HandleFunc("/api/containers/", handlers.Auth(handlers.Container))
	mux.HandleFunc("/api/databases", handlers.Auth(handlers.Databases))
	mux.HandleFunc("/api/databases/stats", handlers.Auth(handlers.DatabaseStats))
	mux.HandleFunc("/api/databases/", handlers.Auth(handlers.DatabaseRoutes))
	mux.HandleFunc("/api/files", handlers.Auth(handlers.Files))
	mux.HandleFunc("/api/files/content", handlers.Auth(handlers.FileContent))
	mux.HandleFunc("/api/files/create", handlers.Auth(handlers.CreatePath))
	mux.HandleFunc("/api/files/delete", handlers.Auth(handlers.DeletePath))
	mux.HandleFunc("/api/files/rename", handlers.Auth(handlers.RenamePath))
	mux.HandleFunc("/api/files/upload", handlers.Auth(handlers.UploadFile))
	mux.HandleFunc("/api/files/download", handlers.Auth(handlers.DownloadFile))
	mux.HandleFunc("/api/files/transfer", handlers.Auth(handlers.TransferFile))
	mux.HandleFunc("/api/files/folder", handlers.Auth(handlers.DeleteFolder))
	mux.HandleFunc("/api/server/stats", handlers.Auth(handlers.ServerStats))
	mux.HandleFunc("/api/ports/suggest", handlers.Auth(handlers.SuggestPort))
	mux.HandleFunc("/api/folders", handlers.Auth(handlers.Folders))
	mux.HandleFunc("/api/folders/", handlers.Auth(handlers.FolderRoutes))
	mux.HandleFunc("/api/backups", handlers.Auth(handlers.Backups))
	mux.HandleFunc("/api/backups/destinations", handlers.Auth(handlers.BackupDestinations))
	mux.HandleFunc("/api/backups/jobs", handlers.Auth(handlers.BackupJobs))
	mux.HandleFunc("/api/backups/history", handlers.Auth(handlers.BackupHistory))
	mux.HandleFunc("/api/backups/local", handlers.Auth(handlers.LocalBackups))
	mux.HandleFunc("/api/backups/local/download", handlers.Auth(handlers.LocalBackupDownload))
	mux.HandleFunc("/api/backups/trigger", handlers.Auth(handlers.BackupTrigger))
	mux.HandleFunc("/api/dns/config", handlers.Auth(handlers.DNSConfig))
	mux.HandleFunc("/api/dns/zones", handlers.Auth(handlers.DNSZones))
	mux.HandleFunc("/api/dns/records", handlers.Auth(handlers.DNSRecords))
	mux.HandleFunc("/api/dns/sync", handlers.Auth(handlers.DNSSync))
	mux.HandleFunc("/api/ssl", handlers.Auth(handlers.SSLBasic))
	mux.HandleFunc("/api/ssl/status", handlers.Auth(handlers.SSLStatus))
	mux.HandleFunc("/api/ssl/repair", handlers.Auth(handlers.SSLRepair))
	mux.HandleFunc("/api/users", handlers.Auth(handlers.Users))
	mux.HandleFunc("/api/users/password", handlers.Auth(handlers.UserPassword))
	mux.HandleFunc("/api/system/check-folders", handlers.Auth(handlers.SystemCheckFolders))
	mux.HandleFunc("/api/db/cleanup", handlers.Auth(handlers.DBCleanup))
	mux.HandleFunc("/api/db", handlers.Auth(handlers.DBDebug))
	mux.HandleFunc("/api/debug", handlers.Auth(handlers.Debug))
	mux.HandleFunc("/api/tokens", handlers.Auth(handlers.Tokens))
	mux.HandleFunc("/api/tokens/revoke", handlers.Auth(handlers.TokenRevoke))
	mux.HandleFunc("/api/auth/me", handlers.Auth(handlers.AuthMe))
	mux.HandleFunc("/api/auth/logout", handlers.Auth(handlers.AuthLogout))

	// Proxy for Next.js (optional)
	var proxy http.Handler
	if nextjsURL != "" {
		proxy = ProxyHandler(nextjsURL)
	}

	// Wrap the mux with a handler that proxies non-API routes
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is an agent-handled route
		if strings.HasPrefix(r.URL.Path, "/api/health") ||
			strings.HasPrefix(r.URL.Path, "/api/status") ||
			strings.HasPrefix(r.URL.Path, "/api/summary") ||
			strings.HasPrefix(r.URL.Path, "/api/containers") ||
			strings.HasPrefix(r.URL.Path, "/api/databases") ||
			strings.HasPrefix(r.URL.Path, "/api/files") ||
			strings.HasPrefix(r.URL.Path, "/api/server") ||
			strings.HasPrefix(r.URL.Path, "/api/ports") ||
			strings.HasPrefix(r.URL.Path, "/api/folders") ||
			strings.HasPrefix(r.URL.Path, "/api/backups") ||
			strings.HasPrefix(r.URL.Path, "/api/dns") ||
			strings.HasPrefix(r.URL.Path, "/api/ssl") ||
			strings.HasPrefix(r.URL.Path, "/api/users") ||
			strings.HasPrefix(r.URL.Path, "/api/system") ||
			strings.HasPrefix(r.URL.Path, "/api/db/cleanup") ||
			strings.HasPrefix(r.URL.Path, "/api/db") ||
			strings.HasPrefix(r.URL.Path, "/api/debug") ||
			strings.HasPrefix(r.URL.Path, "/api/tokens") ||
			strings.HasPrefix(r.URL.Path, "/api/auth/me") ||
			strings.HasPrefix(r.URL.Path, "/api/auth/logout") {
			// Agent handles this
			mux.ServeHTTP(w, r)
		} else if proxy != nil {
			// Proxy everything else to Next.js
			proxy.ServeHTTP(w, r)
		} else {
			http.NotFound(w, r)
		}
	})
}
