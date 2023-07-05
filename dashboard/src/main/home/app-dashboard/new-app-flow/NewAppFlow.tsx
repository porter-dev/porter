import React, { useState, useContext, useEffect } from "react";
import styled from "styled-components";
import { RouteComponentProps, withRouter } from "react-router";
import _ from "lodash";
import yaml from "js-yaml";

import { Context } from "shared/Context";
import api from "shared/api";
import web from "assets/web.png";

import Back from "components/porter/Back";
import DashboardHeader from "../../cluster-dashboard/DashboardHeader";
import Text from "components/porter/Text";
import Spacer from "components/porter/Spacer";
import Input from "components/porter/Input";
import VerticalSteps from "components/porter/VerticalSteps";
import Button from "components/porter/Button";
import SourceSelector, { SourceType } from "./SourceSelector";
import Container from "components/porter/Container";

import SourceSettings from "./SourceSettings";
import Services from "./Services";
import EnvGroupArray, { KeyValueType } from "main/home/cluster-dashboard/env-groups/EnvGroupArray";
import GithubActionModal from "./GithubActionModal";
import Error from "components/porter/Error";
import { PorterJson, PorterYamlSchema, createFinalPorterYaml } from "./schema";
import { Service } from "./serviceTypes";
import GithubConnectModal from "./GithubConnectModal";
import Link from "components/porter/Link";
import { BuildMethod, PorterApp } from "../types/porterApp";

type Props = RouteComponentProps & {};

interface FormState {
  applicationName: string;
  selectedSourceType: SourceType | undefined;
  serviceList: Service[];
  envVariables: KeyValueType[];
}

const INITIAL_STATE: FormState = {
  applicationName: "",
  selectedSourceType: undefined,
  serviceList: [],
  envVariables: [],
};

const Validators: {
  [key in keyof FormState]: (value: FormState[key]) => boolean;
} = {
  applicationName: (value: string) => value.trim().length > 0,
  selectedSourceType: (value: SourceType | undefined) => value !== undefined,
  serviceList: (value: Service[]) => value.length > 0,
  envVariables: (value: KeyValueType[]) => true,
};

type Detected = {
  detected: boolean;
  message: string;
};
interface GithubAppAccessData {
  username?: string;
  accounts?: string[];
}

interface PorterJsonWithPath {
  porterYamlPath: string;
  porterJson: PorterJson;
}

