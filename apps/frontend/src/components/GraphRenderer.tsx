import { useEffect, useRef, useCallback, useState } from 'react';
import { Graph } from '@antv/g6';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { getRiskColor, getNodeRadius } from '../utils/graph-helpers';
import { useLODClustering } from '../hooks/useLODClustering';
import type { ClusterResult } from '../utils/clustering';

export interface GraphRendererProps {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
    riskScores: Map<string, number>;
    onNodeClick?: (nodeId: string) => void;
}

/**
 * @antv/G6 v5 기반 Force-directed 그래프 렌더러.
 * - production_capacity에 비례하는 노드 크기
 * - 리스크 점수 기반 색상 코딩 (green/yellow/red)
 * - Canvas 렌더링으로 60fps 최적화
 * - LOD (Level of Detail) 클러스터링: 줌 아웃 시 국가별 노드 집계
 * - Web Worker 기반 레이아웃 계산 오프로드
 */
export function GraphRenderer({ nodes, edges, riskScores, onNodeClick }: GraphRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1.2);

    // 노드 클릭 핸들러를 ref로 보관 (리렌더링 방지)
    const onNodeClickRef = useRef(onNodeClick);
    onNodeClickRef.current = onNodeClick;

    // LOD 클러스터링 (Web Worker 기반)
    const { lodResult, isClustered } = useLODClustering({
        nodes,
        riskScores,
        zoomLevel,
        enabled: true,
    });

    // G6 데이터 형식으로 변환 (LOD 클러스터링 적용)
    const buildGraphData = useCallback(() => {
        // 클러스터링이 활성화된 경우: 클러스터 + 개별 노드 혼합
        if (isClustered && lodResult) {
            const g6Nodes = [];

            // 클러스터 노드 생성
            for (const cluster of lodResult.clusters) {
                g6Nodes.push(buildClusterNode(cluster));
            }

            // 개별 표시 노드
            for (const nodeId of lodResult.visibleNodes) {
                const node = nodes.find((n) => n.id === nodeId);
                if (node) {
                    g6Nodes.push(buildRegularNode(node, riskScores));
                }
            }

            // 클러스터 간 및 클러스터-노드 간 엣지 생성
            const g6Edges = buildClusteredEdges(edges, lodResult, nodes);

            return { nodes: g6Nodes, edges: g6Edges };
        }

        // 클러스터링 비활성: 모든 노드 개별 렌더링
        const g6Nodes = nodes.map((node) => buildRegularNode(node, riskScores));

        const g6Edges = edges.map((edge) => ({
            id: edge.id,
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
            data: {
                edgeType: edge.type,
                volume: edge.attributes.volume,
            },
        }));

        return { nodes: g6Nodes, edges: g6Edges };
    }, [nodes, edges, riskScores, isClustered, lodResult]);

    // 초기 렌더 완료 여부 — afterrender에서 불필요한 재렌더 방지
    const isInitialRenderRef = useRef(true);

    // G6 그래프 인스턴스 초기화 (노드/엣지 원본 데이터 변경 시만 재생성)
    useEffect(() => {
        if (!containerRef.current || nodes.length === 0) return;

        // 기존 그래프 정리
        if (graphRef.current) {
            graphRef.current.destroy();
            graphRef.current = null;
        }

        isInitialRenderRef.current = true;
        const container = containerRef.current;
        const data = buildGraphData();

        const graph = new Graph({
            container,
            autoResize: true,
            // Force-directed 레이아웃
            layout: {
                type: 'd3-force',
                preventOverlap: true,
                linkDistance: 150,
                nodeStrength: -400,
                collide: {
                    strength: 0.8,
                },
            },
            // 노드 스타일 매핑 — data 속성 기반 동적 스타일
            node: {
                type: 'circle',
                style: {
                    size: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.size as number) || 30;
                    },
                    fill: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.color as string) || '#91d5ff';
                    },
                    stroke: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.stroke as string) || '#096dd9';
                    },
                    lineWidth: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        // 클러스터 노드는 두꺼운 테두리
                        return (nodeData?.isCluster as boolean) ? 3 : 2;
                    },
                    lineDash: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        // 클러스터 노드는 점선 테두리
                        return (nodeData?.isCluster as boolean) ? [4, 4] : [0, 0];
                    },
                    labelText: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.label as string) || '';
                    },
                    labelFontSize: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.isCluster as boolean) ? 12 : 10;
                    },
                    labelFontWeight: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.isCluster as boolean) ? 'bold' : 'normal';
                    },
                    labelFill: '#333',
                    labelPlacement: 'bottom',
                    labelOffsetY: 4,
                },
                // 상태별 스타일 (호버, 선택)
                state: {
                    selected: {
                        stroke: '#1890ff',
                        lineWidth: 4,
                        shadowColor: 'rgba(24, 144, 255, 0.4)',
                        shadowBlur: 10,
                    },
                    hover: {
                        lineWidth: 3,
                        shadowColor: 'rgba(0, 0, 0, 0.15)',
                        shadowBlur: 6,
                    },
                },
            },
            // 엣지 기본 스타일 — 방향성 화살표 포함
            edge: {
                type: 'line',
                style: {
                    stroke: '#bfbfbf',
                    lineWidth: 1.5,
                    endArrow: true,
                    endArrowSize: 6,
                },
                state: {
                    highlight: {
                        stroke: '#1890ff',
                        lineWidth: 2.5,
                    },
                },
            },
            // 상호작용 동작
            behaviors: [
                'drag-canvas',
                'zoom-canvas',
                'drag-element',
            ],
            // 줌 범위 제한 (최소 0.5, 최대 3.0)
            zoomRange: [0.5, 3.0],
            // 자동 뷰핏
            autoFit: 'view',
            // 데이터 설정
            data,
        });

        graphRef.current = graph;

        // 노드 클릭 이벤트 바인딩
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        graph.on('node:click', (event: any) => {
            const targetId = event?.target?.id;
            if (onNodeClickRef.current && targetId) {
                onNodeClickRef.current(targetId);
            }
        });

        // 줌 변경 시 LOD 업데이트 (사용자 휠 인터랙션에 의한 줌만 처리)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        graph.on('canvas:wheel' as any, () => {
            try {
                const currentZoom = graph.getZoom?.() ?? 1.0;
                setZoomLevel(currentZoom);
            } catch {
                // zoom 변경 감지 실패 시 무시
            }
        });

        // 비동기 렌더링 실행
        graph.render();
        // 초기 렌더 완료 표시 (LOD effect 활성화)
        isInitialRenderRef.current = false;

        return () => {
            if (graphRef.current) {
                graphRef.current.destroy();
                graphRef.current = null;
            }
        };
        // 의존성: 원본 데이터(nodes, edges, riskScores)가 변경될 때만 그래프 재생성
        // buildGraphData를 의존성에서 제거하여 LOD 상태 변경으로 인한 불필요한 재생성 방지
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, riskScores]);

    // 이전 클러스터링 상태 추적 (전환 방향 판별용)
    const prevIsClusteredRef = useRef(isClustered);

    // LOD 클러스터링 변경 시 그래프 데이터 업데이트
    useEffect(() => {
        if (!graphRef.current || nodes.length === 0) return;
        // 초기 렌더 중에는 무시 (위 effect에서 이미 데이터 설정됨)
        if (isInitialRenderRef.current) return;

        const graph = graphRef.current;
        const data = buildGraphData();
        const wasClusteredBefore = prevIsClusteredRef.current;
        prevIsClusteredRef.current = isClustered;

        // 클러스터 → 개별 전환: force-layout 재실행 (노드가 겹치지 않도록)
        const needsLayout = wasClusteredBefore && !isClustered;

        try {
            if (needsLayout) {
                // force-layout으로 노드를 다시 분산 배치
                graph.setData(data);
                graph.render();
            } else {
                // 개별 → 클러스터 전환: 위치 보존
                const positionMap = new Map<string, { x: number; y: number }>();
                const currentData = graph.getData();
                for (const node of currentData.nodes || []) {
                    const id = (node as Record<string, unknown>).id as string;
                    const style = (node as Record<string, unknown>).style as Record<string, unknown> | undefined;
                    if (id && style?.x != null && style?.y != null) {
                        positionMap.set(id, { x: style.x as number, y: style.y as number });
                    }
                }

                for (const node of data.nodes) {
                    const nodeAny = node as Record<string, unknown>;
                    const nodeId = nodeAny.id as string;
                    const nodeData = nodeAny.data as Record<string, unknown> | undefined;

                    if (positionMap.has(nodeId)) {
                        const pos = positionMap.get(nodeId)!;
                        nodeAny.style = { ...((nodeAny.style as Record<string, unknown>) || {}), x: pos.x, y: pos.y };
                    } else if (nodeData?.isCluster && nodeData?.memberNodeIds) {
                        const memberIds = nodeData.memberNodeIds as string[];
                        let sumX = 0, sumY = 0, count = 0;
                        for (const mid of memberIds) {
                            if (positionMap.has(mid)) {
                                const p = positionMap.get(mid)!;
                                sumX += p.x;
                                sumY += p.y;
                                count++;
                            }
                        }
                        if (count > 0) {
                            nodeAny.style = { ...((nodeAny.style as Record<string, unknown>) || {}), x: sumX / count, y: sumY / count };
                        }
                    }
                }

                graph.setData(data);
                graph.draw();
            }
        } catch {
            // 그래프 인스턴스 파괴 중 호출되면 무시
        }
    }, [isClustered, lodResult, buildGraphData, nodes.length]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
            }}
            aria-label="리튬 공급망 그래프 시각화"
            role="img"
        >
            {/* 줌 레벨 표시 */}
            <div
                style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    color: '#333',
                    zIndex: 5,
                }}
            >
                줌: {zoomLevel.toFixed(2)}
            </div>
        </div>
    );
}

