import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import _ from "lodash";
import { z } from "zod";

import api from "shared/api";

import { useRevisionList } from "./useRevisionList";

const jobRunValidator = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["RUNNING", "SUCCESSFUL", "FAILED", "CANCELED"]),
  created_at: z.string(),
  finished_at: z.string(),
  app_revision_id: z.string(),
  service_name: z.string(),
});

export type JobRun = z.infer<typeof jobRunValidator> & {
  revisionNumber: number;
};

export const useJobs = ({
  appName,
  projectId,
  clusterId,
  deploymentTargetId,
  selectedJobName,
}: {
  appName: string;
  projectId: number;
  clusterId: number;
  deploymentTargetId: string;
  selectedJobName: string;
}): {
  jobRuns: JobRun[];
  isLoadingJobRuns: boolean;
} => {
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);

  const { revisionIdToNumber } = useRevisionList({
    appName,
    deploymentTargetId,
    projectId,
    clusterId,
  });

  const { data, isLoading: isLoadingJobRuns } = useQuery(
    ["jobRuns", appName, deploymentTargetId, selectedJobName],
    async () => {
      const res = await api.appJobs(
        "<token>",
        {
          deployment_target_id: deploymentTargetId,
          job_name: selectedJobName === "all" ? "" : selectedJobName,
        },
        {
          project_id: projectId,
          cluster_id: clusterId,
          porter_app_name: appName,
        }
      );
      const { job_runs: runs } = await z
        .object({
          job_runs: z.array(jobRunValidator),
        })
        .parseAsync(res.data);

      const parsedWithRevision = runs.map((jobRun) => {
        const revisionId = jobRun.app_revision_id;
        const revisionNumber = revisionIdToNumber[revisionId];
        return {
          ...jobRun,
          revisionNumber,
        };
      });
      return parsedWithRevision;
    },
    {
      enabled: revisionIdToNumber != null,
      refetchInterval: 5000,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (data != null) {
      setJobRuns(data);
    }
  }, [data]);

  return {
    jobRuns,
    isLoadingJobRuns,
  };
};
