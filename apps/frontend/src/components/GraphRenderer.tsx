import { useEffect, useRef, useCallback } from 'react';
import { Graph } from '@antv/g6';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { getRiskColor, getNodeRadius } from '../utils/graph-helpers';

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
 */
export function GraphRenderer({ nodes, edges, riskScores, onNodeClick }: GraphRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);

    // 노드 클릭 핸들러를 ref로 보관 (리렌더링 방지)
    const onNodeClickRef = useRef(onNodeClick);
    onNodeClickRef.current = onNodeClick;

    // G6 데이터 형식으로 변환
    const buildGraphData = useCallback(() => {
        const g6Nodes = nodes.map((node) => {
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
                },
            };
        });

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
    }, [nodes, edges, riskScores]);

    // G6 그래프 인스턴스 초기화 및 렌더링
    useEffect(() => {
        if (!containerRef.current || nodes.length === 0) return;

        // 기존 그래프 정리
        if (graphRef.current) {
            graphRef.current.destroy();
            graphRef.current = null;
        }

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
                    lineWidth: 2,
                    labelText: (d: Record<string, unknown>) => {
                        const nodeData = d?.data as Record<string, unknown> | undefined;
                        return (nodeData?.label as string) || '';
                    },
                    labelFontSize: 10,
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

        // 비동기 렌더링 실행
        graph.render();

        return () => {
            if (graphRef.current) {
                graphRef.current.destroy();
                graphRef.current = null;
            }
        };
    }, [buildGraphData, nodes.length]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                minHeight: '400px',
            }}
            aria-label="리튬 공급망 그래프 시각화"
            role="img"
        />
    );
}
