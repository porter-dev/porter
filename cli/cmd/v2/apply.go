package v2

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/fatih/color"
	app_api "github.com/porter-dev/porter/api/server/handlers/porter_app"
	v2 "github.com/porter-dev/porter/internal/porter_app/v2"

	"github.com/porter-dev/porter/api/types"
	"github.com/porter-dev/porter/internal/models"

	"github.com/cli/cli/git"

	api "github.com/porter-dev/porter/api/client"
	"github.com/porter-dev/porter/cli/cmd/config"
)

// ApplyInput is the input for the Apply function
type ApplyInput struct {
	// CLIConfig is the CLI configuration
	CLIConfig config.CLIConfig
	// Client is the Porter API client
	Client api.Client
	// PorterYamlPath is the path to the porter.yaml file
	PorterYamlPath string
	// AppName is the name of the app
	AppName string
	// ImageTagOverride is the image tag to use for the app
	ImageTagOverride string
	// PreviewApply is true when Apply should create a new deployment target matching current git branch and apply to that target
	PreviewApply bool
	// WaitForSuccessfulDeployment is true when Apply should wait for the update to complete before returning
	WaitForSuccessfulDeployment bool
	// PullImageBeforeBuild will attempt to pull the image before building if true
	PullImageBeforeBuild bool
	// WithPredeploy is true when Apply should run the predeploy step
	WithPredeploy bool
	// Exact is true when Apply should use the exact app config provided by the user
	Exact bool
	// PatchOperations is a list of patch operations to apply to the app
	PatchOperations []v2.PatchOperation
	// SkipBuild is true when Apply should skip the build step
	SkipBuild bool
}

