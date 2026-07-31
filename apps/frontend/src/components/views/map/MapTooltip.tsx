import { getCountryDisplayName } from '../../../utils/graph-helpers';

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

// 리스크 등급 색상 클래스
function getRiskLabelClass(score: number): string {
    if (score <= 33) return 'text-green-500';
    if (score <= 66) return 'text-yellow-500';
    return 'text-red-500';
}

export interface MapTooltipProps {
    info: TooltipInfo;
}

/**
 * 지도 호버 시 표시되는 툴팁 컴포넌트.
 * - 노드 호버: 이름, 타입, 국가, 생산 용량, 리스크 점수 표시
 * - 경로 호버: 출발지 → 도착지, 무역량, 가격 표시
 * 위치는 커서 좌표에 따라 동적으로 결정되므로 inline style 사용.
 */
export function MapTooltip({ info }: MapTooltipProps) {
    const { x, y } = info;

    return (
        <div
            className="absolute bg-white/[0.97] border border-gray-300 rounded-md px-3 py-2 text-xs leading-relaxed z-20 pointer-events-none shadow-md max-w-[260px]"
            style={{ left: x + 12, top: y + 12 }}
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
            <div className="font-bold mb-1 text-gray-800">
                {data.name}
            </div>
            <div>타입: {NODE_TYPE_KO[data.nodeType] ?? data.nodeType}</div>
            <div>국가: {getCountryDisplayName(data.country)}</div>
            <div>
                생산 용량: {data.productionCapacity.toLocaleString()} {data.capacityUnit}
            </div>
            <div>
                리스크:{' '}
                <span className={`${getRiskLabelClass(data.riskScore)} font-bold`}>
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
            <div className="font-bold mb-1 text-gray-800">
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
