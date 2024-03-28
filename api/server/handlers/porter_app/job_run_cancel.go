package porter_app

import (
	"net/http"

	"connectrpc.com/connect"
	porterv1 "github.com/porter-dev/api-contracts/generated/go/porter/v1"
	"github.com/porter-dev/porter/api/server/handlers"
	"github.com/porter-dev/porter/api/server/shared"
	"github.com/porter-dev/porter/api/server/shared/apierrors"
	"github.com/porter-dev/porter/api/server/shared/config"
	"github.com/porter-dev/porter/api/server/shared/requestutils"
	"github.com/porter-dev/porter/api/types"
	"github.com/porter-dev/porter/internal/models"
	"github.com/porter-dev/porter/internal/telemetry"
)

// CancelJobRunHandler is the handler for POST /apps/jobs/{porter_app_name}/{job_run_name}/cancel
type CancelJobRunHandler struct {
	handlers.PorterHandlerReadWriter
}

// NewCancelJobRunHandler returns a new CancelJobRunHandler
func NewCancelJobRunHandler(
	config *config.Config,
	decoderValidator shared.RequestDecoderValidator,
	writer shared.ResultWriter,
) *CancelJobRunHandler {
	return &CancelJobRunHandler{
		PorterHandlerReadWriter: handlers.NewDefaultPorterHandler(config, decoderValidator, writer),
	}
}

// CancelJobRunRequest is the expected format for a request body on POST /apps/jobs/{porter_app_name}/{job_run_name}/cancel
type CancelJobRunRequest struct {
	DeploymentTargetID   string `schema:"deployment_target_id,omitempty"`
	DeploymentTargetName string `schema:"deployment_target_name,omitempty"`
}

// CancelJobRunResponse is the response format for POST /apps/jobs/{porter_app_name}/{job_run_name}/cancel
type CancelJobRunResponse struct{}

// ServeHTTP handles the cancel job run request
func (c *CancelJobRunHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx, span := telemetry.NewSpan(r.Context(), "serve-cancel-job-run")
	defer span.End()

	cluster, _ := ctx.Value(types.ClusterScope).(*models.Cluster)
	project, _ := ctx.Value(types.ProjectScope).(*models.Project)

	request := &CancelJobRunRequest{}
	if ok := c.DecodeAndValidate(w, r, request); !ok {
		err := telemetry.Error(ctx, span, nil, "invalid request")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}

	name, reqErr := requestutils.GetURLParamString(r, types.URLParamPorterAppName)
	if reqErr != nil {
		err := telemetry.Error(ctx, span, reqErr, "invalid porter app name")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}
	telemetry.WithAttributes(span, telemetry.AttributeKV{Key: "app-name", Value: name})

	jobRunName, reqErr := requestutils.GetURLParamString(r, types.URLParamJobRunName)
	if reqErr != nil {
		err := telemetry.Error(ctx, span, reqErr, "invalid job run name")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}

	deploymentTargetID := request.DeploymentTargetID
	deploymentTargetName := request.DeploymentTargetName
	telemetry.WithAttributes(span,
		telemetry.AttributeKV{Key: "deployment-target-id", Value: deploymentTargetID},
		telemetry.AttributeKV{Key: "deployment-target-name", Value: deploymentTargetName},
	)

	var deploymentTargetIdentifer *porterv1.DeploymentTargetIdentifier
	if deploymentTargetID != "" || deploymentTargetName != "" {
		deploymentTargetIdentifer = &porterv1.DeploymentTargetIdentifier{
			Id:   deploymentTargetID,
			Name: deploymentTargetName,
		}
	}

	cancelJobRunRequest := connect.NewRequest(&porterv1.CancelJobRunRequest{
		ProjectId:                  int64(project.ID),
		ClusterId:                  int64(cluster.ID),
		DeploymentTargetIdentifier: deploymentTargetIdentifer,
		JobRunName:                 jobRunName,
	})

	_, err := c.Config().ClusterControlPlaneClient.CancelJobRun(ctx, cancelJobRunRequest)
	if err != nil {
		err := telemetry.Error(ctx, span, err, "error canceling job run")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusInternalServerError))
		return
	}

	res := &CancelJobRunResponse{}

	c.WriteResult(w, r, res)
}
