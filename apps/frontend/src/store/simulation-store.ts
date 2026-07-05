import { create } from 'zustand';
import type {
    Disruption,
    DisruptionScenario,
    DisruptionType,
    SimulationResult,
} from '@navigator/shared';

// 시뮬레이션 이력 항목 인터페이스
export interface HistoryEntry {
    scenarioId: string;
    name: string;
    executedAt: Date;
    result: SimulationResult;
}

// 시뮬레이션 상태 인터페이스
export interface SimulationState {
    // 현재 시나리오 구성
    currentDisruption: {
        targetId: string;
        targetType: 'node' | 'edge';
        disruptionType: DisruptionType;
        severity: number;
    };
    disruptions: Disruption[];

    // 시뮬레이션 결과
    result: SimulationResult | null;

    // 로딩 상태
    isRunning: boolean;
    elapsedSeconds: number;
    error: string | null;

    // 히스토리
    history: SimulationResult[];
    historyEntries: HistoryEntry[];

    // 이력 로딩 상태
    isLoadingHistory: boolean;

    // 하이라이트 경로 (GraphRenderer 전달용)
    highlightedPath: { nodeIds: string[]; edgeIds: string[] } | null;

    // 액션
    setTargetId: (targetId: string) => void;
    setTargetType: (targetType: 'node' | 'edge') => void;
    setDisruptionType: (disruptionType: DisruptionType) => void;
    setSeverity: (severity: number) => void;
    addDisruption: () => void;
    removeDisruption: (index: number) => void;
    clearDisruptions: () => void;
    setDisruptions: (disruptions: Disruption[]) => void;
    runSimulation: () => Promise<void>;
    clearResult: () => void;
    setHighlightedPath: (path: { nodeIds: string[]; edgeIds: string[] } | null) => void;
    setElapsedSeconds: (seconds: number) => void;
    loadHistoryResult: (scenarioId: string) => Promise<void>;
}

// Zustand 스토어 생성 - 시뮬레이션 상태 관리
export const useSimulationStore = create<SimulationState>((set, get) => ({
    // 초기 상태
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

    // 충격 대상 ID 설정
    setTargetId: (targetId) =>
        set((state) => ({
            currentDisruption: { ...state.currentDisruption, targetId },
            error: null,
        })),

    // 충격 대상 유형 설정 (node/edge)
    setTargetType: (targetType) =>
        set((state) => ({
            currentDisruption: { ...state.currentDisruption, targetType },
            error: null,
        })),

    // 충격 유형 설정
    setDisruptionType: (disruptionType) =>
        set((state) => ({
            currentDisruption: { ...state.currentDisruption, disruptionType },
            error: null,
        })),

    // 심각도 설정
    setSeverity: (severity) =>
        set((state) => ({
            currentDisruption: { ...state.currentDisruption, severity },
            error: null,
        })),

    // 현재 설정을 충격 목록에 추가
    addDisruption: () => {
        const { currentDisruption, disruptions } = get();
        if (!currentDisruption.targetId) return;

        // 동일 노드에 동일 충격 유형이 이미 존재하는지 검증
        const isDuplicate = disruptions.some(
            (d) =>
                d.targetId === currentDisruption.targetId &&
                d.disruptionType === currentDisruption.disruptionType
        );

        if (isDuplicate) {
            set({ error: '이미 동일한 노드와 충격 유형의 이벤트가 존재합니다.' });
            return;
        }

        const disruption: Disruption = { ...currentDisruption };
        set((state) => ({
            disruptions: [...state.disruptions, disruption],
            error: null,
        }));
    },

    // 특정 충격 제거
    removeDisruption: (index) =>
        set((state) => ({
            disruptions: state.disruptions.filter((_, i) => i !== index),
        })),

    // 충격 목록 초기화
    clearDisruptions: () => set({ disruptions: [] }),

    // 충격 목록 일괄 설정 (국가 바로가기 등)
    setDisruptions: (disruptions) => set({ disruptions }),

    // 시뮬레이션 실행 - POST /api/simulation/run 호출
    runSimulation: async () => {
        const { disruptions } = get();
        if (disruptions.length === 0) {
            set({ error: '충격 시나리오를 하나 이상 추가하세요.' });
            return;
        }

        const scenario: DisruptionScenario = {
            id: `scenario-${Date.now()}`,
            name: `시뮬레이션 ${new Date().toLocaleTimeString('ko-KR')}`,
            disruptions,
        };

        set({ isRunning: true, error: null, elapsedSeconds: 0, result: null });

        // 3초 타임아웃 타이머
        const timeoutId = setTimeout(() => {
            set({ error: '시뮬레이션 타임아웃 (3초 초과)' });
        }, 3000);

        // 경과 시간 카운터 (100ms 간격)
        const intervalId = setInterval(() => {
            set((state) => ({ elapsedSeconds: state.elapsedSeconds + 0.1 }));
        }, 100);

        try {
            const response = await fetch('/api/simulation/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario }),
            });

            clearTimeout(timeoutId);
            clearInterval(intervalId);

            if (!response.ok) {
                throw new Error(`API 에러: ${response.status}`);
            }

            const result: SimulationResult = await response.json();

            // 결과에서 하이라이트 경로 추출
            const nodeIds = new Set<string>();
            const edgeIds = new Set<string>();
            result.propagationPaths.forEach((path) => {
                path.nodes.forEach((id) => nodeIds.add(id));
                path.edges.forEach((id) => edgeIds.add(id));
            });

            // 이력 항목 생성
            const historyEntry: HistoryEntry = {
                scenarioId: scenario.id,
                name: scenario.name,
                executedAt: new Date(),
                result,
            };

            set((state) => ({
                result,
                isRunning: false,
                history: [...state.history, result],
                historyEntries: [...state.historyEntries, historyEntry],
                highlightedPath: {
                    nodeIds: Array.from(nodeIds),
                    edgeIds: Array.from(edgeIds),
                },
            }));
        } catch (err) {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            set({
                isRunning: false,
                error: err instanceof Error ? err.message : '시뮬레이션 실행 실패',
            });
        }
    },

    // 결과 초기화
    clearResult: () => set({ result: null, highlightedPath: null, error: null }),

    // 하이라이트 경로 설정
    setHighlightedPath: (path) => set({ highlightedPath: path }),

    // 경과 시간 설정
    setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),

    // 이력에서 시뮬레이션 결과를 재로드하고 그래프 하이라이트를 복원
    loadHistoryResult: async (scenarioId: string) => {
        set({ isLoadingHistory: true, error: null });

        try {
            const response = await fetch(`/api/simulation/${scenarioId}`);

            if (!response.ok) {
                throw new Error(`이력 로드 실패: ${response.status}`);
            }

            const result: SimulationResult = await response.json();

            // 결과에서 하이라이트 경로 추출
            const nodeIds = new Set<string>();
            const edgeIds = new Set<string>();
            result.propagationPaths.forEach((path) => {
                path.nodes.forEach((id) => nodeIds.add(id));
                path.edges.forEach((id) => edgeIds.add(id));
            });

            set({
                result,
                isLoadingHistory: false,
                highlightedPath: {
                    nodeIds: Array.from(nodeIds),
                    edgeIds: Array.from(edgeIds),
                },
            });
        } catch (err) {
            set({
                isLoadingHistory: false,
                error: err instanceof Error ? err.message : '이력 로드 실패',
            });
        }
    },
}));