/**
 * 일반 노드를 G6 데이터 형식으로 변환.
 */
function buildRegularNode(
    node: SupplyChainNode,
    riskScores: Map<string, number>,
) {
    const riskScore = riskScores.get(node.id) ?? 0;
    const color = getRiskColor(riskScore);
    const radius = getNodeRadius(node.metadata.productionCapacity, node.metadata.capacityUnit);

    return {
        id: node.id,
        data: {
            nodeType: node.type,
            country: node.country,
            riskScore,
            label: node.name,
            size: radius * 2,
            color: color.fill,
            stroke: color.stroke,
            isCluster: false,
        },
    };
}

/**
 * 클러스터 노드를 G6 데이터 형식으로 변환.
 * 클러스터는 멤버 수에 비례하는 큰 원으로 표시하며, 점선 테두리로 구분한다.
 */
function buildClusterNode(cluster: ClusterResult) {
    const color = getRiskColor(cluster.averageRiskScore);

    // 클러스터 크기: 멤버 수에 비례 (최소 60px, 최대 120px)
    const clusterSize = Math.min(120, Math.max(60, 40 + cluster.memberCount * 15));

    return {
        id: cluster.id,
        data: {
            nodeType: 'cluster',
            country: cluster.country,
            riskScore: cluster.averageRiskScore,
            label: cluster.label,
            size: clusterSize,
            color: color.fill,
            stroke: color.stroke,
            isCluster: true,
            memberCount: cluster.memberCount,
            memberNodeIds: cluster.memberNodeIds,
        },
    };
}

