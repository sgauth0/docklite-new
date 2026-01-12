package models

type NetworkStats struct {
	RxBytes uint64 `json:"rxBytes"`
	TxBytes uint64 `json:"txBytes"`
}

type DiskUsage struct {
	Total uint64 `json:"total"`
	Free  uint64 `json:"free"`
	Used  uint64 `json:"used"`
}

type StatusResponse struct {
	Hostname       string       `json:"hostname"`
	Platform       string       `json:"platform"`
	Arch           string       `json:"arch"`
	CPUs           int          `json:"cpus"`
	TotalMemory    uint64       `json:"totalMemory"`
	FreeMemory     uint64       `json:"freeMemory"`
	Uptime         float64      `json:"uptime"`
	DockerVersion  string       `json:"dockerVersion"`
	ContainerCount int          `json:"containerCount"`
	ImageCount     int          `json:"imageCount"`
	CPUUsage       float64      `json:"cpuUsage"`
	DiskUsage      DiskUsage    `json:"diskUsage"`
	NetworkStats   NetworkStats `json:"networkStats"`
}
