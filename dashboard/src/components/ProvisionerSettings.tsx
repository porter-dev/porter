import React, { useEffect, useState, useContext } from "react";
import styled from "styled-components";
import { RouteComponentProps, withRouter } from "react-router";

import { OFState } from "main/home/onboarding/state";
import api from "shared/api";
import { Context } from "shared/Context";
import { pushFiltered } from "shared/routing";

import SelectRow from "components/form-components/SelectRow";
import Heading from "components/form-components/Heading";
import Helper from "components/form-components/Helper";
import InputRow from "./form-components/InputRow";
import SaveButton from "./SaveButton";
import { Contract, EnumKubernetesKind, EnumCloudProvider, NodeGroupType, EKSNodeGroup, EKS, Cluster } from "@porter-dev/api-contracts";
import { ClusterType } from "shared/types";

const regionOptions = [
  { value: "us-east-1", label: "US East (N. Virginia) us-east-1" },
  { value: "us-east-2", label: "US East (Ohio) us-east-2" },
  { value: "us-west-1", label: "US West (N. California) us-west-1" },
  { value: "us-west-2", label: "US West (Oregon) us-west-2" },
  { value: "af-south-1", label: "Africa (Cape Town) af-south-1" },
  { value: "ap-east-1", label: "Asia Pacific (Hong Kong) ap-east-1" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai) ap-south-1" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul) ap-northeast-2" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore) ap-southeast-1" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney) ap-southeast-2" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo) ap-northeast-1" },
  { value: "ca-central-1", label: "Canada (Central) ca-central-1" },
  { value: "eu-central-1", label: "Europe (Frankfurt) eu-central-1" },
  { value: "eu-west-1", label: "Europe (Ireland) eu-west-1" },
  { value: "eu-west-2", label: "Europe (London) eu-west-2" },
  { value: "eu-south-1", label: "Europe (Milan) eu-south-1" },
  { value: "eu-west-3", label: "Europe (Paris) eu-west-3" },
  { value: "eu-north-1", label: "Europe (Stockholm) eu-north-1" },
  { value: "me-south-1", label: "Middle East (Bahrain) me-south-1" },
  { value: "sa-east-1", label: "South America (São Paulo) sa-east-1" },
];

const machineTypeOptions = [
  { value: "t3.medium", label: "t3.medium" },
  { value: "t3.large", label: "t3.large" },
  { value: "t3.xlarge", label: "t3.xlarge" },
  { value: "t3.2xlarge", label: "t3.2xlarge" },
];

const clusterVersionOptions = [
  { value: "v1.24.0", label: "1.24.0" },
  { value: "v1.25.0", label: "1.25.0" },
];

type Props = RouteComponentProps & {
  selectedClusterVersion?: Contract;
  credentialId: string;
  AWSAccountID: string;
  clusterId?: number;
};

