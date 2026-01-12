package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const defaultNodePort = 3000

func (h *Handlers) SuggestPort(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	queryType := r.URL.Query().Get("type")
	if queryType != "node" {
		writeJSON(w, http.StatusOK, map[string]int{"port": defaultNodePort})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	containers, err := h.docker.ListContainers(ctx, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	used := make(map[int]struct{})
	for _, container := range containers {
		labels := container.Labels
		if labels == nil {
			continue
		}
		if labels["docklite.managed"] != "true" || labels["docklite.type"] != "node" {
			continue
		}
		for key, value := range labels {
			if !strings.Contains(key, "loadbalancer.server.port") {
				continue
			}
			port, err := strconv.Atoi(value)
			if err != nil {
				continue
			}
			used[port] = struct{}{}
		}
	}

	port := findNextPort(used, defaultNodePort, 3999)
	writeJSON(w, http.StatusOK, map[string]int{"port": port})
}

func findNextPort(used map[int]struct{}, start int, max int) int {
	for port := start; port <= max; port++ {
		if _, exists := used[port]; !exists {
			return port
		}
	}
	return start
}
