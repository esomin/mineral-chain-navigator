import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Graph } from '@antv/g6';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { getNodeRadius, getCountryColor, getRiskStroke } from '../utils/graph-helpers';
import { useLODClustering } from '../hooks/useLODClustering';
import type { ClusterResult } from '../utils/clustering';

export interface GraphRendererProps {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
    riskScores: Map<string, number>;
    onNodeClick?: (nodeId: string) => void;
    highlightedPath?: {
        nodeIds: string[];
        edgeIds: string[];
    } | null;
}

/**
 * @antv/G6 v5 기반 Force-directed 그래프 렌더러.
 * - production_capacity에 비례하는 노드 크기
 * - 리스크 점수 기반 색상 코딩 (green/yellow/red)
 * - Canvas 렌더링으로 60fps 최적화
 * - LOD 국가별 클러스터링: 우상단 버튼으로 토글 (정사각형 표시)
 * - Web Worker 기반 레이아웃 계산 오프로드
 */
export function GraphRenderer({ nodes, edges, riskScores, onNodeClick, highlightedPath }: GraphRendererProps) {
    // 복잡도 감소를 위해 'Resource' 노드 및 관련 엣지 필터링
    const filteredNodes = useMemo(() => nodes.filter((n) => n.type !== 'Resource'), [nodes]);
    const filteredEdges = useMemo(() => {
        const resourceNodeIds = new Set(nodes.filter((n) => n.type === 'Resource').map((n) => n.id));
        return edges.filter((e) => !resourceNodeIds.has(e.sourceNodeId) && !resourceNodeIds.has(e.targetNodeId));
    }, [nodes, edges]);

    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1.2);
    // 클러스터링 토글 버튼 상태 — 버튼으로만 제어
    const [clusteringEnabled, setClusteringEnabled] = useState(false);
    // 그래프의 비동기 render가 완료되었는지 여부
    const [isGraphReady, setIsGraphReady] = useState(false);

    // 노드 클릭 핸들러를 ref로 보관 (리렌더링 방지)
    const onNodeClickRef = useRef(onNodeClick);
    onNodeClickRef.current = onNodeClick;

    // LOD 클러스터링 (Web Worker 기반) — enabled = 버튼 state로만 제어
    const { lodResult, isClustered } = useLODClustering({
        nodes: filteredNodes,
        riskScores,
        enabled: clusteringEnabled,
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
                const node = filteredNodes.find((n) => n.id === nodeId);
                if (node) {
                    g6Nodes.push(buildRegularNode(node, riskScores));
                }
            }

            // 클러스터 간 및 클러스터-노드 간 엣지 생성
            const g6Edges = buildClusteredEdges(filteredEdges, lodResult, filteredNodes);

            return { nodes: g6Nodes, edges: g6Edges };
        }

        // 클러스터링 비활성: 모든 노드 개별 렌더링
        const g6Nodes = filteredNodes.map((node) => buildRegularNode(node, riskScores));

        const g6Edges = filteredEdges.map((edge) => ({
            id: edge.id,
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
            data: {
                edgeType: edge.type,
                volume: edge.attributes.volume,
            },
        }));

        return { nodes: g6Nodes, edges: g6Edges };
    }, [filteredNodes, filteredEdges, riskScores, isClustered, lodResult]);

    // 초기 렌더 완료 여부 — afterrender에서 불필요한 재렌더 방지
    const isInitialRenderRef = useRef(true);

    // G6 그래프 인스턴스 초기화 (노드/엣지 원본 데이터 변경 시만 재생성)
    useEffect(() => {
        if (!containerRef.current || filteredNodes.length === 0) return;

        // 기존 그래프 정리
        if (graphRef.current) {
            graphRef.current.destroy();
            graphRef.current = null;
        }

        isInitialRenderRef.current = true;
        setIsGraphReady(false);
        const container = containerRef.current;
        const data = buildGraphData();

        const graph = new Graph({
            container,
            autoResize: true,
            // Force-directed 레이아웃
            layout: {
                type: 'd3-force',
                preventOverlap: true,
                linkDistance: (edge: any) => {
                    const edgeType = edge.data?.edgeType; // 'Supply' | 'Delivery'
                    const volume = edge.data?.volume ?? 0;

                    // 1. 타입별 기본 거리 설정
                    let baseDistance = edgeType === 'Supply' ? 150 : 300;

                    // 2. 속성(거래량)별 가중치 조절: 거래량이 클수록 긴밀한 관계이므로 노드 거리를 단축 (최대 40px)
                    if (volume > 0) {
                        const maxReduction = 40;
                        const minVol = 1000;
                        const maxVol = 50000000;
                        const logVol = Math.log(Math.max(minVol, Math.min(maxVol, volume)));
                        const logMin = Math.log(minVol);
                        const logMax = Math.log(maxVol);
                        const reduction = ((logVol - logMin) / (logMax - logMin)) * maxReduction;
                        baseDistance -= reduction;
                    }

                    return baseDistance;
                },
                nodeStrength: -400,
                collide: {
                    strength: 0.8,
                },
            },
            // 노드 스타일 매핑 — data 속성 기반 동적 스타일
            // 클러스터 노드: 원(circle), 일반 노드: 원(circle)
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
                        return (nodeData?.strokeWidth as number) || 2;
                    },
                    // 클러스터 정사각형: 실선 테두리, 일반 노드: 점선 없음
                    lineDash: () => [0, 0],
                    // 클러스터 노드 불투명 배경
                    fillOpacity: () => 1,
                    labelText: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.label as string) || '';
                    },
                    labelFontSize: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.isCluster as boolean) ? 13 : 10;
                    },
                    labelFontWeight: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.isCluster as boolean) ? 'bold' : 'normal';
                    },
                    labelFill: '#333',
                    labelPlacement: 'bottom',
                    labelOffsetY: 4,
                },
                // 상태별 스타일 (호버, 선택, 전파경로)
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
                    propagation: {
                        stroke: '#ff4d4f',
                        lineWidth: 4,
                        shadowColor: 'rgba(255, 77, 79, 0.6)',
                        shadowBlur: 12,
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
                    propagation: {
                        stroke: '#ff4d4f',
                        lineWidth: 3,
                        lineDash: [6, 3],
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
        let active = true;
        graph.render()
            .then(() => {
                if (active && !graph.destroyed) {
                    setIsGraphReady(true);
                }
            })
            .catch((err) => {
                console.warn('G6 render failed or was interrupted:', err);
            });

        return () => {
            active = false;
            setIsGraphReady(false);
            if (graphRef.current) {
                graphRef.current.destroy();
                graphRef.current = null;
            }
        };
        // 의존성: 원본 데이터(nodes, edges, riskScores)가 변경될 때만 그래프 재생성
        // buildGraphData를 의존성에서 제거하여 LOD 상태 변경으로 인한 불필요한 재생성 방지
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredNodes, filteredEdges, riskScores]);

    // LOD 클러스터링 변경 시 그래프 데이터 업데이트
    useEffect(() => {
        if (!graphRef.current || graphRef.current.destroyed || !isGraphReady || filteredNodes.length === 0) return;
        // 초기 렌더 중에는 무시 (위 effect에서 이미 데이터 설정됨)
        if (isInitialRenderRef.current) {
            isInitialRenderRef.current = false;
            return;
        }

        const graph = graphRef.current;
        // 실행 중인 레이아웃 계산 중단 (force-layout 무한 틱 및 데이터 충돌 방지)
        graph.stopLayout?.();
        const data = buildGraphData();

        try {
            graph.setData(data);
            graph.render().catch(() => { });
        } catch {
            // 그래프 인스턴스 파괴 중 호출되면 무시
        }
    }, [isClustered, lodResult, buildGraphData, filteredNodes.length, isGraphReady]);

    // 전파 경로 하이라이트 효과: highlightedPath 변경 시 노드/엣지 상태 토글
    useEffect(() => {
        if (!graphRef.current || graphRef.current.destroyed || !isGraphReady) return;
        const graph = graphRef.current;

        try {
            const data = graph.getData();

            // 기존 propagation 상태 제거
            for (const node of data.nodes || []) {
                const nodeId = (node as Record<string, unknown>).id as string;
                if (nodeId) {
                    graph.setElementState(nodeId, []);
                }
            }
            for (const edge of data.edges || []) {
                const edgeId = (edge as Record<string, unknown>).id as string;
                if (edgeId) {
                    graph.setElementState(edgeId, []);
                }
            }

            // 새로운 전파 경로가 있으면 propagation 상태 적용
            if (highlightedPath) {
                for (const nodeId of highlightedPath.nodeIds) {
                    try {
                        graph.setElementState(nodeId, ['propagation']);
                    } catch {
                        // 노드가 현재 그래프에 없으면 무시
                    }
                }
                for (const edgeId of highlightedPath.edgeIds) {
                    try {
                        graph.setElementState(edgeId, ['propagation']);
                    } catch {
                        // 엣지가 현재 그래프에 없으면 무시
                    }
                }
            }
        } catch {
            // 그래프 인스턴스 파괴 중 호출 시 무시
        }
    }, [highlightedPath, isGraphReady]);

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
            {/* 우상단 컨트롤: 줌 레벨 표시 + 클러스터링 토글 버튼 (세로 배치) */}
            <div
                style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '1.0rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '0.25rem',
                    zIndex: 5,
                }}
            >
                {/* 줌 레벨 표시 */}
                <div
                    style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        color: '#333',
                        textAlign: 'center',
                    }}
                >
                    Zoom: {zoomLevel.toFixed(2)}
                </div>

                {/* 국가별 클러스터링 토글 버튼 — 줌 표시와 동일 가로 길이의 정사각형 */}
                <button
                    onClick={() => setClusteringEnabled((prev) => !prev)}
                    aria-pressed={clusteringEnabled}
                    title={clusteringEnabled ? 'Country Level Clustering 해제' : 'Country Level Clustering 활성화'}
                    style={{
                        aspectRatio: '1 / 1',
                        width: '100%',
                        borderRadius: '4px',
                        border: clusteringEnabled ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        background: clusteringEnabled ? '#e6f7ff' : 'rgba(255,255,255,0.9)',
                        color: clusteringEnabled ? '#1890ff' : '#aaa',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        lineHeight: 1.3,
                        padding: '6px 4px',
                    }}
                >
                    <span style={{ fontSize: '0.65rem', fontWeight: clusteringEnabled ? 'bold' : 'normal', textAlign: 'center' }}>
                        Country Level
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: clusteringEnabled ? 'bold' : 'normal', textAlign: 'center' }}>
                        Clustering
                    </span>
                </button>
            </div>
        </div>
    );
}

