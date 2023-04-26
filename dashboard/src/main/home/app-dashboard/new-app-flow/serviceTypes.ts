export type Service = WorkerService | WebService | JobService;
export type ServiceType = 'web' | 'worker' | 'job';

type SharedServiceParams = {
    name: string;
    cpu: string;
    ram: string;
    startCommand: string;
    type: ServiceType;
}

export type WorkerService = SharedServiceParams & {
    type: 'worker';
    replicas: string;
    autoscalingOn: boolean;
    minReplicas: string;
    maxReplicas: string;
    targetCPUUtilizationPercentage: string;
    targetRAMUtilizationPercentage: string;
}
const WorkerService = {
    empty: (name: string): WorkerService => ({
        name,
        cpu: '',
        ram: '',
        startCommand: '',
        type: 'worker',
        replicas: '1',
        autoscalingOn: false,
        minReplicas: '1',
        maxReplicas: '10',
        targetCPUUtilizationPercentage: '50',
        targetRAMUtilizationPercentage: '50',
    }),
}

export type WebService = SharedServiceParams & Omit<WorkerService, 'type'> & {
    type: 'web';
    port: string;
    generateUrlForExternalTraffic: boolean;
    customDomain?: string;
}
const WebService = {
    empty: (name: string): WebService => ({
        name,
        cpu: '',
        ram: '',
        startCommand: '',
        type: 'web',
        replicas: '1',
        autoscalingOn: false,
        minReplicas: '1',
        maxReplicas: '10',
        targetCPUUtilizationPercentage: '50',
        targetRAMUtilizationPercentage: '50',
        port: '8080',
        generateUrlForExternalTraffic: true,
    }),
}

export type JobService = SharedServiceParams & {
    type: 'job';
    jobsExecuteConcurrently: boolean;
    cronSchedule: string;
}
const JobService = {
    empty: (name: string): JobService => ({
        name,
        cpu: '',
        ram: '',
        startCommand: '',
        type: 'job',
        jobsExecuteConcurrently: false,
        cronSchedule: '',
    }),
}

export const createDefaultService = (name: string, type: ServiceType) => {
    switch (type) {
        case 'web':
            return WebService.empty(name);
        case 'worker':
            return WorkerService.empty(name);
        case 'job':
            return JobService.empty(name);
    }
}