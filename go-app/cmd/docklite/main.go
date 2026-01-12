package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"docklite-agent/internal/cli"
)

const version = "dev"

type globalOptions struct {
	Server  string
	Host    string
	Token   string
	JSON    bool
	Quiet   bool
	Verbose bool
	NoColor bool
	Timeout time.Duration
	Yes     bool
}

func main() {
	opts, args := parseGlobalFlags(os.Args[1:])
	if len(args) == 0 || args[0] == "help" {
		printUsage()
		return
	}

	cfg, cfgPath, err := cli.LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to load config:", err)
		os.Exit(1)
	}

	client, err := resolveClient(cfg, opts)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	switch args[0] {
	case "version":
		fmt.Println("docklite", version)
	case "status":
		runGet(client, opts, "/api/status")
	case "info":
		runGet(client, opts, "/api/summary")
	case "list":
		runList(client, opts, args[1:])
	case "tokens":
		runGet(client, opts, "/api/tokens")
	case "token":
		handleToken(client, opts, args[1:])
	case "config":
		handleConfig(cfg, cfgPath, args[1:])
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", args[0])
		printUsage()
		os.Exit(1)
	}
}

func parseGlobalFlags(args []string) (globalOptions, []string) {
	opts := globalOptions{Timeout: 15 * time.Second}
	fs := flag.NewFlagSet("docklite", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	fs.StringVar(&opts.Server, "server", "", "server profile name")
	fs.StringVar(&opts.Host, "host", "", "agent base URL")
	fs.StringVar(&opts.Token, "token", "", "agent token")
	fs.BoolVar(&opts.JSON, "json", false, "json output")
	fs.BoolVar(&opts.Quiet, "quiet", false, "quiet output")
	fs.BoolVar(&opts.Verbose, "verbose", false, "verbose output")
	fs.BoolVar(&opts.NoColor, "no-color", false, "disable color")
	fs.DurationVar(&opts.Timeout, "timeout", 15*time.Second, "request timeout")
	fs.BoolVar(&opts.Yes, "yes", false, "auto-confirm")

	_ = fs.Parse(args)
	return opts, fs.Args()
}

func resolveClient(cfg *cli.Config, opts globalOptions) (*cli.Client, error) {
	host := strings.TrimSpace(opts.Host)
	token := strings.TrimSpace(opts.Token)
	if host == "" {
		if env := strings.TrimSpace(os.Getenv("DOCKLITE_HOST")); env != "" {
			host = env
		}
	}
	if token == "" {
		if env := strings.TrimSpace(os.Getenv("DOCKLITE_TOKEN")); env != "" {
			token = env
		}
	}

	serverName := opts.Server
	if serverName == "" {
		serverName = cfg.CurrentServer
	}
	if host == "" && serverName != "" {
		if server, ok := cfg.Servers[serverName]; ok {
			host = server.Host
			if token == "" {
				token = server.Token
			}
		}
	}

	if host == "" {
		host = cli.DefaultHost()
	}

	return &cli.Client{
		BaseURL: host,
		Token:   token,
		Timeout: opts.Timeout,
	}, nil
}

func runGet(client *cli.Client, opts globalOptions, path string) {
	data, err := client.Do(context.Background(), httpMethodGet, path, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if opts.JSON {
		fmt.Println(string(data))
		return
	}
	var payload any
	if err := json.Unmarshal(data, &payload); err != nil {
		fmt.Println(string(data))
		return
	}
	pretty, _ := json.MarshalIndent(payload, "", "  ")
	fmt.Println(string(pretty))
}

func runList(client *cli.Client, opts globalOptions, args []string) {
	_ = args
	data, err := client.Do(context.Background(), httpMethodGet, "/api/containers/all", nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if opts.JSON {
		fmt.Println(string(data))
		return
	}
	var resp struct {
		Containers []struct {
			ID     string `json:"id"`
			Name   string `json:"name"`
			Status string `json:"status"`
			State  string `json:"state"`
		} `json:"containers"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		fmt.Println(string(data))
		return
	}
	for _, c := range resp.Containers {
		id := c.ID
		if len(id) > 12 {
			id = id[:12]
		}
		fmt.Printf("%s\t%s\t%s\t%s\n", id, c.Name, c.State, c.Status)
	}
}

func handleToken(client *cli.Client, opts globalOptions, args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "token subcommand required")
		os.Exit(1)
	}
	switch args[0] {
	case "create":
		handleTokenCreate(client, opts, args[1:])
	case "revoke":
		handleTokenRevoke(client, opts, args[1:])
	default:
		fmt.Fprintln(os.Stderr, "unknown token subcommand:", args[0])
		os.Exit(1)
	}
}

func handleTokenCreate(client *cli.Client, opts globalOptions, args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "token name required")
		os.Exit(1)
	}
	name := args[0]
	payload := map[string]any{"name": name}
	data, err := client.Do(context.Background(), httpMethodPost, "/api/tokens", payload)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if opts.JSON {
		fmt.Println(string(data))
		return
	}
	var resp struct {
		Token map[string]any `json:"token"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		fmt.Println(string(data))
		return
	}
	pretty, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(pretty))
}

func handleTokenRevoke(client *cli.Client, opts globalOptions, args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "token id required")
		os.Exit(1)
	}
	id, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil || id <= 0 {
		fmt.Fprintln(os.Stderr, "invalid token id")
		os.Exit(1)
	}
	payload := map[string]any{"id": id}
	data, err := client.Do(context.Background(), httpMethodPost, "/api/tokens/revoke", payload)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if opts.JSON {
		fmt.Println(string(data))
		return
	}
	fmt.Println("token revoked")
}

