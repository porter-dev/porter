import React, { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";
import { Link, useHistory } from "react-router-dom";
import styled from "styled-components";
import { match } from "ts-pattern";

import Button from "components/porter/Button";
import Container from "components/porter/Container";
import Error from "components/porter/Error";
import Icon from "components/porter/Icon";
import Spacer from "components/porter/Spacer";
import Text from "components/porter/Text";
import { useLatestRevision } from "main/home/app-dashboard/app-view/LatestRevisionContext";
import Logs from "main/home/app-dashboard/validate-apply/logs/Logs";
import { type JobRun } from "lib/hooks/useJobs";

import api from "shared/api";
import { readableDate } from "shared/string_utils";
import cancel from "assets/cancel.svg";
import loading from "assets/loading.gif";

import { AppearingView } from "../../app-view/tabs/activity-feed/events/focus-views/EventFocusView";
import { getStatusColor } from "../../app-view/tabs/activity-feed/events/utils";
import { getDuration } from "./utils";

type Props = {
  jobRun: JobRun;
};

const JobRunDetails: React.FC<Props> = ({ jobRun }) => {
  const queryClient = useQueryClient();
  const { projectId, clusterId, latestProto, deploymentTarget, porterApp } =
    useLatestRevision();
  const history = useHistory();
  const [jobRunCancelling, setJobRunCancelling] = useState<boolean>(false);
  const [jobRunCancelError, setJobRunCancelError] = useState<string>("");

  const appName = latestProto.name;

  const renderHeaderText = (): JSX.Element => {
    return match(jobRun)
      .with({ status: "SUCCESSFUL" }, () => (
        <Text color={getStatusColor("SUCCESS")} size={16}>
          Job run succeeded
        </Text>
      ))
      .with({ status: "FAILED" }, () => (
        <Text color={getStatusColor("FAILED")} size={16}>
          Job run failed
        </Text>
      ))
      .with({ status: "CANCELED" }, () => (
        <Text color={getStatusColor("CANCELED")} size={16}>
          Job run canceled
        </Text>
      ))
      .otherwise(() => (
        <Container row>
          <Icon height="16px" src={loading} />
          <Spacer inline width="10px" />
          <Text size={16} color={getStatusColor("PROGRESSING")}>
            Job run in progress...
          </Text>
        </Container>
      ));
  };

  const cancelRun = useCallback(async () => {
    try {
      setJobRunCancelling(true);
      setJobRunCancelError("");

      await api.cancelJob(
        "<token>",
        {
          deployment_target_id: deploymentTarget.id,
        },
        {
          project_id: projectId,
          cluster_id: clusterId,
          porter_app_name: appName,
          job_run_name: jobRun.name,
        }
      );

      await queryClient.invalidateQueries([
        "jobRuns",
        appName,
        deploymentTarget.id,
        jobRun.name,
      ]);

      history.push(
        `/apps/${appName}/job-history?service=${jobRun.service_name}`
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setJobRunCancelError(err.message);
      } else {
        setJobRunCancelError("An error occurred while canceling the job run.");
      }
    } finally {
      setJobRunCancelling(false);
    }
  }, [jobRun.name, deploymentTarget.id, projectId, clusterId, appName]);

  const renderDurationText = (): JSX.Element => {
    return match(jobRun)
      .with({ status: "SUCCESSFUL" }, () => (
        <Text color="helper">
          Started {readableDate(jobRun.created_at)} and ran for{" "}
          {getDuration(jobRun)}.
        </Text>
      ))
      .with({ status: "FAILED" }, () => (
        <Text color="helper">
          Started {readableDate(jobRun.created_at)} and ran for{" "}
          {getDuration(jobRun)}.
        </Text>
      ))
      .otherwise(() => (
        <Text color="helper">Started {readableDate(jobRun.created_at)}.</Text>
      ));
  };

  return (
    <>
      <Container row spaced>
        <Link
          to={
            deploymentTarget.is_preview
              ? `/preview-environments/apps/${latestProto.name}/job-history?service=${jobRun.service_name}&target=${deploymentTarget.id}`
              : `/apps/${latestProto.name}/job-history?service=${jobRun.service_name}`
          }
        >
          <BackButton>
            <i className="material-icons">keyboard_backspace</i>
            Job run history
          </BackButton>
        </Link>
        {jobRun.status === "RUNNING" && (
          <Button
            color="red"
            onClick={() => {
              void cancelRun();
            }}
            disabled={jobRunCancelling}
            status={
              jobRunCancelling ? (
                "loading"
              ) : jobRunCancelError ? (
                <Error message={jobRunCancelError} />
              ) : (
                ""
              )
            }
          >
            <Icon src={cancel} height={"15px"} />
            <Spacer inline x={0.5} />
            Cancel Run
          </Button>
        )}
      </Container>
      <Spacer y={0.5} />
      <AppearingView>{renderHeaderText()}</AppearingView>
      <Spacer y={0.5} />
      {renderDurationText()}
      <Spacer y={0.5} />
      <Logs
        projectId={projectId}
        clusterId={clusterId}
        appName={appName}
        serviceNames={[jobRun.service_name]}
        deploymentTargetId={deploymentTarget.id}
        appRevisionId={jobRun.app_revision_id}
        logFilterNames={["service_name"]}
        timeRange={{
          startTime: dayjs(jobRun.created_at).subtract(30, "second"),
          endTime:
            new Date(jobRun.finished_at) > new Date(jobRun.created_at)
              ? dayjs(jobRun.finished_at).add(30, "second")
              : undefined,
        }}
        appId={porterApp.id}
        defaultLatestRevision={false}
        jobRunName={jobRun.name}
      />
    </>
  );
};

export default JobRunDetails;

const BackButton = styled.div`
  display: flex;
  align-items: center;
  max-width: fit-content;
  cursor: pointer;
  font-size: 11px;
  max-height: fit-content;
  padding: 5px 13px;
  border: 1px solid #ffffff55;
  border-radius: 100px;
  color: white;
  background: #ffffff11;

  :hover {
    background: #ffffff22;
  }

  > i {
    color: white;
    font-size: 16px;
    margin-right: 6px;
  }
`;