// Apply implements the functionality of the `porter apply` command for validate apply v2 projects
func Apply(ctx context.Context, inp ApplyInput) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	go func() {
		termChan := make(chan os.Signal, 1)
		signal.Notify(termChan, syscall.SIGINT, syscall.SIGTERM)
		select {
		case <-termChan:
			color.New(color.FgYellow).Printf("Shutdown signal received, cancelling processes\n") // nolint:errcheck,gosec
			cancel()
		case <-ctx.Done():
		}
	}()

	cliConf := inp.CLIConfig
	client := inp.Client

	if cliConf.Project == 0 {
		return errors.New("project must be set")
	}

	if cliConf.Cluster == 0 {
		return errors.New("cluster must be set")
	}

	deploymentTargetID, err := deploymentTargetFromConfig(ctx, client, cliConf.Project, cliConf.Cluster, inp.PreviewApply)
	if err != nil {
		return fmt.Errorf("error getting deployment target from config: %w", err)
	}

	var prNumber int
	prNumberEnv := os.Getenv("PORTER_PR_NUMBER")
	if prNumberEnv != "" {
		prNumber, err = strconv.Atoi(prNumberEnv)
		if err != nil {
			return fmt.Errorf("error parsing PORTER_PR_NUMBER to int: %w", err)
		}
	}

	porterYamlExists := len(inp.PorterYamlPath) != 0

	if porterYamlExists {
		_, err := os.Stat(filepath.Clean(inp.PorterYamlPath))
		if err != nil {
			if !os.IsNotExist(err) {
				return fmt.Errorf("error checking if porter yaml exists at path %s: %w", inp.PorterYamlPath, err)
			}
			// If a path was specified but the file does not exist, we will not immediately error out.
			// This supports users migrated from v1 who use a workflow file that always specifies a porter yaml path
			// in the apply command.
			porterYamlExists = false
		}
	}

	var b64YAML string
	if porterYamlExists {
		porterYaml, err := os.ReadFile(filepath.Clean(inp.PorterYamlPath))
		if err != nil {
			return fmt.Errorf("could not read porter yaml file: %w", err)
		}

		b64YAML = base64.StdEncoding.EncodeToString(porterYaml)
		color.New(color.FgGreen).Printf("Using Porter YAML at path: %s\n", inp.PorterYamlPath) // nolint:errcheck,gosec
	}

	var commitSHA string
	if !inp.SkipBuild {
		// providing a commit SHA indicates the app is eligible for a build
		// only set it if we want the build to run
		commitSHA = commitSHAFromEnv()
	}

	gitSource, err := gitSourceFromEnv()
	if err != nil {
		return fmt.Errorf("error getting git source from env: %w", err)
	}

	updateInput := api.UpdateAppInput{
		ProjectID:          cliConf.Project,
		ClusterID:          cliConf.Cluster,
		Name:               inp.AppName,
		ImageTagOverride:   inp.ImageTagOverride,
		GitSource:          gitSource,
		DeploymentTargetId: deploymentTargetID,
		CommitSHA:          commitSHA,
		Base64PorterYAML:   b64YAML,
		WithPredeploy:      inp.WithPredeploy,
		Exact:              inp.Exact,
		PatchOperations:    inp.PatchOperations,
	}

	updateResp, err := client.UpdateApp(ctx, updateInput)
	if err != nil {
		return fmt.Errorf("error calling update app endpoint: %w", err)
	}

	if updateResp.AppRevisionId == "" {
		return errors.New("app revision id is empty")
	}

	appName := updateResp.AppName

	buildSettings, err := client.GetBuildFromRevision(ctx, api.GetBuildFromRevisionInput{
		ProjectID:     cliConf.Project,
		ClusterID:     cliConf.Cluster,
		AppName:       appName,
		AppRevisionID: updateResp.AppRevisionId,
	})
	if err != nil {
		return fmt.Errorf("error getting build from revision: %w", err)
	}

	if !inp.SkipBuild && buildSettings != nil && buildSettings.Build.Method != "" {
		eventID, _ := createBuildEvent(ctx, client, appName, cliConf.Project, cliConf.Cluster, deploymentTargetID, commitSHA)

		var buildFinished bool
		var buildError error
		var buildLogs string

		defer func() {
			var status buildStatus
			if buildError != nil && !errors.Is(buildError, context.Canceled) {
				status = buildStatus_failed
			} else if !buildFinished {
				status = buildStatus_canceled
			}

			if status != "" {
				_ = reportUnsuccessfulBuild(ctx, reportUnsuccessfulBuildInput{
					client:             client,
					appName:            appName,
					buildStatus:        status,
					cliConf:            cliConf,
					deploymentTargetID: deploymentTargetID,
					appRevisionID:      updateResp.AppRevisionId,
					eventID:            eventID,
					buildError:         buildError,
					buildLogs:          buildLogs,
					commitSHA:          commitSHA,
					prNumber:           prNumber,
				})
			}
			return
		}()

		if commitSHA == "" {
			return errors.New("build is required but commit SHA cannot be identified. Please set the PORTER_COMMIT_SHA environment variable or run apply in git repository with access to the git CLI")
		}

		color.New(color.FgGreen).Printf("Building new image with tag %s...\n", commitSHA) // nolint:errcheck,gosec

		buildEnvVariables := make(map[string]string)
		for k, v := range buildSettings.BuildEnvVariables {
			buildEnvVariables[k] = v
		}

		// use all env variables from running container in build
		env := os.Environ()
		for _, v := range env {
			pair := strings.SplitN(v, "=", 2)
			if len(pair) == 2 {
				if strings.HasPrefix(pair[0], "PORTER_") || strings.HasPrefix(pair[0], "NEXT_PUBLIC_") {
					buildEnvVariables[pair[0]] = pair[1]
				}
			}
		}

		buildInput, err := buildInputFromBuildSettings(buildInputFromBuildSettingsInput{
			projectID:            cliConf.Project,
			appName:              appName,
			commitSHA:            commitSHA,
			image:                buildSettings.Image,
			build:                buildSettings.Build,
			buildEnv:             buildEnvVariables,
			pullImageBeforeBuild: inp.PullImageBeforeBuild,
		})
		if err != nil {
			buildError = fmt.Errorf("error creating build input from build settings: %w", err)
			return buildError
		}

		buildOutput := build(ctx, client, buildInput)
		if buildOutput.Error != nil {
			buildError = fmt.Errorf("error building app: %w", buildOutput.Error)
			buildLogs = buildOutput.Logs
			return buildError
		}

		_, err = client.UpdateRevisionStatus(ctx, cliConf.Project, cliConf.Cluster, appName, updateResp.AppRevisionId, models.AppRevisionStatus_BuildSuccessful)
		if err != nil {
			buildError = fmt.Errorf("error updating revision status post build: %w", err)
			return buildError
		}

		color.New(color.FgGreen).Printf("Successfully built image (tag: %s)\n", commitSHA) // nolint:errcheck,gosec

		buildMetadata := make(map[string]interface{})
		buildMetadata["end_time"] = time.Now().UTC()
		_ = updateExistingEvent(ctx, client, appName, cliConf.Project, cliConf.Cluster, deploymentTargetID, types.PorterAppEventType_Build, eventID, types.PorterAppEventStatus_Success, buildMetadata)
		buildFinished = true
	}

	color.New(color.FgGreen).Printf("Deploying new revision %s for app %s...\n", updateResp.AppRevisionId, appName) // nolint:errcheck,gosec

	now := time.Now().UTC()

	for {
		if time.Since(now) > checkDeployTimeout {
			return errors.New("timed out waiting for app to deploy")
		}

		status, err := client.GetRevisionStatus(ctx, cliConf.Project, cliConf.Cluster, appName, updateResp.AppRevisionId)
		if err != nil {
			return fmt.Errorf("error getting app revision status: %w", err)
		}

		if status == nil {
			return errors.New("unable to determine status of app revision")
		}

		if status.AppRevisionStatus.IsInTerminalStatus {
			break
		}

		if status.AppRevisionStatus.PredeployStarted {
			color.New(color.FgGreen).Printf("Waiting for predeploy to complete...\n") // nolint:errcheck,gosec
		}

		if status.AppRevisionStatus.InstallStarted {
			color.New(color.FgGreen).Printf("Waiting for deploy to complete...\n") // nolint:errcheck,gosec
		}

		time.Sleep(checkDeployFrequency)
	}

	_, _ = client.ReportRevisionStatus(ctx, api.ReportRevisionStatusInput{
		ProjectID:     cliConf.Project,
		ClusterID:     cliConf.Cluster,
		AppName:       appName,
		AppRevisionID: updateResp.AppRevisionId,
		PRNumber:      prNumber,
		CommitSHA:     commitSHA,
	})

	status, err := client.GetRevisionStatus(ctx, cliConf.Project, cliConf.Cluster, appName, updateResp.AppRevisionId)
	if err != nil {
		return fmt.Errorf("error getting app revision status: %w", err)
	}

	if status == nil {
		return errors.New("unable to determine status of app revision")
	}

	if status.AppRevisionStatus.InstallFailed {
		return errors.New("app failed to deploy")
	}
	if status.AppRevisionStatus.PredeployFailed {
		return errors.New("predeploy failed for new revision")
	}

	color.New(color.FgGreen).Printf("Successfully applied new revision %s\n", updateResp.AppRevisionId) // nolint:errcheck,gosec

	if inp.WaitForSuccessfulDeployment {
		return waitForAppRevisionStatus(ctx, waitForAppRevisionStatusInput{
			ProjectID:  cliConf.Project,
			ClusterID:  cliConf.Cluster,
			AppName:    appName,
			RevisionID: updateResp.AppRevisionId,
			Client:     client,
		})
	}

	return nil
}

