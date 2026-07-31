import type { DisruptionType } from '@navigator/shared';

export interface DisruptionTypeConfig {
    label: string;
    description: string;
    sliderLabel: string;
    min: number;
    max: number;
    step: number;
    formatValue: (val: number) => string;
    minLabel: string;
    maxLabel: string;
    defaultVal: number;
}

export const DISRUPTION_TYPE_CONFIGS: Partial<Record<DisruptionType, DisruptionTypeConfig>> = {
    demand_shock: {
        label: '수요 충격',
        description: '[수요] ESS/대체 수요 급증',
        sliderLabel: '초과 수요 발생률',
        min: 0,
        max: 1,
        step: 0.05,
        formatValue: (val: number) => `+${(val * 100).toFixed(0)}%`,
        minLabel: '+0%',
        maxLabel: '+100%',
        defaultVal: 0.5,
    },
    export_restriction: {
        label: '수출 통제',
        description: '[지정학] 국가별 수출 통제 및 관세',
        sliderLabel: '수출 물량 제한율',
        min: 0,
        max: 1,
        step: 0.05,
        formatValue: (val: number) => `${(val * 100).toFixed(0)}%`,
        minLabel: '0%',
        maxLabel: '100%',
        defaultVal: 0.5,
    },
    facility_closure: {
        label: '조업 중단',
        description: '[조업] 광산/제련소 가동 중단',
        sliderLabel: '생산 능력 감소율',
        min: 0,
        max: 1,
        step: 0.05,
        formatValue: (val: number) => `${(val * 100).toFixed(0)}%`,
        minLabel: '0%',
        maxLabel: '100%',
        defaultVal: 0.5,
    },
    stockpile_policy: {
        label: '비축 정책',
        description: '[정책] 자원 국유화 및 국가 비축',
        sliderLabel: '정부 비축/통제 물량',
        min: 0,
        max: 0.5,
        step: 0.05,
        formatValue: (val: number) => `${(val * 100).toFixed(0)}%`,
        minLabel: '0%',
        maxLabel: '50%',
        defaultVal: 0.25,
    },
    logistics_disruption: {
        label: '물류 마비',
        description: '[물류] 해운 경로 마비 및 운임 폭등',
        sliderLabel: '운송 리드타임 지연',
        min: 1,
        max: 5,
        step: 0.5,
        formatValue: (val: number) => `${val.toFixed(1)}배`,
        minLabel: '1배',
        maxLabel: '5배',
        defaultVal: 1.0,
    },
};

export interface ScenarioPreset {
    id: string;
    name: string;
    description: string;
    badge: string;
    config: {
        targetType: 'node' | 'edge';
        country?: string;
        nodeType?: string;
        sourceNodeId?: string;
        targetId: string;
        disruptionType: DisruptionType;
        severity: number;
    };
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
    {
        id: 'ai-ess-demand',
        name: 'AI 데이터센터발 ESS용 리튬 수요 폭발',
        description: 'AI 데이터센터 전력망 증설 및 글로벌 ESS 설치 수요 폭증으로 인해 전 세계 배터리 제조 공장의 리튬 소모 수요가 50% 급격히 증가하는 시나리오입니다.',
        badge: '수요',
        config: {
            targetType: 'node',
            country: 'ALL',
            nodeType: 'Factory',
            disruptionType: 'demand_shock',
            severity: 0.5,
            targetId: 'ALL_NODES',
        },
    },
    {
        id: 'china-export-restriction',
        name: '중국 리튬 수출 통제',
        description: '지정학적 갈등 심화 및 자원 무기화로 인해 중국 내 리튬 제련 시설의 대외 수출 가능 물량이 80% 강력히 제한되는 고위험 규제 시나리오입니다.',
        badge: '지정학',
        config: {
            targetType: 'node',
            country: 'China',
            nodeType: 'Refinery',
            disruptionType: 'export_restriction',
            severity: 0.8,
            targetId: 'RF-01',
        },
    },
    {
        id: 'latin-nationalization',
        name: '남미 리튬 삼각지대 국유화',
        description: '남미 자원 민족주의 고조에 따라 칠레 주요 광산의 국가 비축 및 정밀 통제가 강화되어 유통 공급망에서 자원 30%가 국유화 조치되는 시나리오입니다.',
        badge: '정책',
        config: {
            targetType: 'node',
            country: 'Chile',
            nodeType: 'Mine',
            disruptionType: 'stockpile_policy',
            severity: 0.3,
            targetId: 'M-01',
        },
    },
    {
        id: 'sea-route-blockade',
        name: '주요 해상 경로 봉쇄',
        description: '핵심 대양 해상 항로 마비 및 항만 지정학 지정 이슈로 호주 광산-중국 제련소 간 핵심 수송 리드타임이 3배로 대폭 지연되는 물류 마비 시나리오입니다.',
        badge: '물류',
        config: {
            targetType: 'edge',
            sourceNodeId: 'M-04',
            disruptionType: 'logistics_disruption',
            severity: 3.0,
            targetId: 'E-M04-RF01',
        },
    },
];
