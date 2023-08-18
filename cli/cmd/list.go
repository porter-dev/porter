package cmd

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/porter-dev/porter/cli/cmd/config"
	v2 "github.com/porter-dev/porter/cli/cmd/v2"

	"github.com/fatih/color"
	api "github.com/porter-dev/porter/api/client"
	"github.com/porter-dev/porter/api/types"
	"github.com/spf13/cobra"
	"github.com/stefanmcshane/helm/pkg/release"
)

var allNamespaces bool

// listCmd represents the "porter list" base command and "porter list all" subcommand
var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List applications, addons or jobs.",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 || (args[0] == "all") {
			err := checkLoginAndRun(cmd.Context(), args, listAll)
			if err != nil {
				os.Exit(1)
			}
		} else {
			color.New(color.FgRed).Fprintf(os.Stderr, "invalid command: %s\n", args[0])
		}
	},
}

var listAppsCmd = &cobra.Command{
	Use:     "apps",
	Aliases: []string{"applications", "app", "application"},
	Short:   "Lists applications in a specific namespace, or across all namespaces",
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, listApps)
		if err != nil {
			os.Exit(1)
		}
	},
}

var listJobsCmd = &cobra.Command{
	Use:     "jobs",
	Aliases: []string{"job"},
	Short:   "Lists jobs in a specific namespace, or across all namespaces",
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, listJobs)
		if err != nil {
			os.Exit(1)
		}
	},
}

var listAddonsCmd = &cobra.Command{
	Use:     "addons",
	Aliases: []string{"addon"},
	Short:   "Lists addons in a specific namespace, or across all namespaces",
	Run: func(cmd *cobra.Command, args []string) {
		err := checkLoginAndRun(cmd.Context(), args, listAddons)
		if err != nil {
			os.Exit(1)
		}
	},
}

func init() {
	listCmd.PersistentFlags().StringVar(
		&namespace,
		"namespace",
		"default",
		"the namespace of the release",
	)

	listCmd.PersistentFlags().BoolVar(
		&allNamespaces,
		"all-namespaces",
		false,
		"list resources for all namespaces",
	)

	listCmd.AddCommand(listAppsCmd)
	listCmd.AddCommand(listJobsCmd)
	listCmd.AddCommand(listAddonsCmd)

	rootCmd.AddCommand(listCmd)
}

func listAll(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	ctx := context.Background()

	project, err := client.GetProject(ctx, cliConf.Project)
	if err != nil {
		return fmt.Errorf("could not retrieve project from Porter API. Please contact support@porter.run")
	}

	if project.ValidateApplyV2 {
		err = v2.ListAll(ctx)
		if err != nil {
			return err
		}
		return nil
	}

	err = writeReleases(client, "all")
	if err != nil {
		return err
	}

	return nil
}

func listApps(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	ctx := context.Background()

	project, err := client.GetProject(ctx, cliConf.Project)
	if err != nil {
		return fmt.Errorf("could not retrieve project from Porter API. Please contact support@porter.run")
	}

	if project.ValidateApplyV2 {
		err = v2.ListApps(ctx)
		if err != nil {
			return err
		}
		return nil
	}

	err = writeReleases(client, "application")
	if err != nil {
		return err
	}

	return nil
}

func listJobs(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	ctx := context.Background()

	project, err := client.GetProject(ctx, cliConf.Project)
	if err != nil {
		return fmt.Errorf("could not retrieve project from Porter API. Please contact support@porter.run")
	}

	if project.ValidateApplyV2 {
		err = v2.ListJobs(ctx)
		if err != nil {
			return err
		}
		return nil
	}

	err = writeReleases(client, "job")
	if err != nil {
		return err
	}

	return nil
}

func listAddons(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConfig config.CLIConfig, args []string) error {
	err := writeReleases(client, "addon")
	if err != nil {
		return err
	}

	return nil
}

func writeReleases(client api.Client, kind string) error {
	var namespaces []string
	var releases []*release.Release

	if allNamespaces {
		resp, err := client.GetK8sNamespaces(context.Background(), cliConf.Project, cliConf.Cluster)
		if err != nil {
			return err
		}

		namespaceResp := *resp

		for _, ns := range namespaceResp {
			namespaces = append(namespaces, ns.Name)
		}
	} else {
		namespaces = append(namespaces, namespace)
	}

	for _, ns := range namespaces {
		resp, err := client.ListReleases(context.Background(), cliConf.Project, cliConf.Cluster, ns,
			&types.ListReleasesRequest{
				ReleaseListFilter: &types.ReleaseListFilter{
					Limit: 50,
					Skip:  0,
					StatusFilter: []string{
						"deployed",
						"uninstalled",
						"pending",
						"pending-install",
						"pending-upgrade",
						"pending-rollback",
						"failed",
					},
				},
			},
		)
		if err != nil {
			return err
		}

		releases = append(releases, resp...)
	}

	w := new(tabwriter.Writer)
	w.Init(os.Stdout, 3, 8, 2, '\t', tabwriter.AlignRight)

	fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", "NAME", "NAMESPACE", "STATUS", "KIND")

	for _, rel := range releases {
		chartName := rel.Chart.Name()

		if kind == "all" {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", rel.Name, rel.Namespace, rel.Info.Status, chartName)
		} else if kind == "application" && (chartName == "web" || chartName == "worker") {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", rel.Name, rel.Namespace, rel.Info.Status, chartName)
		} else if kind == "job" && chartName == "job" {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", rel.Name, rel.Namespace, rel.Info.Status, chartName)
		} else if kind == "addon" && chartName != "web" && chartName != "worker" && chartName != "job" {
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", rel.Name, rel.Namespace, rel.Info.Status, chartName)
		}
	}

	w.Flush()

	return nil
}