func commitSHAFromEnv() string {
	var commitSHA string
	if os.Getenv("PORTER_COMMIT_SHA") != "" {
		commitSHA = os.Getenv("PORTER_COMMIT_SHA")
	} else if os.Getenv("GITHUB_SHA") != "" {
		commitSHA = os.Getenv("GITHUB_SHA")
	} else if commit, err := git.LastCommit(); err == nil && commit != nil {
		commitSHA = commit.Sha
	}

	return commitSHA
}

func deploymentTargetFromConfig(ctx context.Context, client api.Client, projectID, clusterID uint, previewApply bool) (string, error) {
	var deploymentTargetID string

	if os.Getenv("PORTER_DEPLOYMENT_TARGET_ID") != "" {
		deploymentTargetID = os.Getenv("PORTER_DEPLOYMENT_TARGET_ID")
	}

	if deploymentTargetID == "" {
		targetResp, err := client.DefaultDeploymentTarget(ctx, projectID, clusterID)
		if err != nil {
			return deploymentTargetID, fmt.Errorf("error calling default deployment target endpoint: %w", err)
		}
		deploymentTargetID = targetResp.DeploymentTargetID
	}

	if previewApply {
		var branchName string

		// branch name is set to different values in the GH env, depending on whether or not the workflow is triggered by a PR
		// issue is being tracked here: https://github.com/github/docs/issues/15319
		if os.Getenv("GITHUB_HEAD_REF") != "" {
			branchName = os.Getenv("GITHUB_HEAD_REF")
		} else if os.Getenv("GITHUB_REF_NAME") != "" {
			branchName = os.Getenv("GITHUB_REF_NAME")
		} else if branch, err := git.CurrentBranch(); err == nil {
			branchName = branch
		}

		if branchName == "" {
			return deploymentTargetID, errors.New("branch name is empty. Please run apply in a git repository with access to the git CLI")
		}

		targetResp, err := client.CreateDeploymentTarget(ctx, projectID, clusterID, branchName, true)
		if err != nil {
			return deploymentTargetID, fmt.Errorf("error calling create deployment target endpoint: %w", err)
		}
		deploymentTargetID = targetResp.DeploymentTargetID
	}

	if deploymentTargetID == "" {
		return deploymentTargetID, errors.New("deployment target id is empty")
	}

	return deploymentTargetID, nil
}

