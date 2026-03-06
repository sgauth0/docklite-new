package handlers

import (
	"context"
	"time"
)

const dockerOpTimeout = 30 * time.Second

func dockerContext(parent context.Context) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithTimeout(parent, dockerOpTimeout)
}
