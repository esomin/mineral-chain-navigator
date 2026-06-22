/**
 * Web Worker: 레이아웃 계산 오프로드.
 *
 * 메인 스레드 블로킹을 방지하기 위해
 * LOD 클러스터링 연산을 별도 스레드에서 수행한다.
 *
 * 지원하는 메시지 타입:
 * - compute-clusters: 줌 레벨에 따른 LOD 클러스터링 계산
 * - compute-layout: 노드 위치 기반 Force-directed 레이아웃 좌표 계산
 */

import {
    computeLODClusters,
    type ClusterableNode,
    type LODResult,
} from '../utils/clustering';

// Worker 메시지 타입 정의
export interface WorkerMessage {
    type: 'compute-clusters' | 'compute-layout';
    payload: ComputeClustersPayload | ComputeLayoutPayload;
    requestId: string;
}

export interface ComputeClustersPayload {
    nodes: ClusterableNode[];
    zoomLevel: number;
}

export interface ComputeLayoutPayload {
    nodes: Array<{ id: string; x: number; y: number; size: number }>;
    edges: Array<{ source: string; target: string }>;
    width: number;
    height: number;
    iterations?: number;
}

// 레이아웃 결과
export interface LayoutResult {
    positions: Array<{ id: string; x: number; y: number }>;
}

// Worker 응답 타입
export interface WorkerResponse {
    type: 'clusters-result' | 'layout-result' | 'error';
    payload: LODResult | LayoutResult | { message: string };
    requestId: string;
}

// Worker 컨텍스트 타입 선언
declare const self: DedicatedWorkerGlobalScope;

/**
 * 간단한 Force-directed 레이아웃 시뮬레이션.
 * G6의 레이아웃과는 별개로, 클러스터 노드 배치에 활용한다.
 */
function computeSimpleForceLayout(payload: ComputeLayoutPayload): LayoutResult {
    const { nodes, edges, width, height, iterations = 50 } = payload;

    // 초기 위치 설정 (기존 좌표 또는 랜덤)
    const positions = nodes.map((n) => ({
        id: n.id,
        x: n.x || Math.random() * width,
        y: n.y || Math.random() * height,
    }));

    // 엣지를 인덱스 매핑으로 변환
    const nodeIndex = new Map(positions.map((p, i) => [p.id, i]));

    const repulsionStrength = 5000;
    const attractionStrength = 0.01;
    const damping = 0.9;

    // 속도 배열
    const velocities = positions.map(() => ({ vx: 0, vy: 0 }));

    for (let iter = 0; iter < iterations; iter++) {
        // 반발력 (모든 노드 쌍)
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[i].x - positions[j].x;
                const dy = positions[i].y - positions[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = repulsionStrength / (dist * dist);

                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                velocities[i].vx += fx;
                velocities[i].vy += fy;
                velocities[j].vx -= fx;
                velocities[j].vy -= fy;
            }
        }

        // 인력 (엣지 연결)
        for (const edge of edges) {
            const si = nodeIndex.get(edge.source);
            const ti = nodeIndex.get(edge.target);
            if (si === undefined || ti === undefined) continue;

            const dx = positions[ti].x - positions[si].x;
            const dy = positions[ti].y - positions[si].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            const fx = dx * attractionStrength;
            const fy = dy * attractionStrength;

            velocities[si].vx += fx;
            velocities[si].vy += fy;
            velocities[ti].vx -= fx;
            velocities[ti].vy -= fy;
        }

        // 위치 업데이트 + 감쇠
        for (let i = 0; i < positions.length; i++) {
            velocities[i].vx *= damping;
            velocities[i].vy *= damping;

            positions[i].x += velocities[i].vx;
            positions[i].y += velocities[i].vy;

            // 경계 제한
            positions[i].x = Math.max(50, Math.min(width - 50, positions[i].x));
            positions[i].y = Math.max(50, Math.min(height - 50, positions[i].y));
        }
    }

    return { positions };
}

// Worker 메시지 핸들러
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const { type, payload, requestId } = event.data;

    try {
        switch (type) {
            case 'compute-clusters': {
                const { nodes, zoomLevel } = payload as ComputeClustersPayload;
                const result = computeLODClusters(nodes, zoomLevel);
                const response: WorkerResponse = {
                    type: 'clusters-result',
                    payload: result,
                    requestId,
                };
                self.postMessage(response);
                break;
            }

            case 'compute-layout': {
                const layoutPayload = payload as ComputeLayoutPayload;
                const result = computeSimpleForceLayout(layoutPayload);
                const response: WorkerResponse = {
                    type: 'layout-result',
                    payload: result,
                    requestId,
                };
                self.postMessage(response);
                break;
            }

            default: {
                const response: WorkerResponse = {
                    type: 'error',
                    payload: { message: `알 수 없는 메시지 타입: ${type}` },
                    requestId,
                };
                self.postMessage(response);
            }
        }
    } catch (error) {
        const response: WorkerResponse = {
            type: 'error',
            payload: {
                message: error instanceof Error ? error.message : '알 수 없는 에러',
            },
            requestId,
        };
        self.postMessage(response);
    }
};
