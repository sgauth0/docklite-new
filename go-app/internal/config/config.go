package config

import "os"

const (
	defaultListenAddr   = ":3000"
	defaultDockerSocket = "unix:///var/run/docker.sock"
	defaultDatabasePath = "data/docklite.db"
	defaultNextjsURL    = "http://localhost:3001"
	defaultBackupBase   = "/var/backups/docklite"
)

type Config struct {
	ListenAddr       string
	DockerSocketPath string
	DatabasePath     string
	Token            string
	NextjsURL        string
	BackupBaseDir    string
}

func Load() Config {
	nextjsURL := defaultNextjsURL
	if value, ok := os.LookupEnv("NEXTJS_URL"); ok {
		nextjsURL = value
	}
	if nextjsURL == "disabled" || nextjsURL == "none" {
		nextjsURL = ""
	}

	return Config{
		ListenAddr:       getEnv("LISTEN_ADDR", defaultListenAddr),
		DockerSocketPath: getEnv("DOCKER_SOCKET_PATH", defaultDockerSocket),
		DatabasePath:     getEnv("DATABASE_PATH", defaultDatabasePath),
		Token:            getEnv("DOCKLITE_TOKEN", ""),
		NextjsURL:        nextjsURL,
		BackupBaseDir:    getEnv("BACKUP_BASE_DIR", defaultBackupBase),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
