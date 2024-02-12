import React, { createContext, useCallback, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";

import Loading from "components/Loading";
import Container from "components/porter/Container";
import Link from "components/porter/Link";
import Spacer from "components/porter/Spacer";
import Text from "components/porter/Text";
import { type ClientCluster } from "lib/clusters/types";
import { useCluster } from "lib/hooks/useCluster";

import api from "shared/api";
import { Context } from "shared/Context";
import notFound from "assets/not-found.png";

type ClusterContextType = {
  cluster: ClientCluster;
  projectId: number;
  updateClusterVanityName: (name: string) => void;
};

const ClusterContext = createContext<ClusterContextType | null>(null);

export const useClusterContext = (): ClusterContextType => {
  const ctx = React.useContext(ClusterContext);
  if (!ctx) {
    throw new Error(
      "useClusterContext must be used within a ClusterContextProvider"
    );
  }
  return ctx;
};

type ClusterContextProviderProps = {
  clusterId?: number;
  children: JSX.Element;
};

const ClusterContextProvider: React.FC<ClusterContextProviderProps> = ({
  clusterId,
  children,
}) => {
  const { currentProject } = useContext(Context);
  const paramsExist =
    !!clusterId && !!currentProject && currentProject.id !== -1;
  const { cluster, isLoading, isError } = useCluster({
    clusterId,
    refetchInterval: 3000,
  });
  const queryClient = useQueryClient();
  const updateClusterVanityName = useCallback(
    async (name: string) => {
      if (!paramsExist) {
        return;
      }
      await api.renameCluster(
        "<token",
        { name },
        {
          project_id: currentProject.id,
          cluster_id: clusterId,
        }
      );

      await queryClient.invalidateQueries(["getCluster"]);
    },
    [paramsExist, clusterId]
  );

  if (isLoading || !paramsExist) {
    return <Loading />;
  }

  if (isError) {
    return (
      <Placeholder>
        <Container row>
          <PlaceholderIcon src={notFound} />
          <Text color="helper">
            Unable to load configuration for the provided cluster.
          </Text>
        </Container>
        <Spacer y={1} />
        <Link to="/infrastructure">Return to dashboard</Link>
      </Placeholder>
    );
  }

  if (!cluster) {
    return (
      <Placeholder>
        <Container row>
          <PlaceholderIcon src={notFound} />
          <Text color="helper">
            No cluster matching the provided ID was found.
          </Text>
        </Container>
        <Spacer y={1} />
        <Link to="/infrastructure">Return to dashboard</Link>
      </Placeholder>
    );
  }

  return (
    <ClusterContext.Provider
      value={{
        cluster,
        projectId: currentProject.id,
        updateClusterVanityName,
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
};

export default ClusterContextProvider;

const PlaceholderIcon = styled.img`
  height: 13px;
  margin-right: 12px;
  opacity: 0.65;
`;
const Placeholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 13px;
`;