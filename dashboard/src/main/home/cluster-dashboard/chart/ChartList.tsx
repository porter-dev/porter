import React, { Component } from 'react';
import styled from 'styled-components';

import { Context } from '../../../../shared/Context';
import api from '../../../../shared/api';
import { ChartType, StorageType, ClusterType } from '../../../../shared/types';

import Chart from './Chart';
import Loading from '../../../../components/Loading';

type PropsType = {
  currentCluster: ClusterType,
  namespace: string,
  sortType: string,
  setCurrentChart: (c: ChartType) => void
};

type StateType = {
  charts: ChartType[],
  chartLookupTable: Record<string, string>,
  controllers: Record<string, Record<string, any>>,
  loading: boolean,
  error: boolean,
  websockets: Record<string, any>,
};

export default class ChartList extends Component<PropsType, StateType> {
  state = {
    charts: [] as ChartType[],
    chartLookupTable: {} as Record<string, string>,
    controllers: {} as Record<string, Record<string, any>>,
    loading: false,
    error: false,
    websockets : {} as Record<string, any>,
  }

  updateCharts = (callback: Function) => {
    let { currentCluster, currentProject, setCurrentError } = this.context;
    this.setState({ loading: true });

    api.getCharts('<token>', {
      namespace: this.props.namespace,
      cluster_id: currentCluster.id,
      storage: StorageType.Secret,
      limit: 20,
      skip: 0,
      byDate: false,
      statusFilter: ['deployed', 'uninstalled', 'pending', 'pending_upgrade',
        'pending_rollback','superseded','failed']
    }, { id: currentProject.id }, (err: any, res: any) => {
      if (err) {
        console.log(err)
        setCurrentError(JSON.stringify(err));
        this.setState({ loading: false, error: true });
      } else {
        let charts = res.data || [];
        console.log(Date.parse(charts[0].info.last_deployed));
        console.log(charts[0].name);
        if (this.props.sortType == "chronological") {
          charts.sort((a: any, b: any) => (Date.parse(a.info.last_deployed) > Date.parse(b.info.last_deployed)) ? -1 : 1);
        } else if (this.props.sortType == "alphabetical") {
          charts.sort((a: any, b: any) => (a.name > b.name) ? 1: -1);
        }
        this.setState({ charts }, () => {
          this.setState({ loading: false, error: false });
        });
        callback(charts)
      }
    });
  }

  setupWebsocket = (kind: string) => {
      let { currentCluster, currentProject } = this.context;
      let protocol = process.env.NODE_ENV == 'production' ? 'wss' : 'ws';
      let ws = new WebSocket(`${protocol}://${process.env.API_SERVER}/api/projects/${currentProject.id}/k8s/${kind}/status?cluster_id=${currentCluster.id}`);
      ws.onopen = () => {
        console.log('connected to websocket');
      }
  
      ws.onmessage = (evt: MessageEvent) => {
        let event = JSON.parse(evt.data);
        let object = event.Object;
        object.metadata.kind = event.Kind
        let chartKey = this.state.chartLookupTable[object.metadata.uid];

        // ignore if updated object does not belong to any chart in the list.
        if (!chartKey) {
          return;
        }

        let chartControllers = this.state.controllers[chartKey];
        chartControllers[object.metadata.uid] = object;

        this.setState({
          controllers: {
            ...this.state.controllers,
            [chartKey] : chartControllers
          }
        });
      }
  
      ws.onclose = () => {
        console.log('closing websocket');
      }
  
      ws.onerror = (err: ErrorEvent) => {
        console.log(err);
        ws.close();
      }

      return ws;
  }

  setControllerWebsockets = (controllers: any[]) => {
    let websockets = controllers.map((kind: string) => {
      return this.setupWebsocket(kind);
    })
    this.setState({ websockets });
  }

  getControllers = (charts: any[]) => {
    let { currentCluster, currentProject, setCurrentError } = this.context;

    charts.forEach(async (chart: any) => {
      // don't retrieve controllers for chart that failed to even deploy.
      if (chart.info.status == 'failed') return;

      await new Promise((next: (res?: any) => void) => {
        api.getChartControllers('<token>', {
          namespace: chart.namespace,
          cluster_id: currentCluster.id,
          storage: StorageType.Secret
        }, {
          id: currentProject.id,
          name: chart.name,
          revision: chart.version
        }, (err: any, res: any) => {
          if (err) {
            setCurrentError(JSON.stringify(err));
            return
          }
          // transform controller array into hash table for easy lookup during updates.
          let chartControllers = {} as Record<string, Record<string, any>>
          res.data.forEach((c: any) => {
            c.metadata.kind = c.kind
            chartControllers[c.metadata.uid] = c
          })

          res.data.forEach(async (c: any) => {
            await new Promise((nextController: (res?: any) => void) => {
              this.setState({
                chartLookupTable: {
                  ...this.state.chartLookupTable,
                  [c.metadata.uid] : `${chart.namespace}-${chart.name}`
                },
                controllers: {
                  ...this.state.controllers,
                  [`${chart.namespace}-${chart.name}`] : chartControllers
                }
              }, () => {
                nextController();
              })
            })
          })
          next();
        });
      })
    })
  }

  componentDidMount() {
    this.updateCharts(this.getControllers);
    this.setControllerWebsockets(["deployment", "statefulset", "daemonset", "replicaset"]);
  }

  componentWillUnmount() {
    if (this.state.websockets) {
      this.state.websockets.forEach((ws: WebSocket) => {
        ws.close()
      })
    }
  }

  componentDidUpdate(prevProps: PropsType) {
    // Ret2: Prevents reload when opening ClusterConfigModal
    if (prevProps.currentCluster !== this.props.currentCluster || 
      prevProps.namespace !== this.props.namespace ||
      prevProps.sortType !== this.props.sortType) {
      this.updateCharts(this.getControllers);
    }
  }

  renderChartList = () => {
    let { loading, error, charts } = this.state;

    if (loading) {
      return <LoadingWrapper><Loading /></LoadingWrapper>
    } else if (error) {
      return (
        <Placeholder>
          <i className="material-icons">error</i> Error connecting to cluster.
        </Placeholder>
      );
    } else if (charts.length === 0) {
      return (
        <Placeholder>
          <i className="material-icons">category</i> No charts found in this namespace.
        </Placeholder>
      );
    }

    return this.state.charts.map((chart: ChartType, i: number) => {
      return (
        <Chart
          key={`${chart.namespace}-${chart.name}`}
          chart={chart}
          setCurrentChart={this.props.setCurrentChart}
          controllers={this.state.controllers[`${chart.namespace}-${chart.name}`] || {} as Record<string, any>}
        />
      )
    })
  }


  render() {
    return (
      <StyledChartList>
        {this.renderChartList()}
      </StyledChartList>
    );
  }
}

ChartList.contextType = Context;

const Placeholder = styled.div`
  padding-top: 100px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff44;
  font-size: 14px;

  > i {
    font-size: 18px;
    margin-right: 12px;
  }
`;

const LoadingWrapper = styled.div`
  padding-top: 100px;
`;

const StyledChartList = styled.div`
  padding-bottom: 85px;
`;