/** 노드 타입 영-한 매핑 */
const NODE_TYPE_LABEL_KO: Record<string, string> = {
    Resource: '자원',
    Mine: '광산',
    Refinery: '정제소',
    Factory: '공장',
};

/** 국가 영-한 매핑 */
const COUNTRY_LABEL_KO: Record<string, string> = {
    SouthKorea: '한국',
    Japan: '일본',
    China: '중국',
    Chile: '칠레',
    UnitedStates: '미국',
    NA: '기타',
};

/**
 * 일반 노드를 G6 데이터 형식으로 변환.
 */
function buildRegularNode(
    node: SupplyChainNode,
    riskScores: Map<string, number>,
) {
    const riskScore = riskScores.get(node.id) ?? 0;
    const countryColor = getCountryColor(node.country);
    const riskStroke = getRiskStroke(riskScore);
    const radius = getNodeRadius(node.metadata.productionCapacity, node.metadata.capacityUnit);

    return {
        id: node.id,
        data: {
            nodeType: node.type,
            country: node.country,
            riskScore,
            label: node.country === 'NA'
                ? `${node.name}\n(${NODE_TYPE_LABEL_KO[node.type] ?? node.type})`
                : `${node.name}\n(${COUNTRY_LABEL_KO[node.country] ?? node.country}, ${NODE_TYPE_LABEL_KO[node.type] ?? node.type})`,
            size: radius * 2,
            color: countryColor,
            riskFill: riskStroke.fill,
            stroke: riskStroke.stroke,
            strokeWidth: riskStroke.width,
            isCluster: false,
        },
    };
}

/**
 * 클러스터 노드를 G6 데이터 형식으로 변환.
 * 클러스터는 멤버 수에 비례하는 큰 원으로 표시하며, 점선 테두리로 구분한다.
 */
function buildClusterNode(cluster: ClusterResult) {
    const countryColor = getCountryColor(cluster.country);
    const riskStroke = getRiskStroke(cluster.averageRiskScore);

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
            color: countryColor,
            riskFill: riskStroke.fill,
            stroke: riskStroke.stroke,
            strokeWidth: riskStroke.width,
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
