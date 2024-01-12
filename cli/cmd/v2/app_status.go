package v2

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/fatih/color"
	api "github.com/porter-dev/porter/api/client"
	"github.com/porter-dev/porter/api/server/handlers/porter_app"
)

const (
	// DefaultWaitTimeoutMinutes is the default timeout for waiting for an update-image to complete
	DefaultWaitTimeoutMinutes = 10
	// DefaultRetryFrequencySeconds is the default frequency for checking the status of an update-image
	DefaultRetryFrequencySeconds = 10
)

type WaitForAppRevisionStatusInput struct {
	ProjectID  uint
	ClusterID  uint
	AppName    string
	RevisionID string
	Client     api.Client
}

func WaitForAppRevisionStatus(ctx context.Context, input WaitForAppRevisionStatusInput) error {
	timeoutMinutes := DefaultWaitTimeoutMinutes
	timeout := time.Duration(timeoutMinutes) * time.Minute
	deadline := time.Now().Add(timeout)

	color.New(color.FgBlue).Printf("Waiting %d minutes for update to complete\n", timeoutMinutes) // nolint:errcheck,gosec

	var status porter_app.HighLevelStatus

	for time.Now().Before(deadline) {
		statusResp, err := input.Client.GetRevisionStatus(ctx, input.ProjectID, input.ClusterID, input.AppName, input.RevisionID)
		if err != nil {
			return fmt.Errorf("error getting app revision status: %w", err)
		}

		if statusResp == nil {
			return errors.New("unable to determine status of app revision")
		}

		status = statusResp.HighLevelStatus

		if status != porter_app.HighLevelStatus_Progressing {
			break
		}

		time.Sleep(DefaultRetryFrequencySeconds * time.Second)
	}

	switch status {
	case porter_app.HighLevelStatus_Progressing:
		return fmt.Errorf("timeout exceeded")
	case porter_app.HighLevelStatus_Successful:
		_, _ = color.New(color.FgGreen).Printf("Update completed successfully\n") // nolint:errcheck,gosec
		return nil
	case porter_app.HighLevelStatus_Failed:
		return fmt.Errorf("update failed: check dashboard for details")
	default:
		return fmt.Errorf("received unknown status: %s", status)
	}
}