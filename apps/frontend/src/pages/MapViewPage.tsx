import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { MapView } from '../components/MapView';
import { FilterBar } from '../components/FilterBar';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { ViewSwitcher } from '../components/ViewSwitcher';
import { RiskScore } from '@navigator/shared/src/types/risk';

/**
 * GIS 지도 뷰 페이지 (Phase 2).
 * Deck.gl 기반 세계 지도에 14개 마스터 노드와 물류 경로를 시각화한다.
 * GraphView와 동일한 Zustand 스토어를 공유하여 상태 동기화를 유지한다.
 */
export function MapViewPage() {
    const { nodes, edges, selectedNodeId, filters, riskScores, setNodes, setEdges, setRiskScores, selectNode, setLoading, isLoading } =
        useSupplyChainStore();

    const [error, setError] = useState<string | null>(null);

    // 백엔드 API에서 그래프 데이터 로딩
    useEffect(() => {
        // 이미 데이터가 로드되어 있으면 건너뛰기 (뷰 전환 시 재요청 방지)
        if (nodes.length > 0) return;

        const fetchGraphData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/graph');
                if (!response.ok) throw new Error(`API 에러: ${response.status}`);
                const data = await response.json();

                // Date 문자열을 Date 객체로 변환
                const parsedNodes = (data.nodes || []).map((n: Record<string, unknown>) => ({
                    ...n,
                    createdAt: new Date(n.createdAt as string),
                    updatedAt: new Date(n.updatedAt as string),
                }));
                const parsedEdges = (data.edges || []).map((e: Record<string, unknown>) => ({
                    ...e,
                    createdAt: new Date(e.createdAt as string),
                    updatedAt: new Date(e.updatedAt as string),
                }));

                setNodes(parsedNodes);
                setEdges(parsedEdges);
            } catch (err) {
                setError(err instanceof Error ? err.message : '데이터 로딩 실패');
            } finally {
                setLoading(false);
            }
        };

        fetchGraphData();
    }, [nodes.length, setNodes, setEdges, setLoading]);

    // 리스크 점수 로딩
    useEffect(() => {
        if (nodes.length === 0) return;

        const fetchRiskScores = async () => {
            try {
                const response = await fetch('/api/risk/recalculate', { method: 'POST' });
                if (!response.ok) return;
                const scores: RiskScore[] = await response.json();
                setRiskScores(scores);
            } catch {
                console.warn('리스크 점수 로딩 실패 - 기본값 사용');
            }
        };

        fetchRiskScores();
    }, [nodes]);

    // 리스크 점수를 nodeId → score Map으로 변환
    const riskScoreMap = useMemo(() => {
        const map = new Map<string, number>();
        riskScores
            .filter((rs) => rs.entityType === 'node')
            .forEach((rs) => map.set(rs.entityId, rs.score));
        return map;
    }, [riskScores]);

    // 필터링된 노드
    const filteredNodes = useMemo(() => {
        return nodes.filter((node) => {
            if (filters.nodeTypes.length > 0 && !filters.nodeTypes.includes(node.type)) {
                return false;
            }
            if (filters.countries.length > 0 && node.country !== 'NA' && !filters.countries.includes(node.country)) {
                return false;
            }
            if (filters.riskLevel !== 'all') {
                const score = riskScoreMap.get(node.id) ?? 0;
                switch (filters.riskLevel) {
                    case 'low':
                        if (score > 33) return false;
                        break;
                    case 'medium':
                        if (score < 34 || score > 66) return false;
                        break;
                    case 'high':
                        if (score < 67) return false;
                        break;
                }
            }
            return true;
        });
    }, [nodes, filters.nodeTypes, filters.countries, filters.riskLevel, riskScoreMap]);

    // 필터링된 엣지
    const filteredEdges = useMemo(() => {
        const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
        return edges.filter(
            (edge) => filteredNodeIds.has(edge.sourceNodeId) && filteredNodeIds.has(edge.targetNodeId),
        );
    }, [edges, filteredNodes]);

    // 노드 클릭 핸들러
    const handleNodeClick = useCallback(
        (nodeId: string) => {
            selectNode(nodeId === selectedNodeId ? null : nodeId);
        },
        [selectNode, selectedNodeId],
    );

    // 패널 닫기 핸들러
    const handleClosePanel = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    // 선택된 노드 정보
    const selectedNode = useMemo(
        () => nodes.find((n) => n.id === selectedNodeId),
        [nodes, selectedNodeId],
    );

    // 선택된 노드에 연결된 엣지
    const connectedEdges = useMemo(
        () =>
            selectedNodeId
                ? edges.filter(
                    (e) =>
                        e.sourceNodeId === selectedNodeId ||
                        e.targetNodeId === selectedNodeId,
                )
                : [],
        [edges, selectedNodeId],
    );

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Mineral Chain Navigator</h1>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#666' }}>
                        리튬(HS 2825.20) 공급망 GIS 지도 시각화 • 노드: {filteredNodes.length}/{nodes.length} | 엣지: {filteredEdges.length}/{edges.length}
                    </p>
                </div>
                {/* 뷰 전환 스위처 */}
                <ViewSwitcher currentView="map" />
            </header>

            {/* 필터 컨트롤 바 */}
            <FilterBar />

            <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {/* 로딩 상태 */}
                {isLoading && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.8)',
                        zIndex: 10,
                    }}>
                        <p>지도 데이터 로딩 중...</p>
                    </div>
                )}

                {/* 에러 상태 */}
                {error && (
                    <div style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '0.75rem 1.5rem',
                        background: '#fff2f0',
                        border: '1px solid #ffccc7',
                        borderRadius: '4px',
                        zIndex: 10,
                    }}>
                        <span style={{ color: '#cf1322' }}>⚠ {error}</span>
                    </div>
                )}

                {/* 지도 렌더러 */}
                {filteredNodes.length > 0 && (
                    <MapView
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        riskScores={riskScoreMap}
                        onNodeClick={handleNodeClick}
                    />
                )}

                {/* 필터 결과 없음 */}
                {!isLoading && nodes.length > 0 && filteredNodes.length === 0 && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <p style={{ color: '#999', fontSize: '0.9rem' }}>
                            필터 조건에 맞는 노드가 없습니다.
                        </p>
                    </div>
                )}

                {/* 노드 상세 패널 */}
                {selectedNode && (
                    <NodeDetailPanel
                        node={selectedNode}
                        connectedEdges={connectedEdges}
                        riskScore={riskScoreMap.get(selectedNode.id)}
                        onClose={handleClosePanel}
                    />
                )}
            </main>
        </div>
    );
}
