import React, { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { type Column } from "react-table";
import styled from "styled-components";
import { match } from "ts-pattern";

import SelectRow from "components/form-components/SelectRow";
import Table from "components/OldTable";
import Container from "components/porter/Container";
import Link from "components/porter/Link";
import Spacer from "components/porter/Spacer";
import Text from "components/porter/Text";
import { useJobs, type JobRun } from "lib/hooks/useJobs";

import { relativeDate } from "shared/string_utils";
import history from "assets/history.png";

import { useLatestRevision } from "../../app-view/LatestRevisionContext";
import { getStatusColor } from "../../app-view/tabs/activity-feed/events/utils";
import JobRunDetails from "./JobRunDetails";
import TriggerJobButton from "./TriggerJobButton";
import { ranFor } from "./utils";

type Props = {
  appName: string;
  projectId: number;
  clusterId: number;
  deploymentTargetId: string;
  jobNames: string[];
};

const JobsSection: React.FC<Props> = ({
  appName,
  projectId,
  clusterId,
  deploymentTargetId,
  jobNames,
}) => {
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const serviceFromQueryParams = queryParams.get("service");
  const jobRunName = queryParams.get("job_run_name");
  const [selectedJobName, setSelectedJobName] = useState<string>(
    serviceFromQueryParams != null && jobNames.includes(serviceFromQueryParams)
      ? serviceFromQueryParams
      : "all"
  );
  const { deploymentTarget } = useLatestRevision();

  const jobOptions = useMemo(() => {
    return [
      { label: "All jobs", value: "all" },
      ...jobNames.map((name) => {
        return {
          label: name,
          value: name,
        };
      }),
    ];
  }, [jobNames]);

  const { jobRuns, isLoadingJobRuns } = useJobs({
    appName,
    projectId,
    clusterId,
    deploymentTargetId,
    selectedJobName,
  });

  const selectedJobRun = useMemo(() => {
    return jobRuns.find((jr) => jr.name === jobRunName);
  }, [jobRuns, jobRunName]);

  const columns = useMemo<Array<Column<JobRun>>>(
    () => [
      {
        Header: "Started",
        accessor: (originalRow) => relativeDate(originalRow.created_at),
      },
      {
        Header: "Run for",
        Cell: (cell) => {
          const { original: row } = cell.row;
          let ranForString = "Still running...";
          const startedTime = new Date(row.created_at);
          const finishedTime = new Date(row.finished_at);

          if (finishedTime > startedTime) {
            ranForString = ranFor(row.created_at, row.finished_at);
          }

          return <div>{ranForString}</div>;
        },
      },
      {
        Header: "Name",
        id: "job_name",
        Cell: (cell) => {
          const { original: row } = cell.row;

          return <div>{row.service_name}</div>;
        },
      },
      {
        Header: "Version",
        id: "version_number",
        Cell: (cell) => {
          const { original: row } = cell.row;

          return <div>{row.revisionNumber}</div>;
        },
        maxWidth: 100,
        styles: {
          padding: "10px",
        },
      },
      {
        Header: "Status",
        id: "status",
        Cell: (cell) => {
          const { original: row } = cell.row;

          return match(row.status)
            .with("SUCCESSFUL", () => (
              <Status color="#38a88a">Succeeded</Status>
            ))
            .with("FAILED", () => <Status color="#cc3d42">Failed</Status>)
            .with("CANCELED", () => (
              <Status color={getStatusColor(row.status)}>Canceled</Status>
            ))
            .otherwise(() => <Status color="#ffffff11">Running</Status>);
        },
      },

      {
        Header: "Details",
        id: "expand",
        Cell: (cell) => {
          const { original: row } = cell.row;

          return (
            <Link
              to={
                deploymentTarget.is_preview
                  ? `/preview-environments/apps/${appName}/job-history?job_run_name=${row.name}&service=${row.service_name}&target=${deploymentTargetId}`
                  : `/apps/${appName}/job-history?job_run_name=${row.name}&service=${row.service_name}`
              }
            >
              <ExpandButton>
                <i className="material-icons">open_in_new</i>
              </ExpandButton>
            </Link>
          );
        },
        maxWidth: 40,
      },
    ],
    []
  );

  return (
    <>
      {selectedJobRun && <JobRunDetails jobRun={selectedJobRun} />}
      {!selectedJobRun && (
        <StyledExpandedApp>
          <Container row spaced>
            <Container row>
              <Icon src={history} />
              <Text size={21}>Run history for</Text>
              <SelectRow
                displayFlex={true}
                label=""
                value={selectedJobName}
                setActiveValue={(x: string) => {
                  setSelectedJobName(x);
                }}
                options={jobOptions}
                width="200px"
              />
            </Container>
            {selectedJobName !== "all" && (
              <TriggerJobButton
                projectId={projectId}
                clusterId={clusterId}
                appName={appName}
                jobName={selectedJobName}
                deploymentTargetId={deploymentTargetId}
              />
            )}
          </Container>
          <Spacer y={1} />
          <Table
            columns={columns}
            disableGlobalFilter
            data={jobRuns.sort((a, b) => {
              return Date.parse(a.created_at) > Date.parse(b.created_at)
                ? -1
                : 1;
            })}
            isLoading={isLoadingJobRuns}
            enablePagination
          />
        </StyledExpandedApp>
      )}
    </>
  );
};

export default JobsSection;

const Icon = styled.img`
  height: 24px;
  margin-right: 15px;
`;

const StyledExpandedApp = styled.div`
  width: 100%;
  height: 100%;

  animation: fadeIn 0.5s 0s;
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const Status = styled.div<{ color: string }>`
  padding: 5px 10px;
  background: ${(props) => props.color};
  font-size: 13px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min-content;
  height: 25px;
  min-width: 90px;
`;

const ExpandButton = styled.div`
  user-select: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  > i {
    border-radius: 20px;
    font-size: 18px;
    padding: 5px;
    margin: 5px 5px;
    :hover {
      background: #ffffff11;
    }
  }
`;