const NewAppFlow: React.FC<Props> = ({ ...props }) => {
  const [porterApp, setPorterApp] = useState<PorterApp>(PorterApp.empty());

  const [imageTag, setImageTag] = useState("latest");
  const { currentCluster, currentProject } = useContext(Context);
  const [deploying, setDeploying] = useState<boolean>(false);
  const [deploymentError, setDeploymentError] = useState<string | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [existingStep, setExistingStep] = useState<number>(0);
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE);
  const [porterYaml, setPorterYaml] = useState("");
  const [showGHAModal, setShowGHAModal] = useState<boolean>(false);
  const [showGithubConnectModal, setShowGithubConnectModal] = useState<boolean>(
    false
  );

  const [showConnectModal, setConnectModal] = useState<boolean>(true);
  const [hasClickedDoNotConnect, setHasClickedDoNotConnect] = useState(() =>
    JSON.parse(localStorage.getItem("hasClickedDoNotConnect") || "false")
  );
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState(false);
  const [accessData, setAccessData] = useState<GithubAppAccessData>({});
  const [hasProviders, setHasProviders] = useState(true);

  const [porterJsonWithPath, setPorterJsonWithPath] = useState<PorterJsonWithPath | undefined>(undefined);
  const [detected, setDetected] = useState<Detected | undefined>(undefined);
  const [buildView, setBuildView] = useState<BuildMethod>("buildpacks");

  const [existingApps, setExistingApps] = useState<string[]>([]);
  const [appNameInputError, setAppNameInputError] = useState<string | undefined>(undefined);

  // this advances the step in the case that a user chooses a repo that doesn't have a porter.yaml
  useEffect(() => {
    if (porterApp.git_branch !== "") {
      setCurrentStep(Math.max(currentStep, 2));
    }
  }, [porterApp.git_branch]);

  useEffect(() => {
    let isSubscribed = true;

    if (currentProject == null) {
      return;
    }

    api
      .getGitProviders("<token>", {}, { project_id: currentProject?.id })
      .then((res) => {
        const data = res.data;
        if (!isSubscribed) {
          return;
        }

        if (!Array.isArray(data)) {
          setHasProviders(false);
          return;
        }
      })
      .catch((err) => {
        setHasProviders(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [currentProject]);

  useEffect(() => {
    const getApps = async () => {
      try {
        const res = await api.getPorterApps(
          "<token>",
          {},
          {
            project_id: currentProject.id,
            cluster_id: currentCluster.id,
          }
        );
        if (res?.data != null) {
          setExistingApps(res.data.map((app: PorterApp) => app.name));
        }
      } catch (err) {
      }
    };
    getApps();
  }, [])

  useEffect(() => {
    setFormState({ ...formState, serviceList: [] });
  }, [porterApp.git_branch]);

  const handleSetAccessData = (data: GithubAppAccessData) => {
    setAccessData(data);
    setShowGithubConnectModal(
      !hasClickedDoNotConnect &&
      (accessError || !data.accounts || data.accounts?.length === 0)
    );
  };

  const handleSetAccessError = (error: boolean) => {
    setAccessError(error);
    setShowGithubConnectModal(
      !hasClickedDoNotConnect &&
      (error || !accessData.accounts || accessData.accounts?.length === 0)
    );
  };

  const updateStackStep = async (step: string, errorMessage: string = "") => {
    try {
      if (currentCluster?.id == null || currentProject?.id == null) {
        throw "Unable to capture analytics, project or cluster not found";
      }
      await api.updateStackStep(
        "<token>",
        {
          step,
          stack_name: porterApp.name,
          error_message: errorMessage,
        },
        {
          cluster_id: currentCluster.id,
          project_id: currentProject.id,
        }
      );
    } catch (err) {
      // TODO: handle analytics error
    }
  };

  const validateAndSetPorterYaml = (yamlString: string, filename: string) => {
    let parsedYaml;
    try {
      parsedYaml = yaml.load(yamlString);
      const parsedData = PorterYamlSchema.parse(parsedYaml);
      const porterYamlToJson = parsedData as PorterJson;
      setPorterJsonWithPath({ porterJson: porterYamlToJson, porterYamlPath: filename });
      const newServices = [];
      const existingServices = formState.serviceList.map((s) => s.name);
      for (const [name, app] of Object.entries(porterYamlToJson.apps)) {
        if (!existingServices.includes(name)) {
          if (app.type) {
            newServices.push(Service.default(name, app.type, porterYamlToJson));
          } else if (name.includes("web")) {
            newServices.push(Service.default(name, "web", porterYamlToJson));
          } else {
            newServices.push(Service.default(name, "worker", porterYamlToJson));
          }
        }
      }
      if (porterYamlToJson.release != null && !existingServices.includes("pre-deploy")) {
        newServices.push(Service.default("pre-deploy", "release", porterYamlToJson));
      }
      const newServiceList = [...formState.serviceList, ...newServices];
      if (Validators.serviceList(newServiceList)) {
        setCurrentStep(Math.max(currentStep, 5));
      }
      setFormState({
        ...formState,
        serviceList: newServiceList,
      });
      if (
        porterYamlToJson &&
        porterYamlToJson.apps &&
        Object.keys(porterYamlToJson.apps).length > 0
      ) {
        setDetected({
          detected: true,
          message: `Detected ${Object.keys(porterYamlToJson.apps).length
            } service${Object.keys(porterYamlToJson.apps).length === 1 ? "" : "s"} from porter.yaml`,
        });
      } else {
        setDetected({
          detected: false,
          message:
            "Could not detect any services from porter.yaml. Make sure it exists in the root of your repo.",
        });
      }
    } catch (error) {
      console.log("Error converting porter yaml file to input: " + error);
    }
  };

  const handleAppNameChange = (name: string) => {
    setPorterApp(PorterApp.setAttribute(porterApp, "name", name));
    const appNameInputError = getAppNameInputError(name);
    if (appNameInputError == null) {
      setCurrentStep(Math.max(Math.max(currentStep, 1), existingStep));
    } else {
      setExistingStep(Math.max(currentStep, existingStep));
      setCurrentStep(0);
    }
    setAppNameInputError(appNameInputError);
  };

  const handleDoNotConnect = () => {
    setHasClickedDoNotConnect(true);
    localStorage.setItem("hasClickedDoNotConnect", "true");
  };

  const getAppNameInputError = (name: string) => {
    const regex = /^[a-z0-9-]{1,61}$/;
    if (name === "") {
      return undefined;
    } else if (!regex.test(name)) {
      return 'Lowercase letters, numbers, and "-" only.';
    } else if (name.length > 30) {
      return "Maximum 30 characters allowed.";
    } else if (existingApps.includes(name)) {
      return "An app with this name already exists.";
    }
    return undefined;
  };

  const deployPorterApp = async () => {
    try {
      setDeploying(true);
      setDeploymentError(undefined);

      // log analytics event that we started form submission
      updateStackStep("stack-launch-complete");

      if (currentProject?.id == null || currentCluster?.id == null) {
        throw "Project or cluster not found";
      }

      // validate form data
      const finalPorterYaml = createFinalPorterYaml(
        formState.serviceList,
        formState.envVariables,
        porterJsonWithPath?.porterJson,
        // if we are using a heroku buildpack, inject a PORT env variable
        porterApp.builder.includes("heroku")
      );

      const yamlString = yaml.dump(finalPorterYaml);
      const base64Encoded = btoa(yamlString);
      let imageInfo = {
        repository: "",
        tag: "",
      };
      if (porterApp.image_repo_uri && imageTag) {
        imageInfo = {
          repository: porterApp.image_repo_uri,
          tag: imageTag,
        };
      }

      const porterAppRequest = {
        porter_yaml: base64Encoded,
        override_release: true,
        image_info: imageInfo,
        ...PorterApp.empty(),
        buildpacks: "",
        // for some reason I couldn't get the path to update the porterApp object correctly here so I just grouped it with the porter json :/
        porter_yaml_path: porterJsonWithPath?.porterYamlPath,
        repo_name: porterApp.repo_name,
        git_branch: porterApp.git_branch,
        git_repo_id: porterApp.git_repo_id,
        build_context: porterApp.build_context,
        image_repo_uri: porterApp.image_repo_uri,
      }
      if (buildView === "docker") {
        porterAppRequest.dockerfile = porterApp.dockerfile;
      } else {
        porterAppRequest.builder = porterApp.builder;
        porterAppRequest.buildpacks = porterApp.buildpacks.join(",");
      }

      await api.createPorterApp(
        "<token>",
        porterAppRequest,
        {
          cluster_id: currentCluster.id,
          project_id: currentProject.id,
          stack_name: porterApp.name,
        }
      );

      if (porterApp.repo_name === "") {
        props.history.push(`/apps/${porterApp.name}`);
      }

      // log analytics event that we successfully deployed
      updateStackStep("stack-launch-success");

      return true;
    } catch (err: any) {
      // TODO: better error handling
      const errMessage =
        err?.response?.data?.error ??
        err?.toString() ??
        "An error occurred while deploying your app. Please try again.";
      setDeploymentError(errMessage);
      updateStackStep("stack-launch-failure", errMessage);
      return false;
    } finally {
      setDeploying(false);
    }
  };

  return (
    <CenterWrapper>
      <Div>
        {showConnectModal && !hasProviders && (
          <GithubConnectModal
            closeModal={() => setConnectModal(false)}
            hasClickedDoNotConnect={hasClickedDoNotConnect}
            handleDoNotConnect={handleDoNotConnect}
            accessData={accessData}
            setAccessLoading={setAccessLoading}
            accessError={accessError}
            setAccessData={handleSetAccessData}
            setAccessError={handleSetAccessError}
          />
        )}
        <StyledConfigureTemplate>
          <Back to="/apps" />
          <DashboardHeader
            prefix={<Icon src={web} />}
            title="Deploy a new application"
            capitalize={false}
            disableLineBreak
          />
          <DarkMatter />
          <VerticalSteps
            currentStep={currentStep}
            steps={[
              <>
                <Text size={16}>Application name</Text>
                <Spacer y={0.5} />
                <Text color="helper">
                  Lowercase letters, numbers, and "-" only.
                </Text>
                <Spacer y={0.5} />
                <Input
                  placeholder="ex: academic-sophon"
                  value={porterApp.name}
                  width="300px"
                  error={appNameInputError}
                  setValue={handleAppNameChange}
                />
              </>,
              <>
                <Text size={16}>Deployment method</Text>
                <Spacer y={0.5} />
                <Text color="helper">
                  Deploy from a Git repository or a Docker registry.
                  <Spacer inline width="5px" />
                  <Link
                    hasunderline
                    to="https://docs.porter.run/standard/deploying-applications/overview"
                    target="_blank"
                  >
                    Learn more
                  </Link>
                </Text>
                <Spacer y={0.5} />
                <SourceSelector
                  selectedSourceType={formState.selectedSourceType}
                  setSourceType={(type) => {
                    setPorterYaml("");
                    setFormState({ ...formState, selectedSourceType: type });
                  }}
                />
                <SourceSettings
                  source={formState.selectedSourceType}
                  setPorterYaml={(newYaml: string, filename: string) => {
                    validateAndSetPorterYaml(newYaml, filename);
                  }}
                  porterApp={porterApp}
                  setPorterApp={setPorterApp}
                  imageUrl={porterApp.image_repo_uri}
                  setImageUrl={(url: string) => {
                    setPorterApp(PorterApp.setAttribute(porterApp, "image_repo_uri", url));
                    setCurrentStep(Math.max(currentStep, 2));
                  }}
                  imageTag={imageTag}
                  setImageTag={setImageTag}
                  buildView={buildView}
                  setBuildView={setBuildView}
                />
              </>,
              <>
                <Container row>
                  <Text size={16}>
                    Application services{" "}
                  </Text>
                  {detected && formState.serviceList.length > 0 && (
                    <AppearingDiv color={detected.detected ? "#8590ff" : "#fcba03"}>
                      {detected.detected ? (
                        <I className="material-icons">check</I>
                      ) : (
                        <I className="material-icons">error</I>
                      )}
                      <Text color={detected.detected ? "#8590ff" : "#fcba03"}>
                        {detected.message}
                      </Text>
                    </AppearingDiv>
                  )}
                </Container>
                <Spacer y={0.5} />
                <Services
                  setServices={(services: Service[]) => {
                    const release = formState.serviceList.filter(Service.isRelease)
                    setFormState({ ...formState, serviceList: [...services, ...release] });
                    if (Validators.serviceList(services)) {
                      setCurrentStep(Math.max(currentStep, 5));
                    }
                  }}
                  services={formState.serviceList.filter(Service.isNonRelease)}
                  defaultExpanded={true}
                  addNewText={"Add a new service"}
                />
              </>,
              <>
                <Text size={16}>Environment variables (optional)</Text>
                <Spacer y={0.5} />
                <Text color="helper">
                  Specify environment variables shared among all services.
                </Text>
                <EnvGroupArray
                  values={formState.envVariables}
                  setValues={(x: any) => {
                    setFormState({ ...formState, envVariables: x });
                  }}
                  fileUpload={true}
                />
              </>,
              formState.selectedSourceType == "github" &&
              <>
                <Text size={16}>Pre-deploy job (optional)</Text>
                <Spacer y={0.5} />
                <Text color="helper">
                  You may add a pre-deploy job to
                  perform an operation before your application services
                  deploy each time, like a database migration.
                </Text>
                <Spacer y={0.5} />
                <Services
                  setServices={(release: Service[]) => {
                    const nonRelease = formState.serviceList.filter(Service.isNonRelease)
                    setFormState({ ...formState, serviceList: [...nonRelease, ...release] });
                  }}
                  services={formState.serviceList.filter(Service.isRelease)}
                  defaultExpanded={true}
                  limitOne={true}
                  addNewText={"Add a new pre-deploy job"}
                  prePopulateService={Service.default("pre-deploy", "release", porterJsonWithPath?.porterJson)}
                />
              </>,
              <Button
                onClick={() => {
                  if (porterApp.image_repo_uri) {
                    deployPorterApp();
                  } else {
                    setDeploymentError(undefined);
                    setShowGHAModal(true);
                  }
                }}
                status={
                  deploying ? (
                    "loading"
                  ) : deploymentError ? (
                    <Error message={deploymentError} />
                  ) : undefined
                }
                loadingText={"Deploying..."}
                width={"120px"}
              >
                Deploy app
              </Button>,
            ].filter((x) => x)}
          />
          <Spacer y={3} />
        </StyledConfigureTemplate>
      </Div>
      {showGHAModal && currentCluster != null && currentProject != null && (
        <GithubActionModal
          closeModal={() => setShowGHAModal(false)}
          githubAppInstallationID={porterApp.git_repo_id}
          githubRepoOwner={porterApp.repo_name.split("/")[0]}
          githubRepoName={porterApp.repo_name.split("/")[1]}
          branch={porterApp.git_branch}
          stackName={porterApp.name}
          projectId={currentProject.id}
          clusterId={currentCluster.id}
          deployPorterApp={deployPorterApp}
          deploymentError={deploymentError}
          porterYamlPath={porterJsonWithPath?.porterYamlPath}
        />
      )}
    </CenterWrapper>
  );
};

export default withRouter(NewAppFlow);

const I = styled.i`
  font-size: 18px;
  margin-right: 5px;
`;

const Div = styled.div`
  width: 100%;
  max-width: 900px;
`;

const CenterWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const DarkMatter = styled.div`
  width: 100%;
  margin-top: -5px;
`;

const Icon = styled.img`
  margin-right: 15px;
  height: 28px;
  animation: floatIn 0.5s;
  animation-fill-mode: forwards;

  @keyframes floatIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0px);
    }
  }
`;

const AppearingDiv = styled.div<{ color?: string }>`
  animation: floatIn 0.5s;
  animation-fill-mode: forwards;
  display: flex;
  align-items: center;
  color: ${(props) => props.color || "#ffffff44"};
  margin-left: 10px;
  @keyframes floatIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0px);
    }
  }
`;

const StyledConfigureTemplate = styled.div`
  height: 100%;
`;


