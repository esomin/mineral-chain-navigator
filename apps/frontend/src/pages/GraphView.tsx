import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { useSimulationStore } from '../store/simulation-store';
import { GraphRenderer } from '../components/GraphRenderer';
import { FilterBar } from '../components/FilterBar';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { TraceabilityPanel } from '../components/TraceabilityPanel';
import { SimulationPanel } from '../components/SimulationPanel';
import { ViewSwitcher } from '../components/ViewSwitcher';
import { AIInsightPanel } from '../components/AIInsightPanel';
import { GiDiamonds } from 'react-icons/gi';
// 공급망 그래프 시각화 페이지 (Phase 1 메인 뷰)
export function GraphView() {
    const { nodes, edges, selectedNodeId, filters, riskScores, setNodes, setEdges, setRiskScores, selectNode, setLoading, isLoading } =
        useSupplyChainStore();

    // 시뮬레이션 결과에서 전파 경로 하이라이트 가져오기
    const highlightedPath = useSimulationStore((state) => state.highlightedPath);

    const [error, setError] = useState<string | null>(null);
    // ESG 역추적 패널 표시 상태
    const [showTraceability, setShowTraceability] = useState(false);
    // AI 인사이트 패널 표시 상태
    const [showAIPanel, setShowAIPanel] = useState(false);
    // 시뮬레이션 패널 표시 상태
    const [showSimulation, setShowSimulation] = useState(false);

    // 백엔드 API에서 그래프 데이터 로딩 (이미 로드된 경우 건너뛰기 - 뷰 전환 시 재요청 방지)
    useEffect(() => {
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

    // 리스크 점수 로딩 (그래프 데이터 로딩 후, 이미 로드된 경우 건너뛰기)
    useEffect(() => {
        if (nodes.length === 0) return;
        if (riskScores.length > 0) return;

        const fetchRiskScores = async () => {
            try {
                const response = await fetch('/api/risk/recalculate', { method: 'POST' });
                if (!response.ok) return;
                const scores = await response.json();
                setRiskScores(scores);
            } catch {
                // 리스크 점수 실패 시 기본값(0)으로 렌더링
                console.warn('리스크 점수 로딩 실패 - 기본값 사용');
            }
        };

        fetchRiskScores();
    }, [nodes, riskScores.length, setRiskScores]);

    // 리스크 점수를 nodeId → score Map으로 변환
    const riskScoreMap = useMemo(() => {
        const map = new Map<string, number>();
        riskScores
            .filter((rs) => rs.entityType === 'node')
            .forEach((rs) => map.set(rs.entityId, rs.score));
        return map;
    }, [riskScores]);

    // HS 코드 필터 적용 시 해당 엣지에 연결된 노드 ID 집합 계산
    const hsCodeFilteredNodeIds = useMemo(() => {
        const nodeIds = new Set<string>();
        for (const edge of edges) {
            if (filters.hsCode.includes(edge.attributes.hsCode)) {
                nodeIds.add(edge.sourceNodeId);
                nodeIds.add(edge.targetNodeId);
            }
        }
        return nodeIds;
    }, [edges, filters.hsCode]);

    // 필터링된 노드 계산 (200ms 이내 업데이트를 위해 useMemo 활용)
    const filteredNodes = useMemo(() => {
        return nodes.filter((node) => {
            // HS 코드 필터: 해당 HS 코드 엣지에 연결된 노드만 표시
            if (hsCodeFilteredNodeIds && !hsCodeFilteredNodeIds.has(node.id)) {
                return false;
            }
            // 국가 필터 적용
            if (!filters.countries.includes(node.country)) {
                return false;
            }
            return true;
        });
    }, [nodes, hsCodeFilteredNodeIds, filters.countries]);

    // 필터링된 노드에 연결된 엣지만 포함 + HS 코드 필터 적용
    const filteredEdges = useMemo(() => {
        const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
        return edges.filter((edge) => {
            // 양쪽 노드가 모두 표시되는 경우만 포함
            if (!filteredNodeIds.has(edge.sourceNodeId) || !filteredNodeIds.has(edge.targetNodeId)) {
                return false;
            }
            // HS 코드 필터 적용: 선택된 HS 코드의 엣지만 표시
            if (!filters.hsCode.includes(edge.attributes.hsCode)) {
                return false;
            }
            return true;
        });
    }, [edges, filteredNodes, filters.hsCode]);

    // 노드 클릭 핸들러
    const handleNodeClick = useCallback(
        (nodeId: string) => {
            selectNode(nodeId === selectedNodeId ? null : nodeId);
            // 다른 노드 선택 시 역추적 패널 닫기
            setShowTraceability(false);
        },
        [selectNode, selectedNodeId],
    );

    // 패널 닫기 핸들러
    const handleClosePanel = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    // ESG 역추적 패널 열기 핸들러
    const handleOpenTraceability = useCallback(() => {
        setShowTraceability(true);
    }, []);

    // ESG 역추적 패널 닫기 핸들러
    const handleCloseTraceability = useCallback(() => {
        setShowTraceability(false);
    }, []);

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
                        리튬(HS 2825.20) 공급망 그래프 시각화 • 노드: {filteredNodes.length}/{nodes.length} | 엣지: {filteredEdges.length}/{edges.length}
                    </p>
                </div>
                {/* 뷰 전환 스위처 */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSimulation(!showSimulation)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${showSimulation
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                        aria-label="시뮬레이션 패널 토글"
                        aria-pressed={showSimulation}
                    >
                        ⚡ 시뮬레이션
                    </button>
                    <button
                        onClick={() => setShowAIPanel(!showAIPanel)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${showAIPanel
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                        aria-label="AI 인사이트 패널 토글"
                        aria-pressed={showAIPanel}
                    >
                        <GiDiamonds color='#4796e3' size={16} /> AI 인사이트
                    </button>
                    <ViewSwitcher currentView="graph" />
                </div>
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

                {/* 그래프 렌더러 — 필터링된 노드/엣지를 전달 */}
                {filteredNodes.length > 0 && (
                    <GraphRenderer
                        nodes={filteredNodes}
                        edges={filteredEdges}
                        riskScores={riskScoreMap}
                        onNodeClick={handleNodeClick}
                        highlightedPath={highlightedPath}
                    />
                )}

                {/* 필터 결과 없음 표시 */}
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
                {selectedNode && !showTraceability && (
                    <NodeDetailPanel
                        node={selectedNode}
                        connectedEdges={connectedEdges}
                        riskScore={riskScoreMap.get(selectedNode.id)}
                        onClose={handleClosePanel}
                        onOpenTraceability={selectedNode.type === 'Factory' ? handleOpenTraceability : undefined}
                    />
                )}

                {/* ESG 역추적 패널 */}
                {selectedNode && showTraceability && selectedNode.type === 'Factory' && (
                    <TraceabilityPanel
                        factoryNodeId={selectedNode.id}
                        factoryName={selectedNode.name}
                        onClose={handleCloseTraceability}
                    />
                )}

                {/* AI 인사이트 패널 — 항상 렌더링, CSS로 표시/숨김 (채팅 기록 유지) */}
                <div className={showAIPanel ? '' : 'hidden'}>
                    <AIInsightPanel onClose={() => setShowAIPanel(false)} />
                </div>

                {/* 시뮬레이션 제어 패널 */}
                {showSimulation && <SimulationPanel />}

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
                    aria-label="그래프 범례"
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>국가</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(0, 188, 212, 0.8)', borderRadius: '50%' }} />{' '}
                            한국
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(93, 52, 14, 0.8)', borderRadius: '50%' }} />{' '}
                            중국
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(0, 57, 166, 0.8)', borderRadius: '50%' }} />{' '}
                            칠레
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(123, 104, 238, 0.8)', borderRadius: '50%' }} />{' '}
                            미국
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(255, 105, 180, 0.8)', borderRadius: '50%' }} />{' '}
                            일본
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(117, 190, 233, 0.8)', borderRadius: '50%' }} />{' '}
                            아르헨티나
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(255, 193, 7, 0.8)', borderRadius: '50%' }} />{' '}
                            호주
                        </span>
                    </div>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>노드 타입</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                <polygon points="6,1 11,11 1,11" fill="#888" stroke="#555" strokeWidth="1" />
                            </svg>{' '}
                            광산
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                <polygon points="6,1 11,6 6,11 1,6" fill="#888" stroke="#555" strokeWidth="1" />
                            </svg>{' '}
                            정제소
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                <circle cx="6" cy="6" r="5" fill="#888" stroke="#555" strokeWidth="1" />
                            </svg>{' '}
                            공장
                        </span>
                    </div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>리스크 (테두리)</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid #52c41a', background: '#b7eb8f' }} />{' '}
                            저위험
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid #faad14', background: '#ffe58f' }} />{' '}
                            중위험
                        </span>
                        <span>
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '3px solid #f5222d', background: '#ffa39e' }} />{' '}
                            고위험
                        </span>
                    </div>
                </div>
            </main>
        </div>
    );
}
