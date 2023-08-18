package cmd

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"github.com/porter-dev/porter/cli/cmd/config"
	v2 "github.com/porter-dev/porter/cli/cmd/v2"

	"github.com/fatih/color"
	api "github.com/porter-dev/porter/api/client"
	"github.com/porter-dev/porter/api/types"
	"github.com/spf13/cobra"
)

// deleteCmd represents the "porter delete" base command
var deleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Deletes a deployment",
	Long: fmt.Sprintf(`
%s

Destroys a deployment, which is read based on env variables.

  %s

The following are the environment variables that can be used to set certain values while
deleting a configuration:
  PORTER_CLUSTER              Cluster ID that contains the project
  PORTER_PROJECT              Project ID that contains the application
	`,
		color.New(color.FgBlue, color.Bold).Sprintf("Help for \"porter delete\":"),
		color.New(color.FgGreen, color.Bold).Sprintf("porter delete"),
	),
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, deleteDeployment)
		if err != nil {
			os.Exit(1)
		}
	},
}

// deleteAppsCmd represents the "porter delete apps" subcommand
var deleteAppsCmd = &cobra.Command{
	Use:     "apps",
	Aliases: []string{"app", "applications", "application"},
	Short:   "Deletes an existing app",
	Args:    cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, deleteApp)
		if err != nil {
			os.Exit(1)
		}
	},
}

// deleteJobsCmd represents the "porter delete jobs" subcommand
var deleteJobsCmd = &cobra.Command{
	Use:     "jobs",
	Aliases: []string{"job"},
	Short:   "Deletes an existing job",
	Args:    cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, deleteJob)
		if err != nil {
			os.Exit(1)
		}
	},
}

// deleteAddonsCmd represents the "porter delete addons" subcommand
var deleteAddonsCmd = &cobra.Command{
	Use:     "addons",
	Aliases: []string{"addon"},
	Short:   "Deletes an existing addon",
	Args:    cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, deleteAddon)
		if err != nil {
			os.Exit(1)
		}
	},
}

// deleteHelmCmd represents the "porter delete helm" subcommand
var deleteHelmCmd = &cobra.Command{
	Use:     "helm",
	Aliases: []string{"helmrepo", "helmrepos"},
	Short:   "Deletes an existing helm repo",
	Args:    cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, deleteHelm)
		if err != nil {
			os.Exit(1)
		}
	},
}

func init() {
	deleteCmd.PersistentFlags().StringVar(
		&namespace,
		"namespace",
		"default",
		"Namespace of the application",
	)

	deleteCmd.AddCommand(deleteAppsCmd)
	deleteCmd.AddCommand(deleteJobsCmd)
	deleteCmd.AddCommand(deleteAddonsCmd)
	deleteCmd.AddCommand(deleteHelmCmd)

	rootCmd.AddCommand(deleteCmd)
}

func deleteDeployment(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	ctx := context.Background()

	project, err := client.GetProject(ctx, cliConf.Project)
	if err != nil {
		return fmt.Errorf("could not retrieve project from Porter API. Please contact support@porter.run")
	}

	if project.ValidateApplyV2 {
		err = v2.DeleteDeployment(ctx)
		if err != nil {
			return err
		}
		return nil
	}

	projectID := cliConf.Project

	if projectID == 0 {
		return fmt.Errorf("project id must be set")
	}

	clusterID := cliConf.Cluster

	if clusterID == 0 {
		return fmt.Errorf("cluster id must be set")
	}

	var deploymentID uint

	if deplIDStr := os.Getenv("PORTER_DEPLOYMENT_ID"); deplIDStr != "" {
		deplID, err := strconv.ParseUint(deplIDStr, 10, 32)
		if err != nil {
			return fmt.Errorf("error parsing deployment ID: %s", deplIDStr)
		}

		deploymentID = uint(deplID)
	} else {
		return fmt.Errorf("Deployment ID must be defined, set by PORTER_DEPLOYMENT_ID")
	}

	return client.DeleteDeployment(
		context.Background(), projectID, clusterID, deploymentID,
	)
}

func deleteApp(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	ctx := context.Background()

	project, err := client.GetProject(ctx, cliConf.Project)
	if err != nil {
		return fmt.Errorf("could not retrieve project from Porter API. Please contact support@porter.run")
	}

	if project.ValidateApplyV2 {
		err = v2.DeleteApp(ctx)
		if err != nil {
			return err
		}
		return nil
	}

	name := args[0]

	resp, err := client.GetRelease(
		context.Background(), cliConf.Project, cliConf.Cluster, namespace, name,
	)
	if err != nil {
		return err
	}

	rel := *resp

	if rel.Chart.Name() != "web" && rel.Chart.Name() != "worker" {
		return fmt.Errorf("no app found with name: %s", name)
	}

	color.New(color.FgBlue).Printf("Deleting app: %s\n", name)

	err = client.DeleteRelease(
		context.Background(), cliConf.Project, cliConf.Cluster, namespace, name,
	)

	if err != nil {
		return err
	}

	return nil
}

func deleteJob(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	ctx := context.Background()

	project, err := client.GetProject(ctx, cliConf.Project)
	if err != nil {
		return fmt.Errorf("could not retrieve project from Porter API. Please contact support@porter.run")
	}

	if project.ValidateApplyV2 {
		err = v2.DeleteJob(ctx)
		if err != nil {
			return err
		}
		return nil
	}

	name := args[0]

	resp, err := client.GetRelease(
		context.Background(), cliConf.Project, cliConf.Cluster, namespace, name,
	)
	if err != nil {
		return err
	}

	rel := *resp

	if rel.Chart.Name() != "job" {
		return fmt.Errorf("no job found with name: %s", name)
	}

	color.New(color.FgBlue).Printf("Deleting job: %s\n", name)

	err = client.DeleteRelease(
		context.Background(), cliConf.Project, cliConf.Cluster, namespace, name,
	)

	if err != nil {
		return err
	}

	return nil
}

func deleteAddon(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	name := args[0]

	resp, err := client.GetRelease(
		context.Background(), cliConf.Project, cliConf.Cluster, namespace, name,
	)
	if err != nil {
		return err
	}

	rel := *resp

	if rel.Chart.Name() == "web" || rel.Chart.Name() == "worker" || rel.Chart.Name() == "job" {
		return fmt.Errorf("no addon found with name: %s", name)
	}

	color.New(color.FgBlue).Printf("Deleting addon: %s\n", name)

	err = client.DeleteRelease(
		context.Background(), cliConf.Project, cliConf.Cluster, namespace, name,
	)

	if err != nil {
		return err
	}

	return nil
}

func deleteHelm(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	name := args[0]

	resp, err := client.ListHelmRepos(context.Background(), cliConf.Project)
	if err != nil {
		return err
	}

	var repo *types.HelmRepo

	for _, r := range resp {
		if r.Name == name {
			repo = r
			break
		}
	}

	if repo == nil {
		return fmt.Errorf("no helm repo found with name: %s", name)
	}

	color.New(color.FgBlue).Printf("Deleting helm repo: %s\n", name)

	err = client.DeleteHelmRepo(context.Background(), cliConf.Project, repo.ID)

	if err != nil {
		return err
	}

	return nil
}
