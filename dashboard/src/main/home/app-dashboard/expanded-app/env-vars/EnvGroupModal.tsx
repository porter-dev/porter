import { RouteComponentProps, withRouter } from "react-router";
import styled, { css } from "styled-components";
import React, { useContext, useEffect, useState } from "react";
import Loading from "components/Loading";

import Modal from "components/porter/Modal";
import Text from "components/porter/Text";
import Spacer from "components/porter/Spacer";
import Button from "components/porter/Button";
import api from "shared/api";
import { getGithubAction } from "./utils";
import AceEditor from "react-ace";
import YamlEditor from "components/YamlEditor";
import Error from "components/porter/Error";
import Container from "components/porter/Container";
import Checkbox from "components/porter/Checkbox";
import { Context } from "../../../../../shared/Context";
import sliders from "assets/sliders.svg";
import { isEmpty, isObject } from "lodash";
import {
  EnvGroupData,
  formattedEnvironmentValue,
} from "../../../cluster-dashboard/env-groups/EnvGroup";
import {
  PartialEnvGroup,
  PopulatedEnvGroup,
  NewPopulatedEnvGroup,
} from "components/porter-form/types";
import { KeyValueType } from "../../../cluster-dashboard/env-groups/EnvGroupArray";
import { set } from "zod";

type Props = RouteComponentProps & {
  closeModal: () => void;
  availableEnvGroups?: PartialEnvGroup[];
  setValues: (x: KeyValueType[]) => void;
  values: KeyValueType[];
  syncedEnvGroups: NewPopulatedEnvGroup[];
  setSyncedEnvGroups: (values: NewPopulatedEnvGroup[]) => void;
  namespace: string;
  newApp?: boolean;
}

