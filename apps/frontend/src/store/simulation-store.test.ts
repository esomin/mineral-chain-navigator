/**
 * 시뮬레이션 스토어 단위 테스트.
 * 시나리오 구성, 충격 추가/삭제, 시뮬레이션 실행 로직을 검증한다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSimulationStore } from './simulation-store';

// 스토어 상태를 매 테스트 전에 초기화
beforeEach(() => {
    useSimulationStore.setState({
        currentDisruption: {
            targetId: '',
            targetType: 'node',
            disruptionType: 'export_restriction',
            severity: 0.5,
        },
        disruptions: [],
        result: null,
        isRunning: false,
        elapsedSeconds: 0,
        error: null,
        history: [],
        historyEntries: [],
        isLoadingHistory: false,
        highlightedPath: null,
    });
});

describe('SimulationStore - 시나리오 구성', () => {
    it('대상 ID를 설정할 수 있어야 한다', () => {
        useSimulationStore.getState().setTargetId('node-01');
        expect(useSimulationStore.getState().currentDisruption.targetId).toBe('node-01');
    });

    it('대상 유형을 node/edge로 변경할 수 있어야 한다', () => {
        useSimulationStore.getState().setTargetType('edge');
        expect(useSimulationStore.getState().currentDisruption.targetType).toBe('edge');
    });

    it('충격 유형을 변경할 수 있어야 한다', () => {
        useSimulationStore.getState().setDisruptionType('natural_disaster');
        expect(useSimulationStore.getState().currentDisruption.disruptionType).toBe('natural_disaster');
    });

    it('심각도를 0~1 범위에서 설정할 수 있어야 한다', () => {
        useSimulationStore.getState().setSeverity(0.8);
        expect(useSimulationStore.getState().currentDisruption.severity).toBe(0.8);
    });
});

describe('SimulationStore - 충격 목록 관리', () => {
    it('현재 구성을 충격 목록에 추가할 수 있어야 한다', () => {
        const store = useSimulationStore.getState();
        store.setTargetId('RF-01');
        store.setDisruptionType('facility_closure');
        store.setSeverity(0.7);
        store.addDisruption();

        const { disruptions } = useSimulationStore.getState();
        expect(disruptions).toHaveLength(1);
        expect(disruptions[0]).toEqual({
            targetId: 'RF-01',
            targetType: 'node',
            disruptionType: 'facility_closure',
            severity: 0.7,
        });
    });

    it('대상 ID가 비어있으면 충격을 추가하지 않아야 한다', () => {
        useSimulationStore.getState().addDisruption();
        expect(useSimulationStore.getState().disruptions).toHaveLength(0);
    });

    it('동일한 노드와 충격 유형의 이벤트가 이미 존재하면 중복 추가를 차단하고 에러를 설정해야 한다', () => {
        const store = useSimulationStore.getState();
        store.setTargetId('RF-01');
        store.setDisruptionType('facility_closure');
        store.setSeverity(0.7);
        store.addDisruption();

        expect(useSimulationStore.getState().disruptions).toHaveLength(1);

        // 다시 동일하게 추가 시도
        useSimulationStore.getState().addDisruption();
        expect(useSimulationStore.getState().disruptions).toHaveLength(1);
        expect(useSimulationStore.getState().error).toBe('이미 동일한 노드와 충격 유형의 이벤트가 존재합니다.');
    });

    it('특정 인덱스의 충격을 삭제할 수 있어야 한다', () => {
        useSimulationStore.setState({
            disruptions: [
                { targetId: 'a', targetType: 'node', disruptionType: 'strike', severity: 0.5 },
                { targetId: 'b', targetType: 'edge', disruptionType: 'export_restriction', severity: 0.9 },
            ],
        });

        useSimulationStore.getState().removeDisruption(0);
        const { disruptions } = useSimulationStore.getState();
        expect(disruptions).toHaveLength(1);
        expect(disruptions[0].targetId).toBe('b');
    });

    it('충격 목록을 전체 삭제할 수 있어야 한다', () => {
        useSimulationStore.setState({
            disruptions: [
                { targetId: 'a', targetType: 'node', disruptionType: 'strike', severity: 0.5 },
            ],
        });

        useSimulationStore.getState().clearDisruptions();
        expect(useSimulationStore.getState().disruptions).toHaveLength(0);
    });

    it('충격 목록을 일괄 설정할 수 있어야 한다 (국가 바로가기)', () => {
        const disruptions = [
            { targetId: 'e1', targetType: 'edge' as const, disruptionType: 'export_restriction' as const, severity: 0.8 },
            { targetId: 'e2', targetType: 'edge' as const, disruptionType: 'export_restriction' as const, severity: 0.8 },
        ];

        useSimulationStore.getState().setDisruptions(disruptions);
        expect(useSimulationStore.getState().disruptions).toHaveLength(2);
        expect(useSimulationStore.getState().disruptions[0].targetId).toBe('e1');
    });
});

describe('SimulationStore - 시뮬레이션 실행', () => {
    it('충격 목록이 비어있으면 에러를 설정해야 한다', async () => {
        await useSimulationStore.getState().runSimulation();
        expect(useSimulationStore.getState().error).toBe('충격 시나리오를 하나 이상 추가하세요.');
        expect(useSimulationStore.getState().isRunning).toBe(false);
    });

    it('시뮬레이션 실행 시 isRunning을 true로 설정해야 한다', async () => {
        // fetch를 모킹하여 응답 지연 시뮬레이션
        global.fetch = vi.fn(() => new Promise(() => { })) as unknown as typeof fetch;

        useSimulationStore.setState({
            disruptions: [
                { targetId: 'RF-01', targetType: 'node', disruptionType: 'facility_closure', severity: 0.5 },
            ],
        });

        // 비동기 실행 시작 (await하지 않음)
        const promise = useSimulationStore.getState().runSimulation();
        // 약간의 딜레이 후 상태 확인
        await new Promise((r) => setTimeout(r, 10));
        expect(useSimulationStore.getState().isRunning).toBe(true);

        // 클린업: promise 해결
        vi.restoreAllMocks();
    });

    it('API 성공 시 결과와 하이라이트 경로를 설정해야 한다', async () => {
        const mockResult = {
            scenarioId: 'test-scenario',
            propagationPaths: [
                { nodes: ['RF-01', 'F-01'], edges: ['e-01'], attenuationFactors: [0.8] },
            ],
            deficits: [
                { nodeId: 'F-01', originalSupply: 100, disruptedSupply: 50, deficitPercentage: 50 },
            ],
            executionTimeMs: 150,
        };

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockResult),
            }),
        ) as unknown as typeof fetch;

        useSimulationStore.setState({
            disruptions: [
                { targetId: 'RF-01', targetType: 'node', disruptionType: 'facility_closure', severity: 0.7 },
            ],
        });

        await useSimulationStore.getState().runSimulation();

        const state = useSimulationStore.getState();
        expect(state.result).toEqual(mockResult);
        expect(state.isRunning).toBe(false);
        expect(state.highlightedPath).toEqual({
            nodeIds: ['RF-01', 'F-01'],
            edgeIds: ['e-01'],
        });
        expect(state.history).toHaveLength(1);
        expect(state.historyEntries).toHaveLength(1);
        expect(state.historyEntries[0].scenarioId).toContain('scenario-');
        expect(state.historyEntries[0].name).toContain('시뮬레이션');
        expect(state.historyEntries[0].executedAt).toBeInstanceOf(Date);
        expect(state.historyEntries[0].result).toEqual(mockResult);

        vi.restoreAllMocks();
    });

    it('API 실패 시 에러를 설정해야 한다', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false,
                status: 500,
            }),
        ) as unknown as typeof fetch;

        useSimulationStore.setState({
            disruptions: [
                { targetId: 'RF-01', targetType: 'node', disruptionType: 'strike', severity: 0.5 },
            ],
        });

        await useSimulationStore.getState().runSimulation();

        const state = useSimulationStore.getState();
        expect(state.error).toBe('API 에러: 500');
        expect(state.isRunning).toBe(false);

        vi.restoreAllMocks();
    });
});

describe('SimulationStore - 결과 관리', () => {
    it('결과를 초기화할 수 있어야 한다', () => {
        useSimulationStore.setState({
            result: {
                scenarioId: 'test',
                propagationPaths: [],
                deficits: [],
                executionTimeMs: 100,
            },
            highlightedPath: { nodeIds: ['a'], edgeIds: ['b'] },
            error: '이전 에러',
        });

        useSimulationStore.getState().clearResult();

        const state = useSimulationStore.getState();
        expect(state.result).toBeNull();
        expect(state.highlightedPath).toBeNull();
        expect(state.error).toBeNull();
    });

    it('하이라이트 경로를 수동으로 설정할 수 있어야 한다', () => {
        useSimulationStore.getState().setHighlightedPath({
            nodeIds: ['n1', 'n2'],
            edgeIds: ['e1'],
        });

        expect(useSimulationStore.getState().highlightedPath).toEqual({
            nodeIds: ['n1', 'n2'],
            edgeIds: ['e1'],
        });
    });
});

describe('SimulationStore - 이력 관리', () => {
    it('loadHistoryResult 성공 시 결과와 하이라이트를 복원해야 한다', async () => {
        const mockResult = {
            scenarioId: 'scenario-123',
            propagationPaths: [
                { nodes: ['RF-01', 'F-02'], edges: ['e-02'], attenuationFactors: [0.7] },
            ],
            deficits: [
                { nodeId: 'F-02', originalSupply: 200, disruptedSupply: 80, deficitPercentage: 60 },
            ],
            executionTimeMs: 200,
        };

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockResult),
            }),
        ) as unknown as typeof fetch;

        await useSimulationStore.getState().loadHistoryResult('scenario-123');

        const state = useSimulationStore.getState();
        expect(state.result).toEqual(mockResult);
        expect(state.isLoadingHistory).toBe(false);
        expect(state.highlightedPath).toEqual({
            nodeIds: ['RF-01', 'F-02'],
            edgeIds: ['e-02'],
        });
        expect(global.fetch).toHaveBeenCalledWith('/api/simulation/scenario-123');

        vi.restoreAllMocks();
    });

    it('loadHistoryResult 실패 시 에러를 설정해야 한다', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false,
                status: 404,
            }),
        ) as unknown as typeof fetch;

        await useSimulationStore.getState().loadHistoryResult('nonexistent-id');

        const state = useSimulationStore.getState();
        expect(state.error).toBe('이력 로드 실패: 404');
        expect(state.isLoadingHistory).toBe(false);
        expect(state.result).toBeNull();

        vi.restoreAllMocks();
    });

    it('loadHistoryResult 호출 중 isLoadingHistory가 true여야 한다', async () => {
        global.fetch = vi.fn(() => new Promise(() => { })) as unknown as typeof fetch;

        // 비동기 실행 시작 (await하지 않음)
        const promise = useSimulationStore.getState().loadHistoryResult('scenario-123');
        await new Promise((r) => setTimeout(r, 10));

        expect(useSimulationStore.getState().isLoadingHistory).toBe(true);

        vi.restoreAllMocks();
    });
});
