package handlers

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type createDatabaseRequest struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Password string `json:"password"`
	Port     *int   `json:"port"`
}

func (h *Handlers) Databases(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listDatabases(w, r)
	case http.MethodPost:
		h.createDatabase(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handlers) listDatabases(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	databases, err := h.docker.ListDatabases(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"databases": databases})
}

func (h *Handlers) createDatabase(w http.ResponseWriter, r *http.Request) {
	var req createDatabaseRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	sanitized := sanitizeDatabaseName(name)
	if sanitized == "" {
		writeError(w, http.StatusBadRequest, "invalid database name")
		return
	}

	port := 0
	if req.Port != nil {
		port = *req.Port
		if port < 1 || port > 65535 {
			writeError(w, http.StatusBadRequest, "invalid port")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	id, assignedPort, username, password, err := h.docker.CreateDatabaseContainer(ctx, sanitized, req.Username, req.Password, port)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"database": map[string]any{
			"id":       id,
			"name":     sanitized,
			"port":     assignedPort,
			"username": username,
			"password": password,
		},
		"connection": map[string]any{
			"host":     "localhost",
			"port":     assignedPort,
			"database": sanitized,
			"username": username,
			"password": password,
		},
	})
}

func sanitizeDatabaseName(name string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_]`)
	sanitized := re.ReplaceAllString(name, "_")
	return strings.Trim(sanitized, "_")
}
