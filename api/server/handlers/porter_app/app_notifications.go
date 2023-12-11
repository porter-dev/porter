package porter_app

import (
	"net/http"

	"github.com/porter-dev/porter/api/server/authz"
	"github.com/porter-dev/porter/api/server/shared/requestutils"

	"connectrpc.com/connect"

	porterv1 "github.com/porter-dev/api-contracts/generated/go/porter/v1"

	"github.com/google/uuid"

	"github.com/porter-dev/porter/internal/porter_app"
	"github.com/porter-dev/porter/internal/porter_app/notifications"
	"github.com/porter-dev/porter/internal/telemetry"

	"github.com/porter-dev/porter/api/server/handlers"
	"github.com/porter-dev/porter/api/server/shared"
	"github.com/porter-dev/porter/api/server/shared/apierrors"
	"github.com/porter-dev/porter/api/server/shared/config"
	"github.com/porter-dev/porter/api/types"
	"github.com/porter-dev/porter/internal/models"
)

// AppNotifications handles requests to the /apps/{porter_app_name}/notifications endpoint
type AppNotificationsHandler struct {
	handlers.PorterHandlerReadWriter
	authz.KubernetesAgentGetter
}

// NewAppNotificationsHandler returns a new AppNotificationsHandler
func NewAppNotificationsHandler(
	config *config.Config,
	decoderValidator shared.RequestDecoderValidator,
	writer shared.ResultWriter,
) *AppNotificationsHandler {
	return &AppNotificationsHandler{
		PorterHandlerReadWriter: handlers.NewDefaultPorterHandler(config, decoderValidator, writer),
		KubernetesAgentGetter:   authz.NewOutOfClusterAgentGetter(config),
	}
}

// AppNotificationsRequest is the request object for the /apps/{porter_app_name}/notifications endpoint
type AppNotificationsRequest struct {
	DeploymentTargetID string `schema:"deployment_target_id"`
}

// AppNotificationsResponse is the response object for the /apps/{porter_app_name}/notifications endpoint
type AppNotificationsResponse struct {
	// Notifications are the notifications associated with the app revision
	Notifications []notifications.Notification `json:"notifications"`
}

func (c *AppNotificationsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx, span := telemetry.NewSpan(r.Context(), "serve-app-notifications")
	defer span.End()

	project, _ := ctx.Value(types.ProjectScope).(*models.Project)

	appName, reqErr := requestutils.GetURLParamString(r, types.URLParamPorterAppName)
	if reqErr != nil {
		e := telemetry.Error(ctx, span, reqErr, "error parsing stack name from url")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(e, http.StatusBadRequest))
		return
	}

	telemetry.WithAttributes(span, telemetry.AttributeKV{Key: "app-name", Value: appName})

	request := &AppNotificationsRequest{}
	if ok := c.DecodeAndValidate(w, r, request); !ok {
		err := telemetry.Error(ctx, span, nil, "error decoding request")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}

	_, err := uuid.Parse(request.DeploymentTargetID)
	if err != nil {
		err := telemetry.Error(ctx, span, err, "error parsing deployment target id")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}
	telemetry.WithAttributes(span, telemetry.AttributeKV{Key: "deployment-target-id", Value: request.DeploymentTargetID})

	porterApps, err := c.Repo().PorterApp().ReadPorterAppsByProjectIDAndName(project.ID, appName)
	if err != nil {
		err := telemetry.Error(ctx, span, err, "error getting porter apps")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}
	if len(porterApps) == 0 {
		err := telemetry.Error(ctx, span, err, "no porter apps returned")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}
	if len(porterApps) > 1 {
		err := telemetry.Error(ctx, span, err, "multiple porter apps returned; unable to determine which one to use")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}

	appId := porterApps[0].ID
	telemetry.WithAttributes(span, telemetry.AttributeKV{Key: "app-id", Value: appId})

	if appId == 0 {
		err := telemetry.Error(ctx, span, err, "porter app id is missing")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusInternalServerError))
		return
	}

	currentAppRevisionReq := connect.NewRequest(&porterv1.CurrentAppRevisionRequest{
		ProjectId: int64(project.ID),
		AppId:     int64(appId),
		DeploymentTargetIdentifier: &porterv1.DeploymentTargetIdentifier{
			Id: request.DeploymentTargetID,
		},
	})

	currentAppRevisionResp, err := c.Config().ClusterControlPlaneClient.CurrentAppRevision(ctx, currentAppRevisionReq)
	if err != nil {
		err := telemetry.Error(ctx, span, err, "error getting current app revision from cluster control plane client")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusBadRequest))
		return
	}

	if currentAppRevisionResp == nil || currentAppRevisionResp.Msg == nil {
		err := telemetry.Error(ctx, span, err, "current app revision resp is nil")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusInternalServerError))
		return
	}

	appRevision := currentAppRevisionResp.Msg.AppRevision
	encodedRevision, err := porter_app.EncodedRevisionFromProto(ctx, appRevision)
	if err != nil {
		err := telemetry.Error(ctx, span, err, "error encoding revision from proto")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusInternalServerError))
		return
	}

	appRevisionId := encodedRevision.ID
	appInstanceId := encodedRevision.AppInstanceID
	telemetry.WithAttributes(span,
		telemetry.AttributeKV{Key: "app-revision-id", Value: appRevisionId},
		telemetry.AttributeKV{Key: "app-instance-id", Value: appInstanceId},
	)
	notificationEvents, err := c.Repo().PorterAppEvent().ReadNotificationsByAppRevisionID(ctx, appInstanceId, appRevisionId)
	if err != nil {
		err := telemetry.Error(ctx, span, err, "error getting notifications from repo")
		c.HandleAPIError(w, r, apierrors.NewErrPassThroughToClient(err, http.StatusInternalServerError))
		return
	}
	latestNotifications := make([]notifications.Notification, 0)
	for _, event := range notificationEvents {
		notification, err := notifications.NotificationFromPorterAppEvent(event)
		if err != nil {
			telemetry.WithAttributes(span, telemetry.AttributeKV{Key: "notification-conversion-error", Value: err.Error()})
			continue
		}
		if notification == nil {
			telemetry.WithAttributes(span, telemetry.AttributeKV{Key: "notification-conversion-error", Value: "notification is nil"})
			continue
		}
		// TODO: remove this check once this attribute is not found in the span for >30 days
		if notification.Scope == "" {
			telemetry.WithAttributes(span, telemetry.AttributeKV{Key: "notification-conversion-error", Value: "old-notification-format"})
			continue
		}
		latestNotifications = append(latestNotifications, *notification)
	}

	response := AppNotificationsResponse{
		Notifications: latestNotifications,
	}

	c.WriteResult(w, r, response)
}