func handleConfig(cfg *cli.Config, cfgPath string, args []string) {
	if len(args) == 0 || args[0] == "show" {
		out, _ := json.MarshalIndent(cfg, "", "  ")
		fmt.Println(string(out))
		return
	}
	switch args[0] {
	case "set":
		if len(args) < 3 {
			fmt.Fprintln(os.Stderr, "usage: docklite config set <key> <value>")
			os.Exit(1)
		}
		if err := setConfigValue(cfg, args[1], args[2]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		if err := cli.SaveConfig(cfg, cfgPath); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	case "get":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "usage: docklite config get <key>")
			os.Exit(1)
		}
		value, err := getConfigValue(cfg, args[1])
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Println(value)
	case "reset":
		cfg = &cli.Config{
			CurrentServer: "default",
			Servers: map[string]cli.ServerConfig{
				"default": {Host: cli.DefaultHost(), Token: ""},
			},
		}
		if err := cli.SaveConfig(cfg, cfgPath); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	default:
		fmt.Fprintln(os.Stderr, "unknown config subcommand:", args[0])
		os.Exit(1)
	}
}

func setConfigValue(cfg *cli.Config, key string, value string) error {
	switch key {
	case "current_server":
		cfg.CurrentServer = value
		return nil
	}
	if strings.HasPrefix(key, "servers.") {
		parts := strings.Split(key, ".")
		if len(parts) != 3 {
			return fmt.Errorf("invalid key: %s", key)
		}
		name := parts[1]
		field := parts[2]
		server := cfg.Servers[name]
		switch field {
		case "host":
			server.Host = value
		case "token":
			server.Token = value
		default:
			return fmt.Errorf("unknown server field: %s", field)
		}
		if cfg.Servers == nil {
			cfg.Servers = map[string]cli.ServerConfig{}
		}
		cfg.Servers[name] = server
		return nil
	}
	return fmt.Errorf("unknown key: %s", key)
}

func getConfigValue(cfg *cli.Config, key string) (string, error) {
	switch key {
	case "current_server":
		return cfg.CurrentServer, nil
	}
	if strings.HasPrefix(key, "servers.") {
		parts := strings.Split(key, ".")
		if len(parts) != 3 {
			return "", fmt.Errorf("invalid key: %s", key)
		}
		name := parts[1]
		field := parts[2]
		server, ok := cfg.Servers[name]
		if !ok {
			return "", fmt.Errorf("server not found: %s", name)
		}
		switch field {
		case "host":
			return server.Host, nil
		case "token":
			return server.Token, nil
		default:
			return "", fmt.Errorf("unknown server field: %s", field)
		}
	}
	return "", fmt.Errorf("unknown key: %s", key)
}

func printUsage() {
	fmt.Print(`docklite <command> [flags]

Commands:
  help
  version
  status
  info
  list
  tokens
  token create <name>
  token revoke <id>
  config [show|get|set|reset]
`)
}

const httpMethodGet = "GET"
const httpMethodPost = "POST"
