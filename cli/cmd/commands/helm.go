package commands

import (
	"context"
	"fmt"
	"os"
	"os/exec"

	api "github.com/porter-dev/porter/api/client"
	"github.com/porter-dev/porter/api/types"
	"github.com/porter-dev/porter/cli/cmd/config"
	"github.com/spf13/cobra"
)

func registerCommand_Helm(cliConf config.CLIConfig) *cobra.Command {
	helmCmd := &cobra.Command{
		Use:   "helm",
		Short: "Use helm to interact with a Porter cluster",
		Run: func(cmd *cobra.Command, args []string) {
			err := checkLoginAndRunWithConfig(cmd, cliConf, args, runHelm)
			if err != nil {
				os.Exit(1)
			}
		},
	}

	return helmCmd
}

func runHelm(ctx context.Context, _ *types.GetAuthenticatedUserResponse, client api.Client, cliConf config.CLIConfig, featureFlags config.FeatureFlags, args []string) error {
	_, err := exec.LookPath("helm")
	if err != nil {
		return fmt.Errorf("error finding helm: %w", err)
	}

	tmpFile, err := downloadTempKubeconfig(ctx, client, cliConf)
	if err != nil {
		return err
	}

	defer func() {
		os.Remove(tmpFile)
	}()

	os.Setenv("KUBECONFIG", tmpFile)

	cmd := exec.Command("helm", args...)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err = cmd.Run()

	if err != nil {
		return fmt.Errorf("error running helm: %w", err)
	}

	return nil
}
