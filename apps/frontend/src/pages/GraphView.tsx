import { useSupplyChainStore } from '../store/supply-chain-store';

// 공급망 그래프 시각화 페이지 (Phase 1 메인 뷰)
export function GraphView() {
    const { nodes, edges, selectedNodeId } = useSupplyChainStore();

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>
                <h1>Mineral Chain Navigator</h1>
                <p>리튬 공급망 그래프 시각화</p>
            </header>
            <main style={{ flex: 1, position: 'relative' }}>
                {/* 그래프 렌더러가 이 영역에 마운트됩니다 */}
                <div id="graph-container" style={{ width: '100%', height: '100%' }}>
                    <p style={{ padding: '2rem', color: '#666' }}>
                        그래프 렌더러 준비 중... (노드: {nodes.length}, 엣지: {edges.length})
                    </p>
                </div>
                {/* 선택된 노드 상세 패널 */}
                {selectedNodeId && (
                    <aside style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '320px',
                        height: '100%',
                        background: '#fff',
                        borderLeft: '1px solid #e0e0e0',
                        padding: '1rem',
                    }}>
                        <h2>노드 상세</h2>
                        <p>선택된 노드: {selectedNodeId}</p>
                    </aside>
                )}
            </main>
        </div>
    );
}
