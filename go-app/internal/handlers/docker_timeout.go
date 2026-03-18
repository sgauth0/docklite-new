package handlers

import (
	"context"
	"time"
)

const (
	dockerOpTimeout    = 30 * time.Second
	dockerCreateTimeout = 15 * time.Minute
)

func dockerContext(parent context.Context) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithTimeout(parent, dockerOpTimeout)
}

// ctxWithLongTimeout returns a context suitable for image pulls + container
// creation, which can take several minutes on a cold host.
func ctxWithLongTimeout() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), dockerCreateTimeout)
}
