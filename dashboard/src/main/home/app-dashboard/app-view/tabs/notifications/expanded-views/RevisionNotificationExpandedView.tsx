import React, { useMemo } from "react";
import { PorterApp } from "@porter-dev/api-contracts";
import styled from "styled-components";

import Button from "components/porter/Button";
import Container from "components/porter/Container";
import Spacer from "components/porter/Spacer";
import Text from "components/porter/Text";
import { useIntercom } from "lib/hooks/useIntercom";
import { useRevisionList } from "lib/hooks/useRevisionList";
import { clientAppFromProto } from "lib/porter-apps";
import { ERROR_CODE_TO_SUMMARY } from "lib/porter-apps/error";
import {
  deserializeNotifications,
  isClientServiceNotification,
  type ClientRevisionNotification,
} from "lib/porter-apps/notification";

import { feedDate } from "shared/string_utils";
import { valueExists } from "shared/util";
import chat from "assets/chat.svg";
import document from "assets/document.svg";
import time from "assets/time.svg";

import { useLatestRevision } from "../../../LatestRevisionContext";
import {
  isRevisionNotification,
  isServiceNotification,
} from "../../activity-feed/events/types";
import ServiceMessage from "./messages/ServiceMessage";
import {
  ExpandedViewContent,
  Message,
  NotificationWrapper,
  StyledMessageFeed,
  StyledNotificationExpandedView,
} from "./NotificationExpandedView";

type Props = {
  notification: ClientRevisionNotification;
  projectId: number;
  appName: string;
  deploymentTargetId: string;
  clusterId: number;
  appId: number;
};

const RevisionNotificationExpandedView: React.FC<Props> = ({
  notification,
  projectId,
  appName,
  deploymentTargetId,
  clusterId,
  appId,
}) => {
  const { showIntercomWithMessage } = useIntercom();

  const summary = useMemo(() => {
    return notification.messages.length &&
      ERROR_CODE_TO_SUMMARY[notification.messages[0].error.code]
      ? ERROR_CODE_TO_SUMMARY[notification.messages[0].error.code]
      : "The latest version failed to deploy";
  }, [JSON.stringify(notification)]);

  const { revisionList } = useRevisionList({
    appName,
    deploymentTargetId,
    projectId,
    clusterId,
  });

  const { latestPorterAppNotifications } = useLatestRevision();

  const rollbackClientServiceNotifications = useMemo(() => {
    if (!notification.isRollbackRelated) {
      return [];
    }

    const rollbackSourceRevision = revisionList.find(
      (r) => r.id === notification.appRevisionId
    );
    if (!rollbackSourceRevision) {
      return [];
    }

    const rollbackProto = PorterApp.fromJsonString(
      atob(rollbackSourceRevision.b64_app_proto),
      {
        ignoreUnknownFields: true,
      }
    );

    const rollbackApp = clientAppFromProto({
      proto: rollbackProto,
      overrides: null,
    });
    const rollbackClientServices = [
      ...rollbackApp.services,
      rollbackApp.predeploy?.length ? rollbackApp.predeploy[0] : undefined,
    ].filter(valueExists);

    const rollbackClientNotifications = deserializeNotifications(
      latestPorterAppNotifications,
      rollbackClientServices,
      rollbackSourceRevision.id
    );

    return rollbackClientNotifications
      .filter(isClientServiceNotification)
      .filter((n) => n.isDeployRelated);
  }, [
    JSON.stringify(notification),
    JSON.stringify(revisionList),
    JSON.stringify(latestPorterAppNotifications),
  ]);

  return (
    <StyledNotificationExpandedView>
      <ExpandedViewContent>
        <Container row spaced>
          <Container row>
            <Text size={16} color={"#FFBF00"}>
              {summary}
            </Text>
          </Container>
        </Container>
        <Spacer y={0.5} />
        <StyledMessageFeed>
          {notification.messages
            .filter(isRevisionNotification)
            .map((message, i) => {
              return (
                <NotificationWrapper key={i}>
                  <Message key={i}>
                    <Container row spaced>
                      <Container row>
                        <img
                          src={document}
                          style={{ width: "15px", marginRight: "15px" }}
                        />
                        {message.error.summary}
                      </Container>
                      <Container row>
                        <img
                          src={time}
                          style={{ width: "15px", marginRight: "15px" }}
                        />
                        <Text>{feedDate(message.timestamp)}</Text>
                      </Container>
                    </Container>
                    <Spacer y={0.5} />
                    <Text>Details:</Text>
                    <Spacer y={0.25} />
                    <MessageDetailContainer>
                      {message.error.detail}
                    </MessageDetailContainer>
                    <Spacer y={0.5} />
                    <Text>Resolution steps:</Text>
                    <Spacer y={0.25} />
                    <Container row>
                      <Text color="helper">
                        {message.error.mitigation_steps}
                      </Text>
                    </Container>
                    <Spacer y={0.25} />
                    <Container row>
                      <Text color="helper">Need help troubleshooting?</Text>
                      <Spacer inline x={0.5} />
                      <Button
                        onClick={() => {
                          showIntercomWithMessage({
                            message: `I need help troubleshooting an issue with my application ${appName} in project ${projectId}.`,
                            delaySeconds: 0,
                          });
                        }}
                      >
                        <img
                          src={chat}
                          style={{ width: "15px", marginRight: "10px" }}
                        />
                        Talk to support
                      </Button>
                    </Container>
                    {message.error.documentation.length > 0 && (
                      <>
                        <Spacer y={0.5} />
                        <Text>Relevant documentation:</Text>
                        <Spacer y={0.25} />
                        <ul
                          style={{
                            paddingInlineStart: "12px",
                            marginTop: "0px",
                          }}
                        >
                          {message.error.documentation.map((doc, i) => {
                            return (
                              <li key={i}>
                                <a href={doc} target="_blank" rel="noreferrer">
                                  {doc}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </Message>
                </NotificationWrapper>
              );
            })}
        </StyledMessageFeed>
        <Spacer y={1} />
        {rollbackClientServiceNotifications.map((notification) => (
          <div key={notification.id}>
            <Spacer y={0.5} />
            <StyledMessageFeed>
              {notification.messages
                .filter(isServiceNotification)
                .map((message, i) => (
                  <ServiceMessage
                    key={i}
                    isFirst={i === 0}
                    message={message}
                    service={notification.service}
                    projectId={projectId}
                    clusterId={clusterId}
                    appName={appName}
                    deploymentTargetId={deploymentTargetId}
                    appId={appId}
                    appRevisionId={notification.appRevisionId}
                    showLiveLogs={false} // do not show live logs because the deployment is already rolled back
                    includeServiceNameHeader={true}
                  />
                ))}
            </StyledMessageFeed>
          </div>
        ))}
      </ExpandedViewContent>
    </StyledNotificationExpandedView>
  );
};

export default RevisionNotificationExpandedView;

const MessageDetailContainer = styled.div`
  background: #000000;
  border-radius: 5px;
  padding: 10px;
  display: flex;
  width: 100%;
  border-radius: 5px;
  border: 1px solid ${({ theme }) => theme.border};
  align-items: center;
  font-family: monospace;
`;
