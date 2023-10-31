package commands

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/fatih/color"

	api "github.com/porter-dev/porter/api/client"
	"github.com/porter-dev/porter/api/types"
	"github.com/porter-dev/porter/cli/cmd/config"
	loginBrowser "github.com/porter-dev/porter/cli/cmd/login"
	"github.com/porter-dev/porter/cli/cmd/utils"
	"github.com/spf13/cobra"
)

var manual bool = false

// func registerCommand_Auth() *cobra.Command {
func registerCommand_Auth() *cobra.Command {
	authCmd := &cobra.Command{
		Use:   "auth",
		Short: "Commands for authenticating to a Porter server",
	}

	loginCmd := &cobra.Command{
		Use:   "login",
		Short: "Authorizes a user for a given Porter server",
		RunE: func(cmd *cobra.Command, args []string) error {
			cliConf, currentProfile, err := currentProfileIncludingFlags(cmd)
			if err != nil {
				return fmt.Errorf("error getting current profile config: %w", err)
			}

			err = login(cmd.Context(), cliConf, currentProfile)
			if err != nil {
				color.Red("Error logging in: %s\n", err.Error())
				if strings.Contains(err.Error(), "Forbidden") {
					_ = config.SetToken("", currentProfile)
				}
				os.Exit(1)
			}
			return nil
		},
	}

	registerCmd := &cobra.Command{
		Use:   "register",
		Short: "Creates a user for a given Porter server",
		RunE: func(cmd *cobra.Command, args []string) error {
			cliConf, _, err := currentProfileIncludingFlags(cmd)
			if err != nil {
				return fmt.Errorf("error getting current profile config: %w", err)
			}

			err = register(cmd.Context(), cliConf)
			if err != nil {
				color.Red("Error registering: %s\n", err.Error())
				os.Exit(1)
			}
			return nil
		},
	}

	logoutCmd := &cobra.Command{
		Use:   "logout",
		Short: "Logs a user out of a given Porter server",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, currentProfile, err := currentProfileIncludingFlags(cmd)
			if err != nil {
				return fmt.Errorf("error getting current profile config: %w", err)
			}

			err = checkLoginAndRunWithConfig(cmd, args, logout)
			if err != nil {
				config.SetToken("", currentProfile)
				config.SetCluster(0, currentProfile)
				config.SetProject(0, currentProfile)
				color.Green("Successfully logged out")
			}
			return nil
		},
	}

	authCmd.AddCommand(loginCmd)
	authCmd.AddCommand(registerCmd)
	authCmd.AddCommand(logoutCmd)

	loginCmd.PersistentFlags().BoolVar(
		&manual,
		"manual",
		false,
		"whether to prompt for manual authentication (username/pw)",
	)

	return authCmd
}

func login(ctx context.Context, cliConf config.CLIConfig, currentProfile string) error {
	client, err := api.NewClientWithConfig(ctx, api.NewClientInput{
		BaseURL:     fmt.Sprintf("%s/api", cliConf.Host),
		BearerToken: cliConf.Token,
	})
	if err != nil {
		if !errors.Is(err, api.ErrNoAuthCredential) {
			return fmt.Errorf("error creating porter API client: %w", err)
		}
	}

	_, err = client.AuthCheck(ctx)
	if err != nil {
		if !strings.Contains(err.Error(), "Forbidden") {
			return fmt.Errorf("unexpected error performing authorization check: %w", err)
		}
	}

	if cliConf.Token == "" {
		// check for the --manual flag
		if manual {
			return loginManual(ctx, cliConf, client, currentProfile)
		}

		// log the user in
		token, err := loginBrowser.Login(cliConf.Host)
		if err != nil {
			return err
		}

		// set the token in config
		err = config.SetToken(token, currentProfile)
		if err != nil {
			return err
		}

		client, err = api.NewClientWithConfig(ctx, api.NewClientInput{
			BaseURL:     fmt.Sprintf("%s/api", cliConf.Host),
			BearerToken: token,
		})
		if err != nil {
			return fmt.Errorf("error creating porter API client: %w", err)
		}

		_, err = client.AuthCheck(ctx)
		if err != nil {
			color.Red("Invalid token.")
			return err
		}

		_, _ = color.New(color.FgGreen).Println("Successfully logged in!")
		return setProjectForUser(ctx, client, cliConf, currentProfile)

	}

	err = config.SetToken(cliConf.Token, currentProfile)
	if err != nil {
		return err
	}

	err = config.SetHost(cliConf.Host, currentProfile)
	if err != nil {
		return err
	}

	projID, exists, err := api.GetProjectIDFromToken(cliConf.Token)
	if err != nil {
		return err
	}

	// if project ID does not exist for the token, this is a user-issued CLI token, so the project
	// ID should be queried
	if !exists {
		err = setProjectForUser(ctx, client, cliConf, currentProfile)
		if err != nil {
			return err
		}
	} else {
		// if the project ID does exist for the token, this is a project-issued token, and
		// the project should be set automatically
		err = config.SetProject(projID, currentProfile)
		if err != nil {
			return err
		}

		err = setProjectCluster(ctx, client, cliConf, currentProfile, projID)
		if err != nil {
			return err
		}
	}
	_, _ = color.New(color.FgGreen).Println("Successfully logged in!")

	return nil
}

