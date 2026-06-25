import { useEffect, useState } from 'react';
import type { TraceabilityReport, EsgStatus } from '@navigator/shared';

export interface TraceabilityPanelProps {
    factoryNodeId: string;
    factoryName: string;
    onClose: () => void;
}

/** ESG 상태에 따른 배지 Tailwind 클래스를 반환한다. */
function getEsgBadgeClass(status: EsgStatus): string {
    switch (status) {
        case 'compliant':
            return 'bg-green-50 text-green-700 border border-green-300';
        case 'non_compliant':
            return 'bg-red-50 text-red-700 border border-red-300';
        case 'unverified':
            return 'bg-yellow-50 text-yellow-700 border border-yellow-300';
        case 'unknown':
        default:
            return 'bg-gray-100 text-gray-500 border border-gray-300';
    }
}

/** ESG 상태 라벨을 반환한다. */
function getEsgLabel(status: EsgStatus): string {
    switch (status) {
        case 'compliant':
            return '준수';
        case 'non_compliant':
            return '미준수';
        case 'unverified':
            return '미검증';
        case 'unknown':
        default:
            return '알 수 없음';
    }
}

/**
 * ESG 역추적 사이드 패널.
 * Factory 노드의 원재료 출처, 처리 단계, 인증 정보, 미검증 경로 경고를 표시한다.
 * Requirements 11.1~11.4 구현.
 */
export function TraceabilityPanel({ factoryNodeId, factoryName, onClose }: TraceabilityPanelProps) {
    const [report, setReport] = useState<TraceabilityReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 역추적 보고서 로딩
    useEffect(() => {
        const fetchTrace = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/trace/${factoryNodeId}`);
                if (!response.ok) {
                    throw new Error(`역추적 데이터를 불러올 수 없습니다 (${response.status})`);
                }
                const data = await response.json();
                setReport(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : '역추적 데이터 로딩 실패');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrace();
    }, [factoryNodeId]);

    return (
        <aside
            className="absolute top-0 right-0 w-[380px] h-full bg-white border-l border-gray-200 p-4 overflow-y-auto shadow-md z-10"
            aria-label="ESG 역추적 패널"
        >
            {/* 헤더 영역 */}
            <div className="flex justify-between items-center">
                <h2 className="m-0 text-base font-semibold">ESG 역추적</h2>
                <button
                    onClick={onClose}
                    className="bg-transparent border-none text-xl cursor-pointer text-gray-400 hover:text-gray-600"
                    aria-label="패널 닫기"
                >
                    ✕
                </button>
            </div>

            {/* Factory 이름 */}
            <h3 className="mt-3 mb-2 text-[0.95rem]">{factoryName}</h3>

            {/* 로딩 상태 */}
            {isLoading && (
                <div className="py-8 text-center text-gray-400">
                    역추적 데이터 로딩 중...
                </div>
            )}

            {/* 에러 상태 */}
            {error && (
                <div className="p-3 mt-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    [경고] {error}
                </div>
            )}

            {/* 보고서 내용 */}
            {report && !isLoading && (
                <div className="mt-3">
                    {/* 원산지(광산) 섹션 */}
                    <section className="mb-5">
                        <h4 className="m-0 mb-2 text-sm text-gray-700">
                            원산지 ({report.sourceOrigins.length})
                        </h4>
                        {report.sourceOrigins.length === 0 ? (
                            <p className="text-xs text-gray-400">원산지 정보 없음</p>
                        ) : (
                            <ul className="m-0 p-0 list-none">
                                {report.sourceOrigins.map((origin) => (
                                    <li
                                        key={origin.mineNodeId}
                                        className="p-2 mb-1.5 bg-gray-50 rounded border border-gray-100 text-sm"
                                    >
                                        <div className="font-medium">{origin.mineName}</div>
                                        <div className="flex gap-2 mt-1 items-center">
                                            <span className="text-gray-500">{origin.country}</span>
                                            <span
                                                className={`px-1.5 py-px rounded text-[0.7rem] ${getEsgBadgeClass(origin.esgStatus)}`}
                                            >
                                                {getEsgLabel(origin.esgStatus)}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* 처리 단계 섹션 */}
                    <section className="mb-5">
                        <h4 className="m-0 mb-2 text-sm text-gray-700">
                            처리 단계 ({report.processingStages.length})
                        </h4>
                        {report.processingStages.length === 0 ? (
                            <p className="text-xs text-gray-400">처리 단계 정보 없음</p>
                        ) : (
                            <ol className="m-0 pl-5 text-sm">
                                {report.processingStages.map((stage) => (
                                    <li key={stage.nodeId} className="mb-1.5">
                                        <div className="font-medium">
                                            {stage.nodeName}
                                            <span className="font-normal text-gray-400 ml-1">
                                                ({stage.nodeType})
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mt-0.5 items-center">
                                            <span className="text-gray-500 text-xs">{stage.country}</span>
                                            <span
                                                className={`px-1.5 py-px rounded text-[0.7rem] ${getEsgBadgeClass(stage.esgStatus)}`}
                                            >
                                                {getEsgLabel(stage.esgStatus)}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    {/* 인증 정보 섹션 */}
                    <section className="mb-5">
                        <h4 className="m-0 mb-2 text-sm text-gray-700">
                            인증 정보 ({report.allCertifications.length})
                        </h4>
                        {report.allCertifications.length === 0 ? (
                            <p className="text-xs text-gray-400">인증 정보 없음</p>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                {report.allCertifications.map((cert) => (
                                    <span
                                        key={cert}
                                        className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[0.7rem] text-blue-800"
                                    >
                                        {cert}
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 미검증 경로 경고 섹션 */}
                    {report.flaggedPaths.length > 0 && (
                        <section className="mb-4">
                            <h4 className="m-0 mb-2 text-sm text-yellow-700">
                                미검증 경로 ({report.flaggedPaths.length})
                            </h4>
                            <ul className="m-0 p-0 list-none">
                                {report.flaggedPaths.map((flagged) => (
                                    <li
                                        key={flagged.pathIndex}
                                        className="p-2 mb-1.5 bg-yellow-50 border border-yellow-200 rounded text-xs"
                                    >
                                        <div className="text-yellow-700 font-medium mb-1">
                                            {flagged.reason}
                                        </div>
                                        <div className="text-gray-400">
                                            미검증 노드: {flagged.unverifiedNodes.map((n) => n.nodeName).join(', ')}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* 미검증 경로 없음 표시 */}
                    {!report.hasUnverifiedPaths && report.sourceOrigins.length > 0 && (
                        <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 text-center">
                            모든 경로가 ESG 검증 완료되었습니다.
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}
