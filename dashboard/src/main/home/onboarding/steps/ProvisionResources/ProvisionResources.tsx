import Helper from "components/form-components/Helper";
import SaveButton from "components/SaveButton";
import TitleSection from "components/TitleSection";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import styled from "styled-components";
import ProviderSelector, {
  provisionerOptions,
  provisionerOptionsWithExternal,
} from "../../components/ProviderSelector";

import FormFlowWrapper from "./forms/FormFlow";
import ConnectExternalCluster from "./forms/_ConnectExternalCluster";
import backArrow from "assets/back_arrow.png";
import { StatusPage } from "./forms/StatusPage";
import { useSnapshot } from "valtio";
import { OFState } from "../../state";
import { provisionResourcesTracks } from "shared/anayltics";
import DocsHelper from "components/DocsHelper";
import Description from "components/Description";
import api from "shared/api";
import Placeholder from "components/OldPlaceholder";
import Loading from "components/Loading";
import MultiSaveButton from "components/MultiSaveButton";
import buildLogger from "shared/error_handling/logger";

const ProvisionResourcesLogger = buildLogger("onboarding.provision_resources");

const ProvisionResources: React.FC<{}> = () => {
  const snap = useSnapshot(OFState);
  const { step } = useParams<{ step: any }>();
  const [infraStatus, setInfraStatus] = useState<{
    hasError: boolean;
    errored_infras: number[];
    description?: string;
  }>(null);

  const [isLoading, setIsLoading] = useState(false);

  const shouldProvisionRegistry = !!snap.StateHandler.connected_registry?.skip;
  const provider = snap.StateHandler.provision_resources?.provider;
  const project = snap.StateHandler.project;
  const enableGoBack =
    snap.StepHandler.canGoBack && !snap.StepHandler.isSubFlow;

  const handleContinue = (data?: any) => {
    OFState.actions.nextStep("continue", data);
  };

  const handleGoBack = (data?: any) => {
    OFState.actions.nextStep("go_back", data);
  };

  const handleSelectProvider = (provider: string) => {
    if (provider !== "external") {
      provisionResourcesTracks.trackProvisionIntent({ provider });
      OFState.actions.nextStep("continue", provider);
      return;
    }
    provisionResourcesTracks.trackConnectExternalClusterIntent();
    OFState.actions.nextStep("skip");
  };

  const retryFailedInfras = () => {
    setIsLoading(true);

    // call API endpoint to retry all failed infras
    const promises = Promise.all(
      infraStatus?.errored_infras.map(async (erroredInfraID) => {
        const res = await api.retryCreateInfra(
          "<token>",
          {},
          {
            project_id: project.id,
            infra_id: erroredInfraID,
          }
        );
        return res.data;
      })
    );

    promises.then(() => {
      setInfraStatus(null);
      setIsLoading(false);
    });
  };

  const deleteAllInfras = () => {
    // since this is onboarding, we start deletion for all infras even if they're errored, and send
    // the user back to the settings page.
    api
      .getInfra(
        "<token>",
        {},
        {
          project_id: project.id,
        }
      )
      .then(({ data }) => {
        if (!Array.isArray(data)) {
          throw Error("Data is not an array");
        }

        // call API endpoint to retry all failed infras
        const promises = Promise.all(
          data?.map(async (erroredInfraID) => {
            const res = await api.destroyInfra(
              "<token>",
              {},
              {
                project_id: project.id,
                infra_id: erroredInfraID,
              }
            );
            return res.data;
          })
        );

        promises.then(() => {
          // TODO: send the user back to the settings page
          handleGoBack(
            "Infrastructure successfully deleted: please configure settings and try again."
          );
        });
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  };

  const renderSaveButton = () => {
    if (typeof infraStatus?.hasError !== "boolean") {
      return;
    }

    if (infraStatus && !infraStatus.hasError) {
      return (
        <>
          <Br height="15px" />
          <SaveButton
            text="Continue"
            disabled={false}
            onClick={() => handleContinue()}
            makeFlush={true}
            clearPosition={true}
            statusPosition="right"
            saveText=""
          />
        </>
      );
    } else if (infraStatus) {
      return (
        <>
          <Br height="15px" />
          <ErrorStateContainer>
            <MultiSaveButton
              options={[
                {
                  text: "Retry Failed Resources",
                  description:
                    "Retry all failed resources. This continues provisioning from the last resource which errored out.",
                  onClick: retryFailedInfras,
                },
                {
                  text: "Re-Configure Settings",
                  description:
                    "Re-configure settings for the infrastructure. This continues provisioning from the last resource which errored out with different settings.",
                  onClick: () => {
                    handleGoBack("");
                  },
                },
                {
                  text: "Delete All Resources",
                  description:
                    "Delete all resources. This begins the delete process for all resources so that you can start from scratch.",
                  onClick: deleteAllInfras,
                },
              ]}
              disabled={false}
              makeFlush={true}
              clearPosition={true}
              statusPosition="right"
              saveText=""
            />
          </ErrorStateContainer>
        </>
      );
    }
  };

  const description = useMemo(() => {
    if (infraStatus?.hasError) {
      return "Error while creating infrastructure. Please select an option below to continue.";
    }

    return "Note: Provisioning can take up to 15 minutes.";
  }, [infraStatus]);

  const filterOpts = useMemo(() => {
    switch (provider) {
      case "aws":
        return ["eks", "ecr"];
      case "gcp":
        return ["gke", "gcr", "gar"];
      case "do":
        return ["doks", "docr"];
    }

    return [];
  }, [provider]);

  useEffect(() => {
    if (!infraStatus) return;

    if (typeof infraStatus.hasError !== "boolean") return;

    if (infraStatus.hasError) {
      const cause = new Error(
        JSON.stringify({
          description: infraStatus.description,
          errored_infras: infraStatus.errored_infras,
        })
      );

      ProvisionResourcesLogger.critical(
        new Error(
          `Provisioner error detected ${snap.StateHandler.project.id}`,
          { cause }
        )
      );
    }
  }, [infraStatus]);

  const Content = () => {
    switch (step) {
      case "credentials":
      case "settings":
        return <FormFlowWrapper currentStep={step} />;
      case "status":
        if (isLoading) {
          return (
            <Placeholder>
              <Loading />
            </Placeholder>
          );
        }

        return (
          <>
            <StatusPage
              project_id={project?.id}
              filter={filterOpts}
              setInfraStatus={setInfraStatus}
              filterLatest
              auto_expanded
              sortBy="id"
              set_max_width={true}
              can_delete={false}
            />
            <Br />
            <Helper>{description}</Helper>
            {renderSaveButton()}
          </>
        );
      case "connect_own_cluster":
        return (
          <ConnectExternalCluster
            nextStep={handleContinue}
            project={project}
            goBack={handleGoBack}
          />
        );
      default:
        return (
          <ProviderSelector
            selectProvider={handleSelectProvider}
            options={
              shouldProvisionRegistry
                ? provisionerOptions
                : provisionerOptionsWithExternal
            }
          />
        );
    }
  };

  return (
    <div>
      {enableGoBack && (
        <BackButton
          onClick={() => {
            handleGoBack();
          }}
        >
          <BackButtonImg src={backArrow} />
        </BackButton>
      )}
      <TitleSection>Getting started</TitleSection>
      <Subtitle>
        Step 3 of 3 - Provision resources
        <DocsHelper
          placement="bottom-end"
          tooltipText="Porter provisions and manages the underlying infrastructure in your own cloud. It is not necessary to know about the provisioned resources to use Porter."
          link={
            "https://docs.porter.run/getting-started/provisioning-infrastructure#faq"
          }
        />
      </Subtitle>
      <Helper>
        Porter automatically creates a cluster and registry in your cloud to run
        applications.
      </Helper>
      {Content()}
    </div>
  );
};

export default ProvisionResources;

const Br = styled.div<{ height?: string }>`
  width: 100%;
  height: ${(props) => props.height || "1px"};
  margin-top: -3px;
`;

const Subtitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-top: 16px;
  display: flex;
`;

const BackButton = styled.div`
  margin-bottom: 24px;
  display: flex;
  width: 36px;
  cursor: pointer;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid #ffffff55;
  border-radius: 100px;
  background: #ffffff11;

  :hover {
    background: #ffffff22;
    > img {
      opacity: 1;
    }
  }
`;

const BackButtonImg = styled.img`
  width: 16px;
  opacity: 0.75;
`;

const ErrorStateContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledBack = styled.div`
  margin-left: 14px;
`;

const StyledDescription = styled(Description)`
  text-align: right;
  cursor: pointer;
`;
