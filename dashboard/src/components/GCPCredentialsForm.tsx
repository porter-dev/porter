import React, { useContext, useState, useEffect } from "react";
import gcp from "assets/gcp.png";

import { Context } from "shared/Context";
import api from "shared/api";
import styled from "styled-components";
import Loading from "components/Loading";
import Placeholder from "components/OldPlaceholder";
import Helper from "components/form-components/Helper";
import UploadArea from "components/form-components/UploadArea";
import Text from "components/porter/Text";
import Button from "components/porter/Button";
import Spacer from "./porter/Spacer";
import Container from "./porter/Container";
import PreflightChecks from "./PreflightChecks";



type Props = {
  goBack: () => void;
  proceed: (id: string) => void;
};

const GCPCredentialsForm: React.FC<Props> = ({ goBack, proceed }) => {
  const { currentProject } = useContext(Context);
  const [isContinueEnabled, setIsContinueEnabled] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [serviceAccountKey, setServiceAccountKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detected, setDetected] = useState<Detected | undefined>(undefined);
  const [gcpCloudProviderCredentialID, setGCPCloudProviderCredentialId] = useState<string>("")
  const [preFlightData, setPreflightData] = useState({})
  const [preflightFailed, setPreflightFailed] = useState<boolean>(false)

  useEffect(() => {
    setDetected(undefined);
  }, []);

  useEffect(() => {

    gcpIntegration()

  }, [detected])
  interface FailureState {
    condition: boolean;
    errorMessage: string;
  }
  const failureStates: FailureState[] = [
    {
      condition: currentProject == null,
      errorMessage: "Project ID is required",
    },
  ]

  type Detected = {
    detected: boolean;
    message: string;
  };

  const gcpIntegration = async () => {
    failureStates.forEach((failureState) => {
      if (failureState.condition) {
        setErrorMessage(failureState.errorMessage);
      }
    })
    setIsLoading(true);

    try {
      const gcpIntegrationResponse = await api.createGCPIntegration(
        "<token>",
        {
          gcp_key_data: serviceAccountKey,
          gcp_project_id: projectId,
        },
        {
          project_id: currentProject.id,
        });
      if (gcpIntegrationResponse.data.cloud_provider_credentials_id == "") {
        setErrorMessage("Unable to store cluster credentials. Please try again later. If the problem persists, contact support@porter.run")
        return;
      }
      setGCPCloudProviderCredentialId(gcpIntegrationResponse.data.cloud_provider_credentials_id)
      setIsLoading(false)

      if (gcpIntegrationResponse?.data?.cloud_provider_credentials_id) {
        console.log("Will Call Preflight Checks Here")
        setIsLoading(true);

        const preflightDataResp = await api.preflightCheck(
          "<token>",
          {
            cloud_provider_credentials_id: gcpIntegrationResponse.data.cloud_provider_credentials_id,
            cloud_provider: "gcp",
          },
          {
            id: currentProject.id,
          }
        )
        setPreflightData(preflightDataResp?.data?.Msg);
        setIsLoading(false)

      }
    }
    catch (err) {
      setIsLoading(false)

      if (err.response?.data?.error) {
        setErrorMessage(err.response?.data?.error.replace("unknown: ", ""));
      } else {
        setErrorMessage("Something went wrong, please try again later.");
      }
    }

  }


  const saveCredentials = async () => {

    if (gcpCloudProviderCredentialID) {
      proceed(gcpCloudProviderCredentialID)
    }

  }

  const handleLoadJSON = (serviceAccountJSONFile: string) => {
    setServiceAccountKey(serviceAccountJSONFile)
    const serviceAccountCredentials = JSON.parse(serviceAccountJSONFile);

    if (!serviceAccountCredentials.project_id) {
      setIsContinueEnabled(false);
      setProjectId("")
      setDetected({
        detected: false,
        message: `Invalid GCP service account credentials. No project ID detected in uploaded file. Please try again.`,
      });
      return
    }

    setProjectId(serviceAccountCredentials.project_id);
    setDetected({
      detected: true,
      message: `Your cluster will be provisioned in Google Project: ${serviceAccountCredentials.project_id}`,
    });
    setIsContinueEnabled(true);
  }



  return (
    <>
      <Container row>
        <BackButton width="140px" onClick={goBack}>
          <i className="material-icons">first_page</i>
          Select cloud
        </BackButton>
        <Spacer x={1} inline />
        <Img src={gcp} />
        Set GKE credentials
      </Container>
      <Helper>Service account credentials for GCP permissions.</Helper>
      <UploadArea
        setValue={(x: string) => handleLoadJSON(x)}
        label="🔒 GCP Key Data (JSON)"
        placeholder="Drag a GCP Service Account JSON here, or click to browse."
        width="100%"
        height="100%"
        isRequired={true}
      />

      {detected && serviceAccountKey && (<>


        <>
          <AppearingDiv color={projectId ? "#8590ff" : "#fcba03"}>
            {detected.detected ? (
              <>
                <I className="material-icons">check</I>
              </>
            ) : (
              <I className="material-icons">error</I>
            )}

            <Text color={detected.detected ? "#8590ff" : "#fcba03"}>
              {detected.message}
            </Text>
          </AppearingDiv>
          <Spacer y={1} />
          {isLoading ?
            <>
              <Placeholder>
                <Loading />
              </Placeholder>

            </>
            :
            <PreflightChecks preflightData={preFlightData} setPreflightFailed={setPreflightFailed} />
          }
        </>
      </>
      )}

      <Spacer y={0.5} />
      <Button
        disabled={!isContinueEnabled || preflightFailed || isLoading}
        onClick={saveCredentials}
      >Continue</Button>

    </>
  );
};


export default GCPCredentialsForm;

const BackButton = styled.div`
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-size: 13px;
      height: 35px;
      padding: 5px 13px;
      padding-right: 15px;
      border: 1px solid #ffffff55;
      border-radius: 100px;
      width: ${(props: { width: string }) => props.width};
      color: white;
      background: #ffffff11;

      :hover {
        background: #ffffff22;
  }

  > i {
        color: white;
      font-size: 16px;
      margin-right: 6px;
      margin-left: -2px;
  }
      `;

const HelperButton = styled.div`
      cursor: pointer;
      display: flex;
      align-items: center;
      margin-left: 10px;
      justify-content: center;
  > i {
        color: #aaaabb;
      width: 24px;
      height: 24px;
      font-size: 20px;
      border-radius: 20px;
  }
      `;

const Img = styled.img`
      height: 18px;
      margin-right: 15px;
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

const I = styled.i`
        font-size: 18px;
        margin-right: 5px;
        `;

const StatusIcon = styled.img`
        top: 20px;
        right: 20px;
        height: 18px;
        `;