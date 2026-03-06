package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
)

func (c *Client) ExecShell(ctx context.Context, containerID string) (types.HijackedResponse, string, error) {
	execConfig := types.ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		AttachStdin:  true,
		Tty:          true,
		Cmd: []string{
			"sh",
			"-lc",
			"if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi",
		},
	}
	execResp, err := c.Client.ContainerExecCreate(ctx, containerID, execConfig)
	if err != nil {
		return types.HijackedResponse{}, "", err
	}
	attachResp, err := c.Client.ContainerExecAttach(ctx, execResp.ID, types.ExecStartCheck{Tty: true})
	if err != nil {
		return types.HijackedResponse{}, "", err
	}
	return attachResp, execResp.ID, nil
}

func (c *Client) ResizeExec(ctx context.Context, execID string, cols, rows int) error {
	if cols <= 0 || rows <= 0 {
		return nil
	}
	return c.Client.ContainerExecResize(ctx, execID, container.ResizeOptions{
		Height: uint(rows),
		Width:  uint(cols),
	})
}
