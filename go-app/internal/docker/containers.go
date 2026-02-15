package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"docklite-agent/internal/models"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

const (
	dockliteNetworkName = "docklite_network"
	staticImageName     = "nginx:alpine"
	phpImageName        = "webdevops/php-nginx:8.2-alpine"
	nodeImageName       = "node:20-alpine"
)

func (c *Client) ListContainers(ctx context.Context, all bool) ([]models.ContainerInfo, error) {
	containers, err := c.Client.ContainerList(ctx, container.ListOptions{All: all})
	if err != nil {
		return nil, err
	}
	results := make([]models.ContainerInfo, 0, len(containers))
	for _, item := range containers {
		name := ""
		if len(item.Names) > 0 {
			name = strings.TrimPrefix(item.Names[0], "/")
		}
		uptime := "-"
		if item.State == "running" && item.Created > 0 {
			uptime = formatUptime(time.Since(time.Unix(item.Created, 0)))
		}
		results = append(results, models.ContainerInfo{
			ID:      item.ID,
			Name:    name,
			Image:   item.Image,
			Created: item.Created,
			State:   item.State,
			Status:  item.Status,
			Uptime:  uptime,
			Ports:   formatPorts(item.Ports),
			Labels:  item.Labels,
		})
	}
	return results, nil
}

func (c *Client) StartContainer(ctx context.Context, id string) error {
	return c.Client.ContainerStart(ctx, id, container.StartOptions{})
}

func (c *Client) StopContainer(ctx context.Context, id string) error {
	return c.Client.ContainerStop(ctx, id, container.StopOptions{})
}

func (c *Client) RestartContainer(ctx context.Context, id string) error {
	return c.Client.ContainerRestart(ctx, id, container.StopOptions{})
}

func (c *Client) ContainerLogs(ctx context.Context, id string, tail string) (string, error) {
	options := container.LogsOptions{ShowStdout: true, ShowStderr: true, Tail: tail}
	reader, err := c.Client.ContainerLogs(ctx, id, options)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	bytes, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func (c *Client) ContainerStats(ctx context.Context, id string) (*models.ContainerStats, error) {
	stats, err := c.Client.ContainerStatsOneShot(ctx, id)
	if err != nil {
		return nil, err
	}
	defer stats.Body.Close()
	decoded, err := decodeStats(stats)
	if err != nil {
		return nil, err
	}
	return decoded, nil
}

func decodeStats(response types.ContainerStats) (*models.ContainerStats, error) {
	var stats types.StatsJSON
	if err := json.NewDecoder(response.Body).Decode(&stats); err != nil {
		return nil, err
	}
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)
	cpuPercent := 0.0
	if systemDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * float64(len(stats.CPUStats.CPUUsage.PercpuUsage)) * 100.0
	}
	memoryUsage := stats.MemoryStats.Usage
	memoryLimit := stats.MemoryStats.Limit
	memoryPercent := 0.0
	if memoryLimit > 0 {
		memoryPercent = (float64(memoryUsage) / float64(memoryLimit)) * 100.0
	}
	return &models.ContainerStats{
		CPUUsage:    cpuPercent,
		MemoryUsage: memoryUsage,
		MemoryLimit: memoryLimit,
		MemoryPct:   memoryPercent,
	}, nil
}

func (c *Client) InspectContainer(ctx context.Context, id string) (types.ContainerJSON, error) {
	return c.Client.ContainerInspect(ctx, id)
}

func (c *Client) RemoveContainer(ctx context.Context, id string) error {
	return c.Client.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})
}

