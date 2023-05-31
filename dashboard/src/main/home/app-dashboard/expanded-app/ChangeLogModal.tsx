import React, { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Modal from "components/porter/Modal";
import TitleSection from "components/TitleSection";
import Loading from "components/Loading";
import Text from "components/porter/Text";
import danger from "assets/danger.svg";
import Anser, { AnserJsonEntry } from "anser";
import web from "assets/web-bold.png";
import settings from "assets/settings-bold.png";
import sliders from "assets/sliders.svg";
import yaml from "js-yaml";
import DiffViewer, { DiffMethod } from "react-diff-viewer";

import dayjs from "dayjs";
import Link from "components/porter/Link";
import Spacer from "components/porter/Spacer";
import Checkbox from "components/porter/Checkbox";
import { NavLink } from "react-router-dom";
import SidebarLink from "main/home/sidebar/SidebarLink";
import { EnvVariablesTab } from "./EnvVariablesTab";
import { ChartType } from "shared/types";
import * as YAML from "js-yaml";
import * as Diff from "deep-diff";
import api from "shared/api";
import { Context } from "shared/Context";

type Props = {
  modalVisible: boolean;
  setModalVisible: (x: boolean) => void;
  revision: number;
  currentChart: ChartType;

  //envChild: any;
};

const ChangeLogModal: React.FC<Props> = ({
  revision,
  currentChart,
  modalVisible,
  //envChild,
  setModalVisible,
}) => {
  const [scrollToBottomEnabled, setScrollToBottomEnabled] = useState(true);
  const [currentView, setCurrentView] = useState("overview");
  const [values, setValues] = useState("");
  const [chartEvent, setChartEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const { currentCluster, currentProject, setCurrentError } = useContext(
    Context
  );
  useEffect(() => {
    getChartData(currentChart);
    let values = "# Nothing here yet";
    if (currentChart.config) {
      values = yaml.dump(currentChart.config);
    }
    setValues(values);
  }, [currentChart.config]); // It will run this effect whenever currentChart.config changes

  const getChartData = async (chart: ChartType) => {
    setLoading(true);
    const res = await api.getChart(
      "<token>",
      {},
      {
        name: chart.name,
        namespace: chart.namespace,
        cluster_id: currentCluster.id,
        revision: revision,
        id: currentProject.id,
      }
    );
    const updatedChart = res.data;
    //console.log(updatedChart);
    setChartEvent(updatedChart);
    setLoading(false);
  };
  const parseYamlAndDisplayDifferences = (oldYaml: any, newYaml: any) => {
    const diff = Diff.diff(oldYaml, newYaml);
    const changes: JSX.Element[] = [];

    // Define the regex pattern to match service creation
    const servicePattern = /^[a-zA-Z0-9\-]*-[a-zA-Z0-9]*[^\.]$/;

    diff?.forEach((difference: any) => {
      let path = difference.path?.join(".");
      switch (difference.kind) {
        case "N":
          // Check if the added item is a service by testing the path against the regex pattern
          if (servicePattern.test(path)) {
            // If so, display a simplified message
            const serviceName = path.split("-")[0];
            changes.push(<Text>{`${serviceName} created`}</Text>);
          } else {
            // If not, display the full message
            changes.push(
              <Text>{`${path} added: ${JSON.stringify(difference.rhs)}`}</Text>
            );
          }
          break;
        case "D":
          changes.push(<Text>{`${path} removed`}</Text>);
          break;
        case "E":
          changes.push(
            <Text>
              {`${path} updated: ${JSON.stringify(
                difference.lhs
              )} -> ${JSON.stringify(difference.rhs)}`}
            </Text>
          );
          break;
        case "A":
          path = path + `[${difference.index}]`;
          if (difference.item.kind === "N")
            changes.push(
              <Text>{`${path} added: ${JSON.stringify(
                difference.item.rhs
              )}`}</Text>
            );
          if (difference.item.kind === "D")
            changes.push(<Text>{`${path} removed`}</Text>);
          if (difference.item.kind === "E")
            changes.push(
              <Text>
                {`${path} updated: ${JSON.stringify(
                  difference.item.lhs
                )} -> ${JSON.stringify(difference.item.rhs)}`}
              </Text>
            );
          break;
      }
    });

    return <ChangeLog>{changes}</ChangeLog>;
  };

  return (
    <>
      <Modal closeModal={() => setModalVisible(false)} width={"1100px"}>
        <Text size={18}>Change Log</Text>
        <Wrapper>
          {/* <DiffViewer
            leftTitle={`Current Version`}
            rightTitle={`Revision No. ${currentChart.version.toString()}`}
            oldValue={values}
            newValue={values}
            splitView={true}
            hideLineNumbers={false}
            useDarkTheme={true}
            compareMethod={DiffMethod.TRIMMED_LINES}
          /> */}
          {
            loading ? (
              <Loading /> // <-- Render loading state
            ) : (
              parseYamlAndDisplayDifferences(
                chartEvent?.config,
                currentChart.config
              )
            ) // <-- Render when data is ready
          }
        </Wrapper>
      </Modal>
    </>
  );
};

export default ChangeLogModal;

const Wrapper = styled.div`
  overflow-y: scroll;
  border-radius: 8px;
  margin-bottom: 30px;
  border: 1px solid #ffffff33;
`;

const StyledValuesYaml = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - 350px);
  font-size: 13px;
  overflow: hidden;
  border-radius: 8px;
  animation: floatIn 0.3s;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
  @keyframes floatIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0px);
    }
  }
`;
const ChangeLog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5em;
`;

const AddedChange = styled.div`
  color: green;
`;

const RemovedChange = styled.div`
  color: red;
`;

const UpdatedChange = styled.div`
  color: blue;
`;
