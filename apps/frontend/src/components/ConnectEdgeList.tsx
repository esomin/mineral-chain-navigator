import { useMemo } from 'react';
import type { SupplyChainEdge, SupplyChainNode } from '@navigator/shared';
import { useSupplyChainStore } from '../store/supply-chain-store';
import { getCountryDisplayName, getCountryColor } from '../utils/graph-helpers';

const NODE_TYPE_LABEL_KO: Record<string, string> = {
    Resource: '자원',
    Mine: '광산',
    Refinery: '정제소',
    Factory: '공장',
};

interface ConnectedEdgesListProps {
    connectedEdges: SupplyChainEdge[];
}

/**
 * 선택된 노드에 연결된 엣지(거래 정보)를 카드 형태로 보여주는 리스트 컴포넌트.
 */
export function ConnectedEdgesList({ connectedEdges }: ConnectedEdgesListProps) {
    const { nodes } = useSupplyChainStore();

    // 노드 ID -> SupplyChainNode 매핑 Map 생성
    const nodeMap = useMemo(() => {
        const map = new Map<string, SupplyChainNode>();
        for (const n of nodes) {
            map.set(n.id, n);
        }
        return map;
    }, [nodes]);

    if (connectedEdges.length === 0) return null;

    return (
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
    );
}
