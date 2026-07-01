import type { SupplyChainNode, SupplyChainEdge, HsCodeCategory } from '@navigator/shared';
import { getCountryDisplayName, getNodeTypeLabel } from '../utils/graph-helpers';

// HS 코드 카테고리 한글 라벨 매핑
const HS_CODE_CATEGORY_LABELS: Record<HsCodeCategory, string> = {
    raw_material: '원자재 (HS 2530.90)',
    lithium_carbonate: '탄산리튬 (HS 2836.91)',
    lithium_hydroxide: '수산화리튬 (HS 2825.20)',
};

/** HS 코드 카테고리를 한글 라벨로 변환 */
function getHsCodeCategoryLabel(category: string): string {
    return HS_CODE_CATEGORY_LABELS[category as HsCodeCategory] ?? category;
}

export interface NodeDetailPanelProps {
    node: SupplyChainNode;
    connectedEdges: SupplyChainEdge[];
    riskScore: number | undefined;
    onClose: () => void;
    /** Factory 노드에서 역추적 패널을 열기 위한 콜백 (옵션) */
    onOpenTraceability?: () => void;
}

/**
 * 노드 상세 정보 패널.
 * 선택된 노드의 속성, description, 연결 엣지, 리스크 점수를 표시한다.
 * Requirements 4.4 구현.
 */
export function NodeDetailPanel({ node, connectedEdges, riskScore, onClose, onOpenTraceability }: NodeDetailPanelProps) {
    return (
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
                zIndex: 5,
            }}
            aria-label="노드 상세 정보 패널"
        >
            {/* 헤더 영역: 제목 + 닫기 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1rem' }}>노드 상세</h2>
                <button
                    onClick={onClose}
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
                {/* 노드 이름 */}
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{node.name}</h3>

                {/* 노드 설명 */}
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#666' }}>
                    {node.description}
                </p>

                {/* 노드 속성 테이블 */}
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '4px 8px', color: '#999' }}>ID</td>
                            <td style={{ padding: '4px 8px' }}>{node.id}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px 8px', color: '#999' }}>타입</td>
                            <td style={{ padding: '4px 8px' }}>
                                {node.type} ({getNodeTypeLabel(node.type)})
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px 8px', color: '#999' }}>국가</td>
                            <td style={{ padding: '4px 8px' }}>
                                {getCountryDisplayName(node.country)}
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px 8px', color: '#999' }}>생산능력</td>
                            <td style={{ padding: '4px 8px' }}>
                                {node.metadata.productionCapacity.toLocaleString()}{' '}
                                {node.metadata.capacityUnit}
                            </td>
                        </tr>
                        {node.metadata.hsCodeCategory && (
                            <tr>
                                <td style={{ padding: '4px 8px', color: '#999' }}>HS 코드 분류</td>
                                <td style={{ padding: '4px 8px' }}>
                                    {getHsCodeCategoryLabel(node.metadata.hsCodeCategory)}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td style={{ padding: '4px 8px', color: '#999' }}>리스크 점수</td>
                            <td style={{ padding: '4px 8px' }}>
                                {riskScore !== undefined ? riskScore.toFixed(1) : 'N/A'}
                            </td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px 8px', color: '#999' }}>좌표</td>
                            <td style={{ padding: '4px 8px' }}>
                                {node.coordinates.latitude.toFixed(2)},{' '}
                                {node.coordinates.longitude.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 연결된 엣지 목록 */}
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

                {/* Factory 노드일 때 ESG 역추적 버튼 */}
                {node.type === 'Factory' && onOpenTraceability && (
                    <div className="mt-4">
                        <button
                            onClick={onOpenTraceability}
                            className="w-full py-2 px-3 bg-blue-500 text-white border-none rounded cursor-pointer text-sm font-medium hover:bg-blue-600 transition-colors"
                            aria-label="ESG 역추적 보기"
                        >
                            ESG 역추적 보기
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
