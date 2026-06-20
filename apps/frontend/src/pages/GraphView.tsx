import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { GraphRenderer } from '../components/GraphRenderer';
import type { RiskScore } from '@navigator/shared';

// 공급망 그래프 시각화 페이지 (Phase 1 메인 뷰)
export function GraphView() {
    const { nodes, edges, selectedNodeId, setNodes, setEdges, selectNode, setLoading, isLoading } =
        useSupplyChainStore();

    const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
    const [error, setError] = useState<string | null>(null);

    // 백엔드 API에서 그래프 데이터 로딩
    useEffect(() => {
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
    }, [setNodes, setEdges, setLoading]);

    // 리스크 점수 로딩 (그래프 데이터 로딩 후)
    useEffect(() => {
        if (nodes.length === 0) return;

        const fetchRiskScores = async () => {
            try {
                const response = await fetch('/api/risk/recalculate', { method: 'POST' });
                if (!response.ok) return;
                const scores: RiskScore[] = await response.json();
                setRiskScores(scores);
            } catch {
                // 리스크 점수 실패 시 기본값(0)으로 렌더링
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

    // 노드 클릭 핸들러
    const handleNodeClick = useCallback(
        (nodeId: string) => {
            selectNode(nodeId === selectedNodeId ? null : nodeId);
        },
        [selectNode, selectedNodeId],
    );

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
            <header style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
                <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Mineral Chain Navigator</h1>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#666' }}>
                    리튬(HS 2825.20) 공급망 그래프 시각화 • 노드: {nodes.length} | 엣지: {edges.length}
                </p>
            </header>

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
                        <p>그래프 데이터 로딩 중...</p>
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

                {/* 그래프 렌더러 */}
                {nodes.length > 0 && (
                    <GraphRenderer
                        nodes={nodes}
                        edges={edges}
                        riskScores={riskScoreMap}
                        onNodeClick={handleNodeClick}
                    />
                )}

                {/* 선택된 노드 상세 패널 */}
                {selectedNode && (
                    <aside
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '340px',
                            height: '100%',
                            background: '#fff',
                            borderLeft: '1px solid #e0e0e0',
                            padding: '1rem',
                            overflowY: 'auto',
                            boxShadow: '-2px 0 8px rgba(0,0,0,0.06)',
                        }}
                        aria-label="노드 상세 정보 패널"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1rem' }}>노드 상세</h2>
                            <button
                                onClick={() => selectNode(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.25rem',
                                    cursor: 'pointer',
                                    color: '#999',
                                }}
                                aria-label="패널 닫기"
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{selectedNode.name}</h3>
                            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#666' }}>
                                {selectedNode.description}
                            </p>

                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '4px 8px', color: '#999' }}>ID</td>
                                        <td style={{ padding: '4px 8px' }}>{selectedNode.id}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '4px 8px', color: '#999' }}>타입</td>
                                        <td style={{ padding: '4px 8px' }}>{selectedNode.type}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '4px 8px', color: '#999' }}>국가</td>
                                        <td style={{ padding: '4px 8px' }}>{selectedNode.country}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '4px 8px', color: '#999' }}>생산능력</td>
                                        <td style={{ padding: '4px 8px' }}>
                                            {selectedNode.metadata.productionCapacity.toLocaleString()}{' '}
                                            {selectedNode.metadata.capacityUnit}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '4px 8px', color: '#999' }}>리스크 점수</td>
                                        <td style={{ padding: '4px 8px' }}>
                                            {riskScoreMap.get(selectedNode.id)?.toFixed(1) ?? 'N/A'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '4px 8px', color: '#999' }}>좌표</td>
                                        <td style={{ padding: '4px 8px' }}>
                                            {selectedNode.coordinates.latitude.toFixed(2)},{' '}
                                            {selectedNode.coordinates.longitude.toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* 연결된 엣지 */}
                            {connectedEdges.length > 0 && (
                                <div style={{ marginTop: '1rem' }}>
                                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
                                        연결 엣지 ({connectedEdges.length})
                                    </h4>
                                    <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.75rem' }}>
                                        {connectedEdges.map((edge) => (
                                            <li key={edge.id} style={{ marginBottom: '4px' }}>
                                                {edge.type}: {edge.sourceNodeId} → {edge.targetNodeId}
                                                {edge.attributes.volume && (
                                                    <span style={{ color: '#999' }}>
                                                        {' '}
                                                        ({edge.attributes.volume.toLocaleString()} kg)
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </aside>
                )}

                {/* 범례 */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: '1rem',
                        left: '1rem',
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                    }}
                    aria-label="리스크 색상 범례"
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>리스크 수준</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#b7eb8f', borderRadius: '50%', border: '1px solid #52c41a' }} />{' '}
                            저위험
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#ffe58f', borderRadius: '50%', border: '1px solid #faad14' }} />{' '}
                            중위험
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#ffa39e', borderRadius: '50%', border: '1px solid #f5222d' }} />{' '}
                            고위험
                        </span>
                    </div>
                </div>
            </main>
        </div>
    );
}