const ProvisionerSettings: React.FC<Props> = props => {
  const {
    user,
    currentProject,
    currentCluster,
    setCurrentCluster,
    setShouldRefreshClusters,
    setHasFinishedOnboarding,
  } = useContext(Context);
  const [createStatus, setCreateStatus] = useState("");
  const [clusterName, setClusterName] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [machineType, setMachineType] = useState("t3.xlarge");
  const [isExpanded, setIsExpanded] = useState(false);
  const [minInstances, setMinInstances] = useState(1);
  const [maxInstances, setMaxInstances] = useState(10);
  const [cidrRange, setCidrRange] = useState("172.0.0.0/16");
  const [clusterVersion, setClusterVersion] = useState("v1.24.0");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>(undefined);

  const createCluster = async () => {
    var data = new Contract({
      cluster: new Cluster({
        projectId: currentProject.id,
        kind: EnumKubernetesKind.EKS,
        cloudProvider: EnumCloudProvider.AWS,
        cloudProviderCredentialsId: String(props.credentialId),
        kindValues: {
          case: "eksKind",
          value: new EKS({
            clusterName,
            clusterVersion: clusterVersion || "v1.24.0",
            cidrRange: cidrRange || "172.0.0.0/16",
            region: awsRegion,
            nodeGroups: [
              new EKSNodeGroup({
                instanceType: "t3.medium",
                minInstances: 1,
                maxInstances: 5,
                nodeGroupType: NodeGroupType.SYSTEM,
                isStateful: false,
              }),
              new EKSNodeGroup({
                instanceType: "t3.large",
                minInstances: 1,
                maxInstances: 5,
                nodeGroupType: NodeGroupType.MONITORING,
                isStateful: false,
              }),
              new EKSNodeGroup({
                instanceType: machineType,
                minInstances: minInstances || 1,
                maxInstances: maxInstances || 10,
                nodeGroupType: NodeGroupType.APPLICATION,
                isStateful: false,
              })
            ]
          })
        },
      })
    });

    if (props.clusterId) {
      data["cluster"]["clusterId"] = props.clusterId;
    }

    try {
      await api
        .preflightCheckAWSUsage(
          "<token>",
          {
            target_arn: `arn:aws:iam::${props.AWSAccountID}:role/porter-role`,
            region: awsRegion
          },
          {
            id: currentProject.id,
          }
        );

      const res = await api.createContract(
        "<token>",
        data,
        { project_id: currentProject.id }
      );

      // Only refresh and set clusters on initial create
      if (!props.clusterId) {
        setShouldRefreshClusters(true);
        api.getClusters(
          "<token>",
          {},
          { id: currentProject.id },
        )
          .then(({ data }) => {
            data.forEach((cluster: ClusterType) => {
              if (cluster.id === res.data.contract_revision?.cluster_id) {
                // setHasFinishedOnboarding(true);
                setCurrentCluster(cluster);
                OFState.actions.goTo("clean_up");
                pushFiltered(props, "/cluster-dashboard", ["project_id"], {
                  cluster: cluster.name,
                });
              }
            });
          })
          .catch((err) => {
            console.error(err);
          });
      }
      setErrorMessage(undefined);
    } catch (err) {
      setErrorMessage(err.response.data.error.replace('unknown: ', ''));
    }
  }

  useEffect(() => {
    setIsReadOnly(
      props.clusterId && (
        currentCluster.status === "UPDATING" ||
        currentCluster.status === "UPDATING_UNAVAILABLE"
      )
    );
  }, []);

  useEffect(() => {
    const contract = props.selectedClusterVersion as any;
    if (contract?.cluster) {
      contract.cluster.eksKind.nodeGroups.map((nodeGroup: any) => {
        if (nodeGroup.nodeGroupType === "NODE_GROUP_TYPE_APPLICATION") {
          setMachineType(nodeGroup.instanceType);
          setMinInstances(nodeGroup.minInstances);
          setMaxInstances(nodeGroup.maxInstances);
        }
      });
      setCreateStatus("");
      setClusterName(contract.cluster.eksKind.clusterName);
      setAwsRegion(contract.cluster.eksKind.region);
      setClusterVersion(contract.cluster.eksKind.clusterVersion);
      setCidrRange(contract.cluster.eksKind.cidrRange);
    }
  }, [props.selectedClusterVersion]);

  const renderForm = () => {

    // Render simplified form if initial create
    if (!props.clusterId) {
      return (
        <>
          <Heading isAtTop>Cluster configuration</Heading>
          <Helper>
            Porter will create a new cluster for your applications in the specified region.
          </Helper>
          <InputRow
            width="350px"
            isRequired
            disabled={isReadOnly}
            type="string"
            value={clusterName}
            setValue={(x: string) => setClusterName(x)}
            label="🏷️ Cluster name"
            placeholder="ex: total-perspective-vortex"
          />
          <SelectRow
            options={regionOptions}
            width="350px"
            disabled={isReadOnly}
            value={awsRegion}
            scrollBuffer={true}
            dropdownMaxHeight="240px"
            setActiveValue={setAwsRegion}
            label="📍 Select an AWS region"
          />
        </>
      )
    }

    // If settings, update full form
    return (
      <>
        <Heading isAtTop>EKS configuration</Heading>
        <InputRow
          width="350px"
          isRequired
          disabled={isReadOnly || true}
          type="string"
          value={clusterName}
          setValue={(x: string) => setClusterName(x)}
          label="🏷️ Cluster name"
          placeholder="ex: total-perspective-vortex"
        />
        <SelectRow
          options={regionOptions}
          width="350px"
          disabled={isReadOnly || true}
          value={awsRegion}
          scrollBuffer={true}
          dropdownMaxHeight="240px"
          setActiveValue={setAwsRegion}
          label="📍 AWS region"
        />
        {
          user?.isPorterUser && (
            <Heading>
              <ExpandHeader
                onClick={() => setIsExpanded(!isExpanded)}
                isExpanded={isExpanded}
              >
                <i className="material-icons">arrow_drop_down</i>
                Advanced settings
              </ExpandHeader>
            </Heading>
          )
        }
        {
          isExpanded && (
            <>
              <SelectRow
                options={clusterVersionOptions}
                width="350px"
                disabled={isReadOnly}
                value={clusterVersion}
                scrollBuffer={true}
                dropdownMaxHeight="240px"
                setActiveValue={setClusterVersion}
                label="Cluster version"
              />
              <SelectRow
                options={machineTypeOptions}
                width="350px"
                disabled={isReadOnly}
                value={machineType}
                scrollBuffer={true}
                dropdownMaxHeight="240px"
                setActiveValue={setMachineType}
                label="Machine type"
              />
              <InputRow
                width="350px"
                type="number"
                disabled={isReadOnly}
                value={maxInstances}
                setValue={(x: number) => setMaxInstances(x)}
                label="Maximum number of application EC2 instances"
                placeholder="ex: 1"
              />
              <InputRow
                width="350px"
                type="string"
                disabled={isReadOnly}
                value={cidrRange}
                setValue={(x: string) => setCidrRange(x)}
                label="VPC CIDR range"
                placeholder="ex: 172.0.0.0/16"
              />
            </>
          )
        }
      </>
    )
  }

  return (
    <>
      <StyledForm>
        {renderForm()}
      </StyledForm>
      <SaveButton
        disabled={(!clusterName && true) || isReadOnly}
        onClick={createCluster}
        clearPosition
        text="Provision"
        statusPosition="right"
        status={isReadOnly && "Provisioning is still in progress"}
      />
      {errorMessage && <ErrorContainer>{errorMessage} Please correct the issue and try to provision again.</ErrorContainer>}
    </>
  );
};

export default withRouter(ProvisionerSettings);

const ExpandHeader = styled.div<{ isExpanded: boolean }>`
  display: flex;
  align-items: center;
  cursor: pointer;
  > i {
    margin-right: 7px;
    margin-left: -7px;
    transform: ${(props) => props.isExpanded ? "rotate(0deg)" : "rotate(-90deg)"};
  }
`;

const StyledForm = styled.div`
  position: relative;
  padding: 30px 30px 25px;
  border-radius: 5px;
  background: #26292e;
  border: 1px solid #494b4f;
  font-size: 13px;
  margin-bottom: 30px;
`;

const ErrorContainer = styled.div`
  position: relative;
  margin-top: 20px;
  padding: 30px 30px 25px;
  border-radius: 5px;
  background: #26292e;
  border: 1px solid #494b4f;
  font-size: 13px;
  margin-bottom: 30px;
  color: red;
`