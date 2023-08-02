import React, { useState } from "react";


import deploy from "assets/deploy.png";
import document from "assets/document.svg";

import Text from "components/porter/Text";
import Container from "components/porter/Container";
import Spacer from "components/porter/Spacer";
import Icon from "components/porter/Icon";
import { getStatusIcon } from '../utils';
import { StyledEventCard } from "./EventCard";
import styled from "styled-components";
import Link from "components/porter/Link";
import ChangeLogModal from "../../../ChangeLogModal";
import { PorterAppDeployEvent } from "../types";
import AnimateHeight from "react-animate-height";

type Props = {
  event: PorterAppDeployEvent;
  appData: any;
};

const DeployEventCard: React.FC<Props> = ({ event, appData }) => {
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [revertModalVisible, setRevertModalVisible] = useState(false);
  const [serviceStatusVisible, setServiceStatusVisible] = useState(false);

  const renderStatusText = () => {
    switch (event.status) {
      case "SUCCESS":
        return event.metadata.image_tag != null ?
          event.metadata.service_status != null ?
            <StatusTextContainer>
              <Text color="#68BF8B">
                Deployed <Code>{event.metadata.image_tag}</Code> to
              </Text>
              <Spacer inline x={0.25} />
              {renderServiceDropdownCta(Object.keys(event.metadata.service_status).length, "#68BF8B")}
            </StatusTextContainer>
            :
            <Text color="#68BF8B">
              Deployed <Code>{event.metadata.image_tag}</Code>
            </Text>
          :
          <Text color="#68BF8B">
            Deployment successful
          </Text>;
      case "FAILED":
        if (event.metadata.service_status != null) {
          let failedServices = 0;
          for (const key in event.metadata.service_status) {
            if (event.metadata.service_status[key] === "FAILED") {
              failedServices++;
            }
          }
          return (
            <StatusTextContainer>
              <Text color="#FF6060">
                Failed to deploy <Code>{event.metadata.image_tag}</Code> to
              </Text>
              <Spacer inline x={0.25} />
              {renderServiceDropdownCta(failedServices, "#FF6060")}
            </StatusTextContainer>
          );
        } else {
          return (
            <Text color="#FF6060">
              Deployment failed
            </Text>
          );
        }
      case "CANCELED":
        if (event.metadata.service_status != null) {
          let canceledServices = 0;
          for (const key in event.metadata.service_status) {
            if (event.metadata.service_status[key] === "CANCELED") {
              canceledServices++;
            }
          }
          return (
            <StatusTextContainer>
              <Text color="#FFBF00">
                Canceled deploy of <Code>{event.metadata.image_tag}</Code> to
              </Text>
              <Spacer inline x={0.25} />
              {renderServiceDropdownCta(canceledServices, "#FFBF00")}
            </StatusTextContainer>
          );
        } else {
          return (
            <Text color="#FFBF00">
              Deployment canceled
            </Text>
          );
        }
      default:
        if (event.metadata.service_status != null) {
          return (
            <StatusTextContainer>
              <Text color="helper">
                Deploying <Code>{event.metadata.image_tag}</Code> to
              </Text>
              <Spacer inline x={0.25} />
              {renderServiceDropdownCta(Object.keys(event.metadata.service_status).length)}
            </StatusTextContainer>
          );
        } else {
          return (
            <Text color="helper">
              Deploying <Code>{event.metadata.image_tag}</Code>...
            </Text>
          );
        }
    }
  };

  const renderServiceStatus = () => {
    const serviceStatus = event.metadata.service_status;
    if (Object.keys(serviceStatus).length === 0) {
      return (
        <Container row>
          <Text color="helper">No services found.</Text>
        </Container>
      );
    }

    return <ServiceStatusesContainer>
      {Object.keys(serviceStatus).map((key) => {
        return (
          <Container key={key} row>
            <Spacer inline x={1} />
            <Container row>
              <ServiceStatusContainer>
                <Text>{key}</Text>
              </ServiceStatusContainer>
              <Spacer inline x={1} />
              <ServiceStatusContainer>
                <Icon height="12px" src={getStatusIcon(serviceStatus[key])} />
                <Spacer inline x={0.5} />
                <Text color="helper">{serviceStatus[key] === "PROGRESSING" ? "DEPLOYING" : serviceStatus[key]}</Text>
              </ServiceStatusContainer>
              <Spacer inline x={1} />
              <ServiceStatusContainer>
                <Link
                  to={`/apps/${appData.app.name}/logs?version=${event.metadata.revision}&service=${key}`}
                >
                  <Icon height="12px" src={document} />
                  <Spacer inline x={0.5} />
                  Logs
                </Link>
              </ServiceStatusContainer>
            </Container>
          </Container>
        );
      })}
    </ServiceStatusesContainer>
  }

  const renderServiceDropdownCta = (numServices: number, color?: string) => {
    return (
      <ServiceStatusDropdownCtaContainer >
        <Link color={color} onClick={() => setServiceStatusVisible(!serviceStatusVisible)}>
          <ServiceStatusDropdownIcon className="material-icons" serviceStatusVisible={serviceStatusVisible}>arrow_drop_down</ServiceStatusDropdownIcon>
          {numServices} service{numServices === 1 ? "" : "s"}
        </Link>
      </ServiceStatusDropdownCtaContainer>
    )
  }

  return (
    <StyledEventCard>
      <Container row spaced>
        <Container row>
          <Icon height="16px" src={deploy} />
          <Spacer inline width="10px" />
          <Text>Application version no. {event.metadata?.revision}</Text>
        </Container>
      </Container>
      <Spacer y={0.5} />
      <Container row spaced>
        <Container row>
          <Icon height="12px" src={getStatusIcon(event.status)} />
          <Spacer inline width="10px" />
          {renderStatusText()}
          {appData?.chart?.version !== event.metadata.revision && (
            <>
              <Spacer inline x={1} />
              <TempWrapper>
                <Link hasunderline onClick={() => setRevertModalVisible(true)}>
                  Revert to version {event.metadata.revision}
                </Link>

              </TempWrapper>
            </>
          )}
          <Spacer inline x={1} />
          <TempWrapper>
            {event.metadata.revision != 1 && (<Link hasunderline onClick={() => setDiffModalVisible(true)}>
              View changes
            </Link>)}
            {diffModalVisible && (
              <ChangeLogModal
                revision={event.metadata.revision}
                currentChart={appData.chart}
                modalVisible={diffModalVisible}
                setModalVisible={setDiffModalVisible}
                appData={appData}
              />
            )}
            {revertModalVisible && (
              <ChangeLogModal
                revision={event.metadata.revision}
                currentChart={appData.chart}
                modalVisible={revertModalVisible}
                setModalVisible={setRevertModalVisible}
                revertModal={true}
                appData={appData}
              />
            )}
          </TempWrapper>
        </Container>
      </Container>
      <AnimateHeight height={serviceStatusVisible ? "auto" : 0}>
        <Spacer y={0.5} />
        {event.metadata.service_status != null && renderServiceStatus()}
      </AnimateHeight>
    </StyledEventCard>
  );
};

export default DeployEventCard;

// TODO: remove after fixing v-align
const TempWrapper = styled.div`
  margin-top: -3px;
`;

const Code = styled.span`
  font-family: monospace;
`;

const ServiceStatusContainer = styled.div`
  display: flex;
  align-items: center;  
  width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ServiceStatusesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
 `;

const ServiceStatusDropdownCtaContainer = styled.div`
  display: flex;
  justify-content: center;
  cursor: pointer;
  padding: 3px 5px;
  border-radius: 5px;
  :hover {
    background: #ffffff11;
  }
`;

const ServiceStatusDropdownIcon = styled.i`
  margin-left: -5px;
  font-size: 20px;
  border-radius: 20px;
  transform: ${(props: { serviceStatusVisible: boolean }) =>
    props.serviceStatusVisible ? "" : "rotate(-90deg)"};
  transition: transform 0.1s ease;
`

const StatusTextContainer = styled.div`
  display: flex;
  align-items: center;
  flex-direction: row;
`;