type reportUnsuccessfulBuildInput struct {
	client             api.Client
	appName            string
	buildStatus        buildStatus
	cliConf            config.CLIConfig
	deploymentTargetID string
	appRevisionID      string
	eventID            string
	buildError         error
	buildLogs          string
	commitSHA          string
	prNumber           int
}

type buildStatus string

var (
	buildStatus_failed   buildStatus = "failed"
	buildStatus_canceled buildStatus = "canceled"
)

func reportUnsuccessfulBuild(ctx context.Context, inp reportUnsuccessfulBuildInput) error {
	var appRevisionStatus models.AppRevisionStatus
	var porterAppEventStatus types.PorterAppEventStatus

	switch inp.buildStatus {
	case buildStatus_failed:
		appRevisionStatus = models.AppRevisionStatus_BuildFailed
		porterAppEventStatus = types.PorterAppEventStatus_Failed
	case buildStatus_canceled:
		appRevisionStatus = models.AppRevisionStatus_BuildCanceled
		porterAppEventStatus = types.PorterAppEventStatus_Canceled
	default:
		return errors.New("unknown build status")
	}

	_, err := inp.client.UpdateRevisionStatus(ctx, inp.cliConf.Project, inp.cliConf.Cluster, inp.appName, inp.appRevisionID, appRevisionStatus)
	if err != nil {
		return err
	}

	buildMetadata := make(map[string]interface{})
	buildMetadata["end_time"] = time.Now().UTC()

	// the below is a temporary solution until we can report build errors via telemetry from the CLI
	errorStringMap := make(map[string]string)

	if inp.buildError != nil {
		errorStringMap["build-error"] = fmt.Sprintf("%+v", inp.buildError)
	}
	if inp.buildLogs != "" {
		b64BuildLogs := base64.StdEncoding.EncodeToString([]byte(inp.buildLogs))
		// the key name below must be kept the same so that reportBuildStatus in the CreateOrUpdatePorterAppEvent handler reports logs correctly
		errorStringMap["b64-build-logs"] = b64BuildLogs
	}

	if len(errorStringMap) != 0 {
		buildMetadata["errors"] = errorStringMap
	}

	err = updateExistingEvent(ctx, inp.client, inp.appName, inp.cliConf.Project, inp.cliConf.Cluster, inp.deploymentTargetID, types.PorterAppEventType_Build, inp.eventID, porterAppEventStatus, buildMetadata)
	if err != nil {
		return err
	}
	_, err = inp.client.ReportRevisionStatus(ctx, api.ReportRevisionStatusInput{
		ProjectID:     inp.cliConf.Project,
		ClusterID:     inp.cliConf.Cluster,
		AppName:       inp.appName,
		AppRevisionID: inp.appRevisionID,
		PRNumber:      inp.prNumber,
		CommitSHA:     inp.commitSHA,
	})
	if err != nil {
		return err
	}

	return nil
}

