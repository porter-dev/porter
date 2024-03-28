package porter_app

import (
	"context"
	"time"

	porterv1 "github.com/porter-dev/api-contracts/generated/go/porter/v1"
	"github.com/porter-dev/porter/internal/telemetry"
)

// JobRunStatus represents the status of a job run
type JobRunStatus string

// JobRun is a representation of a job run on the cluster
type JobRun struct {
	// ID is the UID of the job
	ID string `json:"id"`
	// Name is the name of the job object
	Name string `json:"name"`
	// Status is the status of the job run
	Status JobRunStatus `json:"status"`
	// CreatedAt is the time the job was created
	CreatedAt time.Time `json:"created_at"`
	// FinishedAt is the time the job finished, if applicable
	FinishedAt time.Time `json:"finished_at"`
	// AppRevisionID is the ID of the app revision associated with this run
	AppRevisionID string `json:"app_revision_id"`
	// ServiceName is the name of the job service on the app
	ServiceName string `json:"service_name"`
}

const (
	// JobRunStatus_Running represents a job run that is currently running
	JobRunStatus_Running JobRunStatus = "RUNNING"
	// JobRunStatus_Successful represents a job run that has completed successfully
	JobRunStatus_Successful JobRunStatus = "SUCCESSFUL"
	// JobRunStatus_Failed represents a job run that has failed
	JobRunStatus_Failed JobRunStatus = "FAILED"
	// JobRunStatus_Canceled represents a job run that has been cancelled
	JobRunStatus_Canceled JobRunStatus = "CANCELED"
)

// JobRunFromProto converts a job run proto to a JobRun
func JobRunFromProto(ctx context.Context, jobRun *porterv1.JobRun) (JobRun, error) {
	ctx, span := telemetry.NewSpan(ctx, "porter-app-job-runs-from-proto")
	defer span.End()

	var run JobRun

	if jobRun == nil {
		return run, telemetry.Error(ctx, span, nil, "job run is nil")
	}

	status, err := jobStatusFromProto(ctx, jobRun.Status)
	if err != nil {
		return run, telemetry.Error(ctx, span, err, "job status from proto")
	}

	run = JobRun{
		ID:            jobRun.Id,
		Name:          jobRun.JobName,
		ServiceName:   jobRun.ServiceName,
		Status:        status,
		CreatedAt:     jobRun.CreatedAt.AsTime(),
		FinishedAt:    jobRun.FinishedAt.AsTime(),
		AppRevisionID: jobRun.AppRevisionId,
	}

	return run, nil
}

func jobStatusFromProto(ctx context.Context, status porterv1.EnumJobRunStatus) (JobRunStatus, error) {
	ctx, span := telemetry.NewSpan(ctx, "porter-app-job-status-from-proto")
	defer span.End()

	switch status {
	case porterv1.EnumJobRunStatus_ENUM_JOB_RUN_STATUS_RUNNING:
		return JobRunStatus_Running, nil
	case porterv1.EnumJobRunStatus_ENUM_JOB_RUN_STATUS_SUCCESSFUL:
		return JobRunStatus_Successful, nil
	case porterv1.EnumJobRunStatus_ENUM_JOB_RUN_STATUS_FAILED:
		return JobRunStatus_Failed, nil
	case porterv1.EnumJobRunStatus_ENUM_JOB_RUN_STATUS_CANCELED:
		return JobRunStatus_Canceled, nil
	default:
		return "", telemetry.Error(ctx, span, nil, "invalid job status")
	}
}