/**
 * 클러스터링 상태에서 엣지를 재매핑.
 * 클러스터에 포함된 노드 간 엣지는 클러스터 간 엣지로 병합한다.
 */
function buildClusteredEdges(
    originalEdges: SupplyChainEdge[],
    lodResult: { clusters: ClusterResult[]; visibleNodes: string[] },
    _nodes: SupplyChainNode[],
) {
    // 노드ID → 소속 클러스터ID 매핑
    const nodeToCluster = new Map<string, string>();
    for (const cluster of lodResult.clusters) {
        for (const memberId of cluster.memberNodeIds) {
            nodeToCluster.set(memberId, cluster.id);
        }
    }

    // 중복 엣지 제거를 위한 세트
    const edgeSet = new Set<string>();
    const g6Edges: Array<{
        id: string;
        source: string;
        target: string;
        data: { edgeType: string; volume?: number; isMerged: boolean };
    }> = [];

    for (const edge of originalEdges) {
        // 소스/타겟을 클러스터 또는 개별 노드로 매핑
        const source = nodeToCluster.get(edge.sourceNodeId) || edge.sourceNodeId;
        const target = nodeToCluster.get(edge.targetNodeId) || edge.targetNodeId;

        // 같은 클러스터 내부 엣지는 생략
        if (source === target) continue;

        // 소스/타겟이 실제 존재하는 노드/클러스터인지 확인
        const visibleSet = new Set([
            ...lodResult.visibleNodes,
            ...lodResult.clusters.map((c) => c.id),
        ]);
        if (!visibleSet.has(source) || !visibleSet.has(target)) continue;

        // 중복 엣지 방지
        const edgeKey = `${source}->${target}`;
        if (edgeSet.has(edgeKey)) continue;
        edgeSet.add(edgeKey);

        g6Edges.push({
            id: `clustered-${edge.id}`,
            source,
            target,
            data: {
                edgeType: edge.type,
                volume: edge.attributes.volume,
                isMerged: source !== edge.sourceNodeId || target !== edge.targetNodeId,
            },
        });
    }

    return g6Edges;
}
