package models

type ContainerInfo struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Image         string            `json:"image"`
	Created       int64             `json:"created"`
	State         string            `json:"state"`
	Status        string            `json:"status"`
	Uptime        string            `json:"uptime,omitempty"`
	Ports         string            `json:"ports,omitempty"`
	Labels        map[string]string `json:"labels"`
	OwnerUsername string            `json:"owner_username,omitempty"`
}

type ContainerStats struct {
	CPUUsage    float64 `json:"cpuUsage"`
	MemoryUsage uint64  `json:"memoryUsage"`
	MemoryLimit uint64  `json:"memoryLimit"`
	MemoryPct   float64 `json:"memoryPct"`
}
