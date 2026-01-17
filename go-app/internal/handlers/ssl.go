package handlers

import (
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
)

const (
	defaultTraefikAPI  = "http://localhost:8080"
	defaultTraefikName = "docklite_traefik"
)

type traefikRouter struct {
	Name     string `json:"name"`
	Rule     string `json:"rule"`
	Provider string `json:"provider"`
	TLS      *struct {
		CertResolver string `json:"certResolver"`
		Options      string `json:"options"`
	} `json:"tls"`
}

type certificateEntry struct {
	Domain struct {
		Main string   `json:"main"`
		Sans []string `json:"sans"`
	} `json:"domain"`
	Certificate string `json:"certificate"`
	Key         string `json:"key"`
}

type sslStatus struct {
	Domain          string  `json:"domain"`
	HasSSL          bool    `json:"hasSSL"`
	ExpiryDate      *string `json:"expiryDate"`
	DaysUntilExpiry *int    `json:"daysUntilExpiry"`
	Status          string  `json:"status"`
}

func (h *Handlers) SSLStatus(w http.ResponseWriter, r *http.Request) {
	if !isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	trafURL := os.Getenv("TRAEFIK_API_URL")
	if trafURL == "" {
		trafURL = defaultTraefikAPI
	}

	uniqueHosts := make([]map[string]string, 0)

	routers, err := fetchTraefikRouters(trafURL)
	if err == nil {
		for _, router := range routers {
			if router.Provider != "docker" || !strings.Contains(strings.ToLower(router.Name), "docklite") {
				continue
			}
			hosts := getHostsFromRule(router.Rule)
			for _, host := range hosts {
				entry := map[string]string{"host": host}
				if router.TLS != nil && router.TLS.CertResolver != "" {
					entry["tlsResolver"] = router.TLS.CertResolver
				}
				uniqueHosts = append(uniqueHosts, entry)
			}
		}
	}

	if len(uniqueHosts) == 0 {
		ctx, cancel := dockerContext(r.Context())
		defer cancel()
		containers, err := h.docker.ListContainers(ctx, true)
		if err == nil {
			hostEntries := make([]map[string]string, 0)
			for _, c := range containers {
				if c.Labels == nil || c.Labels["docklite.managed"] != "true" {
					continue
				}
				for key, value := range c.Labels {
					if !strings.HasPrefix(key, "traefik.http.routers.") || !strings.HasSuffix(key, ".rule") {
						continue
					}
					hosts := getHostsFromRule(value)
					parts := strings.Split(key, ".")
					routerName := ""
					if len(parts) >= 4 {
						routerName = parts[3]
					}
					resolver := c.Labels["traefik.http.routers."+routerName+".tls.certresolver"]
					for _, host := range hosts {
						entry := map[string]string{"host": host}
						if resolver != "" {
							entry["tlsResolver"] = resolver
						}
						hostEntries = append(hostEntries, entry)
					}
				}
			}
			uniqueHosts = dedupeHosts(hostEntries)
		}
	}

	sites, err := h.store.ListSites()
	if err == nil {
		known := map[string]bool{}
		for _, host := range uniqueHosts {
			known[host["host"]] = true
		}
		for _, site := range sites {
			if !known[site.Domain] {
				uniqueHosts = append(uniqueHosts, map[string]string{"host": site.Domain, "tlsResolver": "letsencrypt"})
				known[site.Domain] = true
			}
		}
	}

	certEntries, certSource := loadCertificates(trafURL)
	certMap := buildCertMap(certEntries)

	managed := []sslStatus{}
	all := []sslStatus{}

	for _, hostEntry := range uniqueHosts {
		host := hostEntry["host"]
		tlsResolver := hostEntry["tlsResolver"]
		hasTLS := tlsResolver == "letsencrypt"
		if !hasTLS {
			managed = append(managed, sslStatus{Domain: host, HasSSL: false, Status: "none"})
			continue
		}
		entry := certMap[host]
		if entry == nil {
			entry = certMap[strings.TrimPrefix(host, "www.")]
		}
		expiryDate, daysUntilExpiry, status := getExpiry(entry)
		managed = append(managed, sslStatus{
			Domain:          host,
			HasSSL:          entry != nil,
			ExpiryDate:      expiryDate,
			DaysUntilExpiry: daysUntilExpiry,
			Status:          status,
		})
	}

	for host, entry := range certMap {
		expiryDate, daysUntilExpiry, status := getExpiry(entry)
		all = append(all, sslStatus{
			Domain:          host,
			HasSSL:          true,
			ExpiryDate:      expiryDate,
			DaysUntilExpiry: daysUntilExpiry,
			Status:          status,
		})
	}

	response := map[string]any{
		"sites":    managed,
		"allSites": all,
		"meta": map[string]any{
			"acmePath":     certSource,
			"certCount":    len(certEntries),
			"hostsFound":   len(uniqueHosts),
			"managedCount": len(managed),
			"allCount":     len(all),
		},
	}
	if len(managed) == 0 {
		response["sites"] = all
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handlers) SSLRepair(w http.ResponseWriter, r *http.Request) {
	if !isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		Domain string `json:"domain"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Domain == "" {
		writeError(w, http.StatusBadRequest, "Domain is required")
		return
	}

	trafName := os.Getenv("TRAEFIK_CONTAINER_NAME")
	if trafName == "" {
		trafName = defaultTraefikName
	}

	ctx, cancel := dockerContext(r.Context())
	defer cancel()

	args := filters.NewArgs()
	args.Add("name", trafName)
	containers, err := h.docker.Client.ContainerList(ctx, container.ListOptions{All: true, Filters: args})
	if err != nil || len(containers) == 0 {
		writeError(w, http.StatusNotFound, "Traefik container not found")
		return
	}

	if err := h.docker.Client.ContainerRestart(ctx, containers[0].ID, container.StopOptions{}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to restart Traefik")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Repair triggered for " + body.Domain})
}

func (h *Handlers) SSLBasic(w http.ResponseWriter, r *http.Request) {
	if !isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	trafURL := os.Getenv("TRAEFIK_API_URL")
	if trafURL == "" {
		trafURL = defaultTraefikAPI
	}
	routers, err := fetchTraefikRouters(trafURL)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"sslStatus": []any{}})
		return
	}
	status := []map[string]string{}
	for _, router := range routers {
		if router.TLS == nil || router.Rule == "" {
			continue
		}
		hosts := getHostsFromRule(router.Rule)
		for _, host := range hosts {
			status = append(status, map[string]string{
				"domain": host,
				"expiry": "Unknown",
			})
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"sslStatus": status})
}

func isAuthenticated(r *http.Request) bool {
	if _, ok := readUserIDFromContext(r); ok {
		return true
	}
	if role, ok := readUserRoleFromContext(r); ok && role != "" {
		return true
	}
	if r.Header.Get("X-Docklite-Token") != "" {
		return true
	}
	return false
}

func fetchTraefikRouters(trafURL string) ([]traefikRouter, error) {
	resp, err := http.Get(trafURL + "/api/http/routers")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, errors.New("traefik api error")
	}
	var routers []traefikRouter
	if err := json.NewDecoder(resp.Body).Decode(&routers); err != nil {
		return nil, err
	}
	return routers, nil
}

func loadCertificates(trafURL string) ([]certificateEntry, string) {
	entries, path := loadAcme()
	if len(entries) == 0 {
		apiEntries, apiPath := loadTraefikCertificates(trafURL)
		if len(apiEntries) > 0 {
			return apiEntries, apiPath
		}
	}
	return entries, path
}

func loadAcme() ([]certificateEntry, string) {
	candidates := acmePaths()
	for _, candidate := range candidates {
		raw, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		var payload map[string]any
		if err := json.Unmarshal(raw, &payload); err != nil {
			continue
		}
		entries := extractCertificates(payload)
		if len(entries) > 0 {
			return entries, candidate
		}
	}
	return nil, ""
}

func loadTraefikCertificates(trafURL string) ([]certificateEntry, string) {
	resp, err := http.Get(trafURL + "/api/tls/certificates")
	if err != nil {
		return nil, ""
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, ""
	}
	var entries []certificateEntry
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		return nil, ""
	}
	return entries, trafURL + "/api/tls/certificates"
}

func acmePaths() []string {
	value := os.Getenv("ACME_PATHS")
	if value == "" {
		value = os.Getenv("ACME_PATH")
	}
	parts := []string{}
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			parts = append(parts, item)
		}
	}
	parts = append(parts, "/letsencrypt/acme.json")
	unique := map[string]bool{}
	results := []string{}
	for _, item := range parts {
		if !unique[item] {
			unique[item] = true
			results = append(results, item)
		}
	}
	return results
}

func extractCertificates(payload map[string]any) []certificateEntry {
	if letsencrypt, ok := payload["letsencrypt"].(map[string]any); ok {
		if certs, ok := letsencrypt["Certificates"].([]any); ok {
			return parseCertEntries(certs)
		}
	}
	if certs, ok := payload["Certificates"].([]any); ok {
		return parseCertEntries(certs)
	}
	return nil
}

func parseCertEntries(raw []any) []certificateEntry {
	entries := []certificateEntry{}
	for _, item := range raw {
		bytes, err := json.Marshal(item)
		if err != nil {
			continue
		}
		var entry certificateEntry
		if err := json.Unmarshal(bytes, &entry); err != nil {
			continue
		}
		if entry.Domain.Main == "" {
			continue
		}
		entries = append(entries, entry)
	}
	return entries
}

func buildCertMap(entries []certificateEntry) map[string]*certificateEntry {
	result := map[string]*certificateEntry{}
	for i := range entries {
		entry := &entries[i]
		if entry.Domain.Main != "" {
			result[entry.Domain.Main] = entry
		}
		for _, san := range entry.Domain.Sans {
			result[san] = entry
		}
	}
	return result
}

var hostRuleRegex = regexp.MustCompile("`([^`]+)`")

func getHostsFromRule(rule string) []string {
	matches := hostRuleRegex.FindAllStringSubmatch(rule, -1)
	hosts := []string{}
	for _, match := range matches {
		if len(match) > 1 {
			hosts = append(hosts, strings.TrimSpace(match[1]))
		}
	}
	return hosts
}

func getExpiry(entry *certificateEntry) (*string, *int, string) {
	if entry == nil || entry.Certificate == "" {
		return nil, nil, "none"
	}
	certBytes := []byte(entry.Certificate)
	if !strings.Contains(entry.Certificate, "BEGIN CERTIFICATE") {
		decoded, err := base64.StdEncoding.DecodeString(entry.Certificate)
		if err == nil {
			certBytes = decoded
		}
	}
	var derBytes []byte
	if block, _ := pem.Decode(certBytes); block != nil {
		derBytes = block.Bytes
	} else {
		derBytes = certBytes
	}
	cert, err := x509.ParseCertificate(derBytes)
	if err != nil {
		return nil, nil, "none"
	}
	expiry := cert.NotAfter.UTC()
	expiryStr := expiry.Format(time.RFC3339)
	days := int(expiry.Sub(time.Now().UTC()).Hours() / 24)
	status := "valid"
	if days < 0 {
		status = "expired"
	} else if days < 30 {
		status = "expiring"
	}
	return &expiryStr, &days, status
}

func dedupeHosts(entries []map[string]string) []map[string]string {
	seen := map[string]map[string]string{}
	for _, entry := range entries {
		host := entry["host"]
		if host == "" {
			continue
		}
		if _, ok := seen[host]; !ok {
			seen[host] = entry
		}
	}
	result := []map[string]string{}
	for _, entry := range seen {
		result = append(result, entry)
	}
	return result
}