func (c *Client) CreateSiteContainer(ctx context.Context, domain string, templateType string, includeWww bool, sitePath string, port int, siteID int64, userID int64, folderID *int64) (string, error) {
	if templateType == "" {
		templateType = "static"
	}
	if err := c.ensureNetwork(ctx, dockliteNetworkName); err != nil {
		return "", err
	}

	imageName := staticImageName
	internalPort := 80
	bindTarget := "/usr/share/nginx/html"
	readOnly := true
	var env []string
	var cmd []string
	workingDir := ""

	switch templateType {
	case "php":
		imageName = phpImageName
		bindTarget = "/app"
		readOnly = false
		env = []string{
			"WEB_DOCUMENT_ROOT=/app",
			"PHP_DISPLAY_ERRORS=1",
			"PHP_MEMORY_LIMIT=256M",
			"PHP_MAX_EXECUTION_TIME=300",
			"PHP_POST_MAX_SIZE=50M",
			"PHP_UPLOAD_MAX_FILESIZE=50M",
		}
	case "node":
		imageName = nodeImageName
		bindTarget = "/app"
		readOnly = false
		internalPort = port
		if internalPort <= 0 {
			internalPort = 3000
		}
		env = []string{
			"NODE_ENV=production",
			fmt.Sprintf("PORT=%d", internalPort),
		}
		cmd = []string{"npm", "start"}
		workingDir = "/app"
	case "static":
	default:
		return "", fmt.Errorf("unsupported template type: %s", templateType)
	}

	if err := c.pullImage(ctx, imageName); err != nil {
		return "", err
	}

	sanitized := sanitizeDomain(domain)
	labels := buildSiteLabels(domain, includeWww, templateType, internalPort, siteID, userID, folderID)
	portKey := nat.Port(fmt.Sprintf("%d/tcp", internalPort))
	bindMode := "ro"
	if !readOnly {
		bindMode = "rw"
	}

	config := &container.Config{
		Image:        imageName,
		Labels:       labels,
		ExposedPorts: nat.PortSet{portKey: struct{}{}},
		Env:          env,
		Cmd:          cmd,
		WorkingDir:   workingDir,
	}
	hostConfig := &container.HostConfig{
		Binds: []string{
			fmt.Sprintf("%s:%s:%s", sitePath, bindTarget, bindMode),
		},
		PortBindings: nat.PortMap{
			portKey: []nat.PortBinding{{HostPort: "0"}},
		},
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
		NetworkMode:   container.NetworkMode(dockliteNetworkName),
	}

	containerName := fmt.Sprintf("docklite-site-%s", sanitized)
	resp, err := c.Client.ContainerCreate(ctx, config, hostConfig, nil, nil, containerName)
	if err != nil && strings.Contains(err.Error(), "Conflict.") {
		containerName = fmt.Sprintf("docklite-site-%s-%d", sanitized, time.Now().Unix())
		resp, err = c.Client.ContainerCreate(ctx, config, hostConfig, nil, nil, containerName)
	}
	if err != nil {
		return "", err
	}
	if err := c.Client.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", err
	}
	return resp.ID, nil
}

func (c *Client) pullImage(ctx context.Context, imageName string) error {
	reader, err := c.Client.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	_, _ = io.Copy(io.Discard, reader)
	return nil
}

func (c *Client) ensureNetwork(ctx context.Context, name string) error {
	networks, err := c.Client.NetworkList(ctx, types.NetworkListOptions{})
	if err != nil {
		return err
	}
	for _, network := range networks {
		if network.Name == name {
			return nil
		}
	}
	_, err = c.Client.NetworkCreate(ctx, name, network.CreateOptions{})
	return err
}

func sanitizeDomain(domain string) string {
	var b strings.Builder
	for _, r := range domain {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			b.WriteByte('-')
		}
	}
	result := strings.Trim(b.String(), "-")
	if result == "" {
		return "site"
	}
	return strings.ToLower(result)
}

func formatUptime(duration time.Duration) string {
	seconds := int64(duration.Seconds())
	if seconds < 0 {
		seconds = 0
	}
	minutes := seconds / 60
	hours := minutes / 60
	days := hours / 24

	switch {
	case days > 0:
		return fmt.Sprintf("%dd %dh", days, hours%24)
	case hours > 0:
		return fmt.Sprintf("%dh %dm", hours, minutes%60)
	case minutes > 0:
		return fmt.Sprintf("%dm", minutes)
	default:
		return fmt.Sprintf("%ds", seconds)
	}
}

func formatPorts(ports []types.Port) string {
	if len(ports) == 0 {
		return "-"
	}
	parts := make([]string, 0, len(ports))
	for _, port := range ports {
		if port.PublicPort == 0 {
			continue
		}
		parts = append(parts, fmt.Sprintf("%d->%d", port.PublicPort, port.PrivatePort))
	}
	if len(parts) == 0 {
		return "-"
	}
	return strings.Join(parts, ", ")
}

func buildSiteLabels(domain string, includeWww bool, templateType string, internalPort int, siteID int64, userID int64, folderID *int64) map[string]string {
	caddyHosts := strings.ToLower(strings.TrimSpace(domain))
	if includeWww && !strings.HasPrefix(caddyHosts, "www.") {
		caddyHosts = caddyHosts + ", www." + caddyHosts
	}
	folderValue := ""
	if folderID != nil {
		folderValue = fmt.Sprintf("%d", *folderID)
	}
	return map[string]string{
		"docklite.managed":     "true",
		"docklite.site.id":     fmt.Sprintf("%d", siteID),
		"docklite.domain":      domain,
		"docklite.type":        templateType,
		"docklite.user.id":     fmt.Sprintf("%d", userID),
		"docklite.folder.id":   folderValue,
		"docklite.include_www": boolToLabel(includeWww),
		"caddy":                caddyHosts,
		"caddy.reverse_proxy":  fmt.Sprintf("{{upstreams %d}}", internalPort),
	}
}

func boolToLabel(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