func setProjectForUser(ctx context.Context, client api.Client, cliConfig config.CLIConfig, currentProfile string) error {
	// get a list of projects, and set the current project
	resp, err := client.ListUserProjects(ctx)
	if err != nil {
		return err
	}

	projects := *resp

	if len(projects) > 0 {
		config.SetProject(projects[0].ID, currentProfile) //nolint:errcheck,gosec // do not want to change logic of CLI. New linter error

		err = setProjectCluster(ctx, client, cliConfig, currentProfile, projects[0].ID)
		if err != nil {
			return err
		}
	}

	return nil
}

func loginManual(ctx context.Context, cliConf config.CLIConfig, client api.Client, currentProfile string) error {
	client.CookieFilePath = "cookie.json" // required as this uses cookies for auth instead of a token
	var username, pw string

	fmt.Println("Please log in with an email and password:")

	username, err := utils.PromptPlaintext("Email: ")
	if err != nil {
		return err
	}

	pw, err = utils.PromptPassword("Password: ")
	if err != nil {
		return err
	}
	_, err = client.Login(ctx, &types.LoginUserRequest{
		Email:    username,
		Password: pw,
	})
	if err != nil {
		return err
	}

	// set the token to empty since this is manual (cookie-based) login
	config.SetToken("", currentProfile)

	color.New(color.FgGreen).Println("Successfully logged in!")

	// get a list of projects, and set the current project
	resp, err := client.ListUserProjects(ctx)
	if err != nil {
		return err
	}

	projects := *resp

	if len(projects) > 0 {
		config.SetProject(projects[0].ID, currentProfile) //nolint:errcheck,gosec // do not want to change logic of CLI. New linter error

		err = setProjectCluster(ctx, client, cliConf, currentProfile, projects[0].ID)
		if err != nil {
			return err
		}
	}

	return nil
}

func register(ctx context.Context, cliConf config.CLIConfig) error {
	client, err := api.NewClientWithConfig(ctx, api.NewClientInput{
		BaseURL:     fmt.Sprintf("%s/api", cliConf.Host),
		BearerToken: cliConf.Token,
	})
	if err != nil {
		if !errors.Is(err, api.ErrNoAuthCredential) {
			return fmt.Errorf("error creating porter API client: %w", err)
		}
	}

	fmt.Println("Please register your admin account with an email and password:")

	username, err := utils.PromptPlaintext("Email: ")
	if err != nil {
		return err
	}

	pw, err := utils.PromptPasswordWithConfirmation()
	if err != nil {
		return err
	}

	resp, err := client.CreateUser(ctx, &types.CreateUserRequest{
		Email:    username,
		Password: pw,
	})
	if err != nil {
		return err
	}

	color.New(color.FgGreen).Printf("Created user with email %s and id %d\n", username, resp.ID)

	return nil
}

func logout(ctx context.Context, user *types.GetAuthenticatedUserResponse, client api.Client, cliConf config.CLIConfig, currentProfile string, featureFlags config.FeatureFlags, cmd *cobra.Command, args []string) error {
	err := client.Logout(ctx)
	if err != nil {
		if !strings.Contains(err.Error(), "You are not logged in.") &&
			!strings.Contains(err.Error(), "does not have a role in project") {
			return err
		}
	}

	config.SetToken("", currentProfile)
	config.SetCluster(0, currentProfile)
	config.SetProject(0, currentProfile)

	color.Green("Successfully logged out")

	return nil
}
