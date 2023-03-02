import React, { Component } from "react";
import styled from "styled-components";
import yaml from "js-yaml";
import _ from "lodash";
import { ChartType } from "shared/types";
import api from "shared/api";
import { Context } from "shared/Context";
import YamlEditor from "components/YamlEditor";
import SaveButton from "components/SaveButton";
import DiffViewer from "react-diff-viewer";

type PropsType = {
  newestVersion: boolean;
  latestChart: ChartType;
  currentChart: ChartType;
  refreshChart: () => void;
  disabled?: boolean;
};

type StateType = {
  values: string;
  originalValues: string;
  saveValuesStatus: string | null;
  showDiffView: boolean;
};

export default class ValuesYaml extends Component<PropsType, StateType> {
  state = {
    values: "",
    originalValues: "",
    saveValuesStatus: null as string | null,
    showDiffView: false,
  };

  updateValues() {
    let originalValues = "# Nothing here yet";
    if (this.props.currentChart.config) {
      originalValues = yaml.dump(this.props.latestChart.config);
    }
    let values = "# Nothing here yet";
    if (this.props.currentChart.config) {
      values = yaml.dump(this.props.currentChart.config);
    }
    this.setState({ values, originalValues });
  }

  componentDidMount() {
    this.updateValues();
  }

  componentDidUpdate(prevProps: PropsType) {
    if (this.props.currentChart !== prevProps.currentChart) {
      this.updateValues();
    }
  }

  handleSaveValues = () => {
    let { currentCluster, setCurrentError, currentProject } = this.context;
    this.setState({ saveValuesStatus: "loading" });

    let valuesString = this.state.values;

    // if this is a job, set it to paused
    if (this.props.currentChart?.chart?.metadata?.name == "job") {
      const valuesYAML = yaml.load(this.state.values);
      _.set(valuesYAML, "paused", true);
      valuesString = yaml.dump(valuesYAML);
    }

    api
      .upgradeChartValues(
        "<token>",
        {
          values: valuesString,
          latest_revision: this.props.currentChart.version,
        },
        {
          id: currentProject.id,
          name: this.props.currentChart.name,
          cluster_id: currentCluster.id,
          namespace: this.props.currentChart.namespace,
        }
      )
      .then((res) => {
        this.setState({
          saveValuesStatus: "successful",
          originalValues: valuesString,
        });
        this.props.refreshChart();
      })
      .catch((err) => {
        let parsedErr = err?.response?.data?.error;

        if (parsedErr) {
          err = parsedErr;
        }

        this.setState({
          saveValuesStatus: parsedErr,
        });

        setCurrentError(parsedErr);
      });
  };

  handleToggleDiffView = () => {
    this.setState((prevState) => ({ showDiffView: !prevState.showDiffView }));
  };

  render() {
    const { disabled, newestVersion, currentChart, latestChart } = this.props;
    const { values, originalValues, showDiffView } = this.state;

    return (
      <StyledValuesYaml>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "10px",
          }}
        >
          <label style={{ marginLeft: "10px" }}>
            Show diff view
            <input
              type="checkbox"
              checked={showDiffView}
              onChange={this.handleToggleDiffView}
            />
          </label>
        </div>
        {showDiffView ? (
          <Wrapper>
            <DiffViewer
              leftTitle={`Current Version`}
              rightTitle={`Revision No. ${currentChart.version.toString()}`}
              oldValue={originalValues}
              newValue={values}
              splitView={true}
              hideLineNumbers={false}
              useDarkTheme={true}
            />
          </Wrapper>
        ) : (
          <Wrapper>
            <YamlEditor
              value={values}
              onChange={(e: any) => this.setState({ values: e })}
              readOnly={disabled}
              height="calc(100vh - 412px)"
            />
          </Wrapper>
        )}
        {!disabled && (
          <SaveButton
            text="Update values"
            onClick={this.handleSaveValues}
            status={this.state.saveValuesStatus}
            statusPosition="right"
            clearPosition={true}
            makeFlush={true}
          />
        )}
      </StyledValuesYaml>
    );
  }
}

ValuesYaml.contextType = Context;

const Wrapper = styled.div`
  overflow: auto;
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
