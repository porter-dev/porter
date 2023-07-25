import React, { Component } from "react";
import styled from "styled-components";

import { Context } from "shared/Context";
import settings from "assets/settings.png";

import InvitePage from "./InviteList";
import TabRegion from "components/TabRegion";
import Heading from "components/form-components/Heading";
import Helper from "components/form-components/Helper";
import DashboardHeader from "../cluster-dashboard/DashboardHeader";
import { withAuth, WithAuthProps } from "shared/auth/AuthorizationHoc";
import { RouteComponentProps, withRouter, WithRouterProps } from "react-router";
import { getQueryParam } from "shared/routing";
import APITokensSection from "./APITokensSection";
import _ from "lodash";
import Link from "components/porter/Link";
import Spacer from "components/porter/Spacer";
import ProjectDeleteConsent from "./ProjectDeleteConsent";

type PropsType = RouteComponentProps & WithAuthProps & {};

type StateType = {
  projectName: string;
  currentTab: string;
  tabOptions: { value: string; label: string }[];
  showCostConfirmModal: boolean;
};

class ProjectSettings extends Component<PropsType, StateType> {
  state = {
    projectName: "",
    currentTab: "manage-access",
    tabOptions: [] as { value: string; label: string }[],
    showCostConfirmModal: false,
  };

  componentDidUpdate(prevProps: PropsType) {
    const selectedTab =
      getQueryParam(this.props, "selected_tab") || "manage-access";

    if (
      prevProps.location.search !== this.props.location.search &&
      this.state.currentTab !== selectedTab
    ) {
      this.setState({ currentTab: selectedTab });
    }

    // if (
    //   this.context?.hasBillingEnabled &&
    //   !this.state.tabOptions.find((t) => t.value === "billing")
    // ) {
    //   const tabOptions = this.state.tabOptions;
    //   tabOptions.splice(1, 0, { value: "billing", label: "Billing" });
    //   this.setState({ tabOptions });
    //   return;
    // }

    // if (
    //   !this.context?.hasBillingEnabled &&
    //   this.state.tabOptions.find((t) => t.value === "billing")
    // ) {
    //   const tabOptions = this.state.tabOptions;
    //   const billingIndex = this.state.tabOptions.findIndex(
    //     (t) => t.value === "billing"
    //   );
    //   tabOptions.splice(billingIndex, 1);
    // }
  }

  componentDidMount() {
    let { currentProject } = this.context;

    if (this.state.projectName !== currentProject.name) {
      this.setState({ projectName: currentProject.name });
    }

    const tabOptions = [];
    tabOptions.push({ value: "manage-access", label: "Manage access" });
    // ? Disabled for now https://discord.com/channels/542888846271184896/1059277393031856208/1059277395913351258
    // tabOptions.push({
    //   value: "billing",
    //   label: "Billing",
    // });

    if (currentProject?.api_tokens_enabled) {
      tabOptions.push({
        value: "api-tokens",
        label: "API Tokens",
      });
    }

    if (this.props.isAuthorized("settings", "", ["get", "delete"])) {
      // if (this.context?.hasBillingEnabled) {
      //   tabOptions.push({
      //     value: "billing",
      //     label: "Billing",
      //   });
      // }

      tabOptions.push({
        value: "additional-settings",
        label: "Additional settings",
      });
    }

    if (!_.isEqual(tabOptions, this.state.tabOptions)) {
      this.setState({ tabOptions });
    }

    const selectedTab = getQueryParam(this.props, "selected_tab");
    if (selectedTab && selectedTab !== this.state.currentTab) {
      this.setState({ currentTab: selectedTab });
    }
  }

  renderTabContents = () => {
    if (!this.props.isAuthorized("settings", "", ["get", "delete"])) {
      return <InvitePage />;
    }

    // if (
    //   this.state.currentTab === "billing" &&
    //   this.context?.hasBillingEnabled
    // ) {
    //   return <BillingPage />;
    // }

    if (this.state.currentTab === "manage-access") {
      return <InvitePage />;
    } else if (this.state.currentTab === "api-tokens") {
      return <APITokensSection />;
    } else if (this.state.currentTab === "billing") {
      return (
        <Placeholder>
          <Helper>
            Visit the{" "}
            <a
              href={`/api/projects/${this.context.currentProject?.id}/billing/redirect`}
            >
              billing portal
            </a>{" "}
            to view plans.
          </Helper>
        </Placeholder>
      );
    } else {
      return (
        <>
          <Heading isAtTop={true}>Delete project</Heading>
          <Helper>
          </Helper>
          <Helper>
            Permanently delete this project. This will destroy all clusters tied
            to this project that have been provisioned by Porter. Note that this
            will not delete the image registries provisioned by Porter. To
            delete the registries, please do so manually in your cloud console.
          </Helper>

          <DeleteButton
            onClick={() => {
              this.setState({ showCostConfirmModal: true });
            }}
          >
            Delete project
          </DeleteButton>
          <ProjectDeleteConsent
            setShowCostConfirmModal={(show: boolean) => this.setState({ showCostConfirmModal: show })}
            show={this.state.showCostConfirmModal}  // <-- Pass these props
          />
        </>
      );
    }
  };

  render() {
    return (
      <StyledProjectSettings>
        <DashboardHeader
          image={settings}
          title="Project settings"
          description="Configure access permissions and additional project settings."
          disableLineBreak
        />
        <TabRegion
          currentTab={this.state.currentTab}
          setCurrentTab={(x: string) => this.setState({ currentTab: x })}
          options={this.state.tabOptions}
        >
          {this.renderTabContents()}
        </TabRegion>
      </StyledProjectSettings>
    );
  }
}

ProjectSettings.contextType = Context;

export default withRouter(withAuth(ProjectSettings));

const Placeholder = styled.div`
  width: 100%;
  height: 200px;
  background: #ffffff11;
  border-radius: 3px;
  display: flex;
  align-items: center;
  text-align: center;
  padding: 0 30px;
  justify-content: center;
  padding-bottom: 10px;
`;

const Warning = styled.div`
  font-size: 13px;
  color: ${(props: { highlight: boolean; makeFlush?: boolean }) =>
    props.highlight ? "#f5cb42" : ""};
  margin-bottom: 20px;
`;

const StyledProjectSettings = styled.div`
  width: 100%;
  min-width: 300px;
  height: 100vh;
`;

const DeleteButton = styled.div`
  height: 35px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 15px;
  margin-top: 10px;
  text-align: left;
  float: left;
  margin-left: 0;
  justify-content: center;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
  :focus {
    outline: 0;
  }
  :hover {
    filter: brightness(120%);
  }
  background: #b91133;
  border: none;
  :hover {
    filter: brightness(120%);
  }
`;