// checkDeployTimeout is the timeout for checking if an app has been deployed
const checkDeployTimeout = 15 * time.Minute

// checkDeployFrequency is the frequency for checking if an app has been deployed
const checkDeployFrequency = 10 * time.Second

func gitSourceFromEnv() (app_api.GitSource, error) {
	var source app_api.GitSource

	var repoID uint
	if os.Getenv("GITHUB_REPOSITORY_ID") != "" {
		id, err := strconv.Atoi(os.Getenv("GITHUB_REPOSITORY_ID"))
		if err != nil {
			return source, fmt.Errorf("unable to parse GITHUB_REPOSITORY_ID to int: %w", err)
		}
		repoID = uint(id)
	}

	return app_api.GitSource{
		GitBranch:   os.Getenv("GITHUB_REF_NAME"),
		GitRepoID:   repoID,
		GitRepoName: os.Getenv("GITHUB_REPOSITORY"),
	}, nil
}

type buildInputFromBuildSettingsInput struct {
	projectID            uint
	appName              string
	commitSHA            string
	image                app_api.Image
	build                app_api.BuildSettings
	buildEnv             map[string]string
	pullImageBeforeBuild bool
}

func buildInputFromBuildSettings(inp buildInputFromBuildSettingsInput) (buildInput, error) {
	var buildSettings buildInput

	if inp.appName == "" {
		return buildSettings, errors.New("app name is empty")
	}
	if inp.image.Repository == "" {
		return buildSettings, errors.New("image repository is empty")
	}
	if inp.build.Method == "" {
		return buildSettings, errors.New("build method is empty")
	}
	if inp.commitSHA == "" {
		return buildSettings, errors.New("commit SHA is empty")
	}
	if inp.build.Context == "" {
		return buildSettings, errors.New("build context is empty")
	}
	buildContext := correctBuildContext(inp.build.Context)

	return buildInput{
		ProjectID:            inp.projectID,
		AppName:              inp.appName,
		BuildContext:         buildContext,
		Dockerfile:           inp.build.Dockerfile,
		BuildMethod:          inp.build.Method,
		Builder:              inp.build.Builder,
		BuildPacks:           inp.build.Buildpacks,
		ImageTag:             inp.commitSHA,
		RepositoryURL:        inp.image.Repository,
		CurrentImageTag:      inp.image.Tag,
		Env:                  inp.buildEnv,
		PullImageBeforeBuild: inp.pullImageBeforeBuild,
	}, nil
}

func correctBuildContext(buildContext string) string {
	if !strings.HasPrefix(buildContext, "./") {
		if strings.HasPrefix(buildContext, "/") {
			return fmt.Sprintf(".%s", buildContext)
		}
		return fmt.Sprintf("./%s", buildContext)
	}
	return buildContext
}
