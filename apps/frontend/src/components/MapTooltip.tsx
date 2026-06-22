import { getCountryDisplayName } from '../utils/graph-helpers';

// 노드 툴팁 데이터
interface NodeTooltipData {
    name: string;
    nodeType: string;
    country: string;
    productionCapacity: number;
    capacityUnit: string;
    riskScore: number;
}

// 엣지(경로) 툴팁 데이터
interface EdgeTooltipData {
    sourceName: string;
    targetName: string;
    volume?: number;
    price?: number;
}

// 툴팁 정보 인터페이스
export type TooltipInfo =
    | { type: 'node'; x: number; y: number; data: NodeTooltipData }
    | { type: 'edge'; x: number; y: number; data: EdgeTooltipData };

// 노드 타입 한글 매핑
const NODE_TYPE_KO: Record<string, string> = {
    Resource: '자원',
    Mine: '광산',
    Refinery: '제련소',
    Factory: '공장',
};

// 리스크 등급 텍스트
function getRiskLabel(score: number): string {
    if (score <= 33) return '저위험';
    if (score <= 66) return '중위험';
    return '고위험';
}

// 리스크 등급 색상
function getRiskLabelColor(score: number): string {
    if (score <= 33) return '#52c41a';
    if (score <= 66) return '#faad14';
    return '#f5222d';
}

export interface MapTooltipProps {
    info: TooltipInfo;
}

/**
 * 지도 호버 시 표시되는 툴팁 컴포넌트.
 * - 노드 호버: 이름, 타입, 국가, 생산 용량, 리스크 점수 표시
 * - 경로 호버: 출발지 → 도착지, 무역량, 가격 표시
 */
export function MapTooltip({ info }: MapTooltipProps) {
    const { x, y } = info;

    return (
        <div
            style={{
                position: 'absolute',
                left: x + 12,
                top: y + 12,
                background: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                fontSize: '0.75rem',
                lineHeight: 1.6,
                zIndex: 20,
                pointerEvents: 'none',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                maxWidth: '260px',
            }}
            role="tooltip"
        >
            {info.type === 'node' ? (
                <NodeTooltipContent data={info.data} />
            ) : (
                <EdgeTooltipContent data={info.data} />
            )}
        </div>
    );
}

/** 노드 툴팁 내용 */
function NodeTooltipContent({ data }: { data: NodeTooltipData }) {
    return (
        <>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#222' }}>
                {data.name}
            </div>
            <div>타입: {NODE_TYPE_KO[data.nodeType] ?? data.nodeType}</div>
            <div>국가: {getCountryDisplayName(data.country)}</div>
            <div>
                생산 용량: {data.productionCapacity.toLocaleString()} {data.capacityUnit}
            </div>
            <div>
                리스크:{' '}
                <span style={{ color: getRiskLabelColor(data.riskScore), fontWeight: 'bold' }}>
                    {data.riskScore.toFixed(1)} ({getRiskLabel(data.riskScore)})
                </span>
            </div>
        </>
    );
}

/** 경로(엣지) 툴팁 내용 */
function EdgeTooltipContent({ data }: { data: EdgeTooltipData }) {
    return (
        <>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#222' }}>
                {data.sourceName} → {data.targetName}
            </div>
            {data.volume != null && (
                <div>무역량: {data.volume.toLocaleString()} kg</div>
            )}
            {data.price != null && (
                <div>거래액: ${data.price.toLocaleString()}</div>
            )}
        </>
    );
}
