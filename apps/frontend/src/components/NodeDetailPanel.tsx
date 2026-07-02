import { useMemo } from 'react';
import type { SupplyChainNode, SupplyChainEdge, HsCodeCategory } from '@navigator/shared';
import { getCountryDisplayName, getNodeTypeLabel, getCountryColor } from '../utils/graph-helpers';
import { useSupplyChainStore } from '../store/supply-chain-store';

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
const NODE_TYPE_LABEL_KO: Record<string, string> = {
    Resource: '자원',
    Mine: '광산',
    Refinery: '정제소',
    Factory: '공장',
};

export function NodeDetailPanel({ node, connectedEdges, riskScore, onClose, onOpenTraceability }: NodeDetailPanelProps) {
    const { nodes } = useSupplyChainStore();

    // 노드 ID -> 표시용 레이블 매핑 Map 생성
    const nodeLabelMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const n of nodes) {
            const countryKo = getCountryDisplayName(n.country);
            const typeKo = NODE_TYPE_LABEL_KO[n.type] || n.type;
            const label = n.country === 'NA'
                ? `${n.name} (${typeKo})`
                : `${n.name} (${countryKo}, ${typeKo})`;
            map.set(n.id, label);
        }
        return map;
    }, [nodes]);

    // 노드 ID -> SupplyChainNode 매핑 Map 생성
    const nodeMap = useMemo(() => {
        const map = new Map<string, SupplyChainNode>();
        for (const n of nodes) {
            map.set(n.id, n);
        }
        return map;
    }, [nodes]);

    const getNodeLabel = (id: string) => {
        return nodeLabelMap.get(id) || id;
    };

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
                    <div style={{ marginTop: '1.25rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#262626' }}>
                            연결 엣지 ({connectedEdges.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {connectedEdges.map((edge) => {
                                const sourceNode = nodeMap.get(edge.sourceNodeId);
                                const targetNode = nodeMap.get(edge.targetNodeId);

                                const sourceName = sourceNode?.name || edge.sourceNodeId;
                                const sourceCountry = sourceNode ? getCountryDisplayName(sourceNode.country) : '기타';
                                const sourceCountryCode = sourceNode?.country || 'NA';
                                const sourceCountryColor = getCountryColor(sourceCountryCode);
                                const sourceTypeName = sourceNode ? (NODE_TYPE_LABEL_KO[sourceNode.type] || sourceNode.type) : '';

                                const targetName = targetNode?.name || edge.targetNodeId;
                                const targetCountry = targetNode ? getCountryDisplayName(targetNode.country) : '기타';
                                const targetCountryCode = targetNode?.country || 'NA';
                                const targetCountryColor = getCountryColor(targetCountryCode);
                                const targetTypeName = targetNode ? (NODE_TYPE_LABEL_KO[targetNode.type] || targetNode.type) : '';

                                const isSupply = edge.type === 'Supply';

                                return (
                                    <div
                                        key={edge.id}
                                        style={{
                                            background: '#f8f9fa',
                                            border: '1px solid #e9ecef',
                                            borderRadius: '6px',
                                            padding: '10px 12px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span
                                                style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 'bold',
                                                    padding: '1px 5px',
                                                    borderRadius: '4px',
                                                    background: isSupply ? '#e6f7ff' : '#f6ffed',
                                                    color: isSupply ? '#1890ff' : '#52c41a',
                                                    border: isSupply ? '1px solid #91d5ff' : '1px solid #b7eb8f',
                                                }}
                                            >
                                                {isSupply ? '공급 (Supply)' : '배송 (Delivery)'}
                                            </span>
                                            {edge.attributes.volume && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#434343' }}>
                                                    {edge.attributes.volume.toLocaleString()} kg
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                                            {/* From 노드 */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                <span style={{ color: '#8c8c8c', width: '32px', flexShrink: 0 }}>From</span>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600, color: '#262626' }}>{sourceName}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                width: 6,
                                                                height: 6,
                                                                borderRadius: '50%',
                                                                background: sourceCountryColor,
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.65rem', color: '#8c8c8c' }}>
                                                            {sourceCountry} · {sourceTypeName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* To 노드 */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '2px' }}>
                                                <span style={{ color: '#8c8c8c', width: '32px', flexShrink: 0 }}>To</span>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600, color: '#262626' }}>{targetName}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                width: 6,
                                                                height: 6,
                                                                borderRadius: '50%',
                                                                background: targetCountryColor,
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.65rem', color: '#8c8c8c' }}>
                                                            {targetCountry} · {targetTypeName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
