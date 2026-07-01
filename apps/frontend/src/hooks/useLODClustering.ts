/**
 * LOD 클러스터링을 위한 React 훅.
 *
 * Web Worker를 통해 메인 스레드를 블로킹하지 않고
 * 국가별 노드 클러스터링을 수행한다.
 *
 * 줌 레벨과 무관하게 enabled 플래그로만 클러스터링 여부를 제어한다.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SupplyChainNode } from '@navigator/shared';
import { toClusterableNodes, type LODResult, LOD_THRESHOLDS } from '../utils/clustering';
import type { WorkerMessage, WorkerResponse } from '../workers/layout-worker';

export interface UseLODClusteringOptions {
    nodes: SupplyChainNode[];
    riskScores: Map<string, number>;
    /** 하위 호환을 위해 유지 — 클러스터링 트리거에는 사용되지 않음 */
    zoomLevel?: number;
    /** true이면 클러스터링 수행, false이면 개별 노드 표시 */
    enabled?: boolean;
}

export interface UseLODClusteringResult {
    lodResult: LODResult | null;
    isComputing: boolean;
    isClustered: boolean;
}

let requestCounter = 0;

/**
 * Web Worker 기반 LOD 클러스터링 훅.
 *
 * - enabled가 true로 바뀌면 Worker에 클러스터링 연산 요청
 * - enabled가 false이면 빈 결과 반환 (개별 노드 표시)
 * - Worker 생성/파괴 라이프사이클 자동 관리
 */
export function useLODClustering({
    nodes,
    riskScores,
    enabled = false,
}: UseLODClusteringOptions): UseLODClusteringResult {
    const workerRef = useRef<Worker | null>(null);
    const [lodResult, setLodResult] = useState<LODResult | null>(null);
    const [isComputing, setIsComputing] = useState(false);
    const latestRequestId = useRef<string>('');

    // Worker 초기화
    useEffect(() => {
        const worker = new Worker(
            new URL('../workers/layout-worker.ts', import.meta.url),
            { type: 'module' },
        );

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const { type, payload, requestId } = event.data;

            // 최신 요청의 응답만 처리
            if (requestId !== latestRequestId.current) return;

            if (type === 'clusters-result') {
                setLodResult(payload as LODResult);
                setIsComputing(false);
            } else if (type === 'error') {
                console.warn('LOD Worker 에러:', (payload as { message: string }).message);
                setIsComputing(false);
            }
        };

        worker.onerror = (error) => {
            console.error('LOD Worker 실행 에러:', error);
            setIsComputing(false);
        };

        workerRef.current = worker;

        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    // 클러스터링 계산 요청
    const requestClustering = useCallback(() => {
        if (!workerRef.current || nodes.length === 0) return;

        const requestId = `req-${++requestCounter}`;
        latestRequestId.current = requestId;
        setIsComputing(true);

        const clusterableNodes = toClusterableNodes(nodes, riskScores);

        const message: WorkerMessage = {
            type: 'compute-clusters',
            // zoomLevel은 Worker 내부에서 사용하지 않으므로 0 전달
            payload: { nodes: clusterableNodes, zoomLevel: 0 },
            requestId,
        };

        workerRef.current.postMessage(message);
    }, [nodes, riskScores]);

    // enabled 또는 노드 변경 시 클러스터링 재계산
    useEffect(() => {
        if (!enabled) {
            setLodResult(null);
            return;
        }
        requestClustering();
    }, [enabled, requestClustering]);

    // enabled이고 클러스터 결과가 있을 때만 클러스터링 활성
    const isClustered = enabled && (lodResult?.clusters.length ?? 0) > 0;

    return {
        lodResult,
        isComputing,
        isClustered,
    };
}

// 하위 호환을 위해 LOD_THRESHOLDS re-export
export { LOD_THRESHOLDS };
