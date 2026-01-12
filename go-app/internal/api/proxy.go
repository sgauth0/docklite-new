package api

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
)

// ProxyHandler creates a reverse proxy handler to forward requests to Next.js
func ProxyHandler(nextjsURL string) http.Handler {
	target, err := url.Parse(nextjsURL)
	if err != nil {
		log.Fatalf("failed to parse Next.js URL: %v", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Customize the director to preserve the original request
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
		req.Header.Set("X-Forwarded-Proto", "http")
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("proxy error: %v", err)
		http.Error(w, "Next.js app unavailable", http.StatusBadGateway)
	}

	return proxy
}
