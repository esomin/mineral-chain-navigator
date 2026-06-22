/**
 * LOD 클러스터링을 위한 React 훅.
 *
 * Web Worker를 통해 메인 스레드를 블로킹하지 않고
 * 줌 레벨에 따른 노드 클러스터링을 수행한다.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SupplyChainNode } from '@navigator/shared';
import { toClusterableNodes, type LODResult, LOD_THRESHOLDS } from '../utils/clustering';
import type { WorkerMessage, WorkerResponse } from '../workers/layout-worker';

export interface UseLODClusteringOptions {
    nodes: SupplyChainNode[];
    riskScores: Map<string, number>;
    zoomLevel: number;
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
 * - 줌 레벨이 변경될 때마다 Worker에 클러스터링 연산 요청
 * - Worker 응답을 받아 LODResult 상태 업데이트
 * - Worker 생성/파괴 라이프사이클 자동 관리
 */
export function useLODClustering({
    nodes,
    riskScores,
    zoomLevel,
    enabled = true,
}: UseLODClusteringOptions): UseLODClusteringResult {
    const workerRef = useRef<Worker | null>(null);
    const [lodResult, setLodResult] = useState<LODResult | null>(null);
    const [isComputing, setIsComputing] = useState(false);
    const latestRequestId = useRef<string>('');

    // Worker 초기화
    useEffect(() => {
        if (!enabled) return;

        // Vite의 ?worker import를 사용하여 Worker 생성
        const worker = new Worker(
            new URL('../workers/layout-worker.ts', import.meta.url),
            { type: 'module' },
        );

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const { type, payload, requestId } = event.data;

            // 최신 요청의 응답만 처리 (이전 요청 결과 무시)
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
    }, [enabled]);

    // 클러스터링 계산 요청
    const requestClustering = useCallback(() => {
        if (!workerRef.current || nodes.length === 0) return;

        const requestId = `req-${++requestCounter}`;
        latestRequestId.current = requestId;
        setIsComputing(true);

        // 노드를 직렬화 가능 형식으로 변환
        const clusterableNodes = toClusterableNodes(nodes, riskScores);

        const message: WorkerMessage = {
            type: 'compute-clusters',
            payload: { nodes: clusterableNodes, zoomLevel },
            requestId,
        };

        workerRef.current.postMessage(message);
    }, [nodes, riskScores, zoomLevel]);

    // 줌 레벨 또는 노드 변경 시 클러스터링 재계산
    useEffect(() => {
        if (!enabled) {
            setLodResult(null);
            return;
        }
        requestClustering();
    }, [requestClustering, enabled]);

    // 현재 클러스터링이 활성화된 상태인지
    const isClustered = zoomLevel < LOD_THRESHOLDS.DETAIL_ZOOM && (lodResult?.clusters.length ?? 0) > 0;

    return {
        lodResult,
        isComputing,
        isClustered,
    };
}