const EnvGroupModal: React.FC<Props> = ({
  closeModal,
  setValues,
  availableEnvGroups,
  syncedEnvGroups,
  setSyncedEnvGroups,
  values,
  namespace,
  newApp,
}) => {
  const { currentCluster, currentProject } = useContext(Context);
  const [envGroups, setEnvGroups] = useState<any>([])
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [shouldSync, setShouldSync] = useState<boolean>(true);
  const [selectedEnvGroup, setSelectedEnvGroup] = useState<PopulatedEnvGroup | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState(false);

  const updateEnvGroups = async () => {
    setLoading(true)
    let populateEnvGroupsPromises: any[] = [];
    try {
      populateEnvGroupsPromises = await api
        .getAllEnvGroups<any[]>(
          "<token>",
          {},
          {
            id: currentProject.id,
            cluster_id: currentCluster.id,
          }
        )
        .then((res) => res.data.environment_groups);
    } catch (error) {
      setLoading(false)
      setError(true);
      return;
    }



    try {
      const populatedEnvGroups = await Promise.all(populateEnvGroupsPromises);
      setEnvGroups(populatedEnvGroups)
      setLoading(false)

    } catch (error) {
      setLoading(false)
      setError(true);
    }
  };

  useEffect(() => {
    if (!values) {
      setValues([]);
    }
  }, [values]);

  useEffect(() => {
    if (Array.isArray(availableEnvGroups)) {
      setEnvGroups(availableEnvGroups);
      setLoading(false);
      return;
    }
    updateEnvGroups();
  }, []);

  const renderEnvGroupList = () => {
    if (loading) {
      return (
        <LoadingWrapper>
          <Loading />
        </LoadingWrapper>
      );
    } else if (!envGroups?.length) {
      return (
        <Placeholder>
          No environment groups found in this namespace
        </Placeholder>
      );
    } else {
      return envGroups
        .filter((envGroup) => {
          if (!Array.isArray(syncedEnvGroups)) {
            return true;
          }
          return !syncedEnvGroups.find(
            (syncedEnvGroup) => syncedEnvGroup.name === envGroup.name
          );
        })
        .map((envGroup: any, i: number) => {
          return (
            <EnvGroupRow
              key={i}
              isSelected={selectedEnvGroup === envGroup}
              lastItem={i === envGroups.length - 1}
              onClick={() => setSelectedEnvGroup(envGroup)}
            >
              <img src={sliders} />
              {envGroup.name}
            </EnvGroupRow>
          );
        });
    }
  };

  const onSubmit = () => {
    if (shouldSync) {

      syncedEnvGroups.push(selectedEnvGroup);
      setSyncedEnvGroups(syncedEnvGroups);
    }
    else {
      const _values = [...values];

      Object.entries(selectedEnvGroup?.variables || {})
        .map(
          ([key, value]) =>
            _values.push({
              key,
              value: value as string,
              hidden: false,
              locked: false,
              deleted: false,
            })
        )
      setValues(_values);
    }
    closeModal();
  };

  return (
    <Modal closeModal={closeModal}>
      <Text size={16}>
        Load env group
      </Text>
      <Spacer height="15px" />
      {syncedEnvGroups.length != envGroups.length ? (<>
        <Text color="helper">
          Select an Env Group to load into your application.
        </Text>
        <Spacer y={0.5} />
        <GroupModalSections>
          <SidebarSection $expanded={!selectedEnvGroup}>
            <EnvGroupList>{renderEnvGroupList()}</EnvGroupList>
          </SidebarSection>
          {selectedEnvGroup && (
            <><SidebarSection>

              <GroupEnvPreview>

                <>
                  {isObject(envGroup.variables) ? (
                    <>
                      {Object.entries({
                        ...Object.entries(envGroup?.variables || {}).map(([key, value]) => ({ source: 'variables', key, value })),
                        ...Object.entries(envGroup.secret_variables || {}).map(([key, value]) => ({ source: 'secret_variables', key, value })),
                      })?.map(
                        ({ key, value, source }, i: number) => {
                          // Preprocess non-string env values set via raw Helm values
                          if (typeof value === "object") {
                            value = JSON.stringify(value);
                          } else {
                            value = String(value);
                          }

                          return (
                            <InputWrapper key={i}>
                              <KeyInput
                                placeholder="ex: key"
                                width="270px"
                                value={key}
                                disabled
                              />
                              <Spacer x={0.5} inline />
                              {source === 'secret_variables' ? (
                                <KeyInput
                                  placeholder="ex: value"
                                  width="270px"
                                  value={value}
                                  disabled
                                  type="password"
                                />
                              ) : (
                                <MultiLineInput
                                  placeholder="ex: value"
                                  width="270px"
                                  value={value}
                                  disabled
                                  rows={value?.split("\n").length}
                                  spellCheck={false}
                                ></MultiLineInput>
                              )}
                            </InputWrapper>
                          );
                        }
                      )}
                    </>
                  ) : (
                    <NoVariablesTextWrapper>
                      This env group has no variables yet
                    </NoVariablesTextWrapper>
                  )}
                </>

              </GroupEnvPreview>
              {/* {clashingKeys?.length > 0 && (
                <>
                  <ClashingKeyRowDivider />
                  {this.renderEnvGroupPreview(clashingKeys)}
                </>
              )} */}
            </SidebarSection>
              {/* <Checkbox
                checked={shouldSync}
                toggleChecked={() =>
                  setShouldSync((!shouldSync))
                }
              >
                <Text color="helper">Sync Env Group</Text>
              </Checkbox> */}
            </>
          )

          }

        </GroupModalSections>
        <Spacer y={1} />

        <Spacer y={1} />
        <Button
          onClick={onSubmit}
          disabled={!selectedEnvGroup}
        >
          Load Env Group
        </Button> </>
      ) : (<Text >
        No selectable Env Groups
      </Text>)}
    </Modal>
  )
}

export default withRouter(EnvGroupModal);

const LoadingWrapper = styled.div`
height: 150px;
`;
const Placeholder = styled.div`
width: 100%;
height: 150px;
display: flex;
align-items: center;
justify-content: center;
color: #aaaabb;
font-size: 13px;
`;

const EnvGroupRow = styled.div<{ lastItem?: boolean; isSelected: boolean }>`
display: flex;
width: 100%;
font-size: 13px;
border-bottom: 1px solid
  ${(props) => (props.lastItem ? "#00000000" : "#606166")};
color: #ffffff;
user-select: none;
align-items: center;
padding: 10px 0px;
cursor: pointer;
background: ${(props) => (props.isSelected ? "#ffffff11" : "")};
:hover {
  background: #ffffff11;
}

> img,
i {
  width: 16px;
  height: 18px;
  margin-left: 12px;
  margin-right: 12px;
  font-size: 20px;
}
`;
const EnvGroupList = styled.div`
width: 100%;
border-radius: 3px;
background: #ffffff11;
border: 1px solid #ffffff44;
overflow-y: auto;
`;

const SidebarSection = styled.section<{ $expanded?: boolean }>`
  height: 100%;
  overflow-y: auto;
  ${(props) =>
    props.$expanded &&
    css`
      grid-column: span 2;
    `}
`;

const GroupEnvPreview = styled.pre`
  font-family: monospace;
  margin: 0 0 10px 0;
  white-space: pre-line;
  word-break: break-word;
  user-select: text;
`;
const GroupModalSections = styled.div`
  margin-top: 20px;
  width: 100%;
  height: 100%;
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 1fr;
  max-height: 365px;
`;
