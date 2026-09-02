import { useEffect, useRef, useCallback, useMemo } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { getNodeRadius, getRiskColor } from '../../utils/graph-helpers';

export interface GlobeViewProps {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
    riskScores: Map<string, number>;
    selectedNodeId?: string | null;
    onNodeClick?: (nodeId: string) => void;
}

// 아크 데이터를 위한 인터페이스
interface ArcData {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    color: [string, string];
    weight: number;
    altitude: number;
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceName: string;
    targetName: string;
    hsCode?: string;
    description?: string;
    volume?: number;
    price?: number;
    distanceKm?: number;
    transportMode?: string;
}

// 포인트 데이터를 위한 인터페이스
interface PointData {
    lat: number;
    lng: number;
    size: number;
    color: string;
    nodeId: string;
    name: string;
    country: string;
    nodeType: string;
    productionCapacity: number;
    capacityUnit: string;
    riskScore: number;
}

/**
 * 3D 지구본 뷰 컴포넌트.
 * Globe.gl을 활용하여 공급망 노드와 물류 경로를 3D 지구본 상에 실시간 렌더링한다.
 * - 2D MapView와 동일한 리스크 색상, 물류 흐름(출발지->도착지) 그라데이션 및 애니메이션 적용
 * - 노드 클릭 시 상세 정보 패널 연동 및 부드러운 카메라 시점 전환
 */
export function GlobeView({
    nodes,
    edges,
    riskScores,
    selectedNodeId,
    onNodeClick,
}: GlobeViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const globeRef = useRef<GlobeInstance | null>(null);

    // 유효한 지리 좌표를 가진 노드만 필터링
    const validNodes = useMemo(() => {
        return nodes.filter(
            (node) =>
                node.country !== 'NA' &&
                node.coordinates &&
                typeof node.coordinates.latitude === 'number' &&
                typeof node.coordinates.longitude === 'number' &&
                !isNaN(node.coordinates.latitude) &&
                !isNaN(node.coordinates.longitude) &&
                (node.coordinates.latitude !== 0 || node.coordinates.longitude !== 0),
        );
    }, [nodes]);

    // 노드 ID → 노드 매핑
    const nodeMap = useMemo(() => {
        const map = new Map<string, SupplyChainNode>();
        validNodes.forEach((node) => map.set(node.id, node));
        return map;
    }, [validNodes]);

    // 아크 가중치 계산 (물동량 volume 비례)
    const computeArcWeight = useCallback(
        (edge: SupplyChainEdge, maxVol: number): number => {
            const volume = edge.attributes?.volume || 0;
            return Math.max(0.6, (volume / Math.max(maxVol, 1)) * 3.5);
        },
        [],
    );

    // 포인트 데이터 생성
    const pointsData: PointData[] = useMemo(() => {
        return validNodes.map((node) => {
            const score = riskScores.get(node.id) ?? 0;
            const radius = getNodeRadius(
                node.metadata?.productionCapacity || 0,
                node.metadata?.capacityUnit || 'tons',
            );
            // 지구본 상 포인트 크기 정규화 (0.3 ~ 1.2)
            const normalizedSize = Math.max(0.3, Math.min(1.2, (radius / 25) * 0.8));

            return {
                lat: node.coordinates.latitude,
                lng: node.coordinates.longitude,
                size: normalizedSize,
                color: getRiskColor(score),
                nodeId: node.id,
                name: node.name,
                country: node.country,
                nodeType: node.type,
                productionCapacity: node.metadata?.productionCapacity || 0,
                capacityUnit: node.metadata?.capacityUnit || 'tons',
                riskScore: score,
            };
        });
    }, [validNodes, riskScores]);

    // 아크 데이터 생성
    const arcsData: ArcData[] = useMemo(() => {
        const maxVol = Math.max(...edges.map((e) => e.attributes?.volume ?? 1), 1);
        const maxDist = Math.max(
            ...edges.map((e) => e.attributes?.logisticsInfo?.distanceKm ?? 1000),
            20000,
        );

        return edges
            .map((edge) => {
                const source = nodeMap.get(edge.sourceNodeId);
                const target = nodeMap.get(edge.targetNodeId);
                if (!source || !target) return null;

                const distanceKm = edge.attributes?.logisticsInfo?.distanceKm ?? 3000;
                // 운송 거리에 비례하는 아크 고도 (0.1 ~ 0.55)
                const altitude = 0.1 + Math.min(distanceKm / maxDist, 1.0) * 0.45;

                return {
                    startLat: source.coordinates.latitude,
                    startLng: source.coordinates.longitude,
                    endLat: target.coordinates.latitude,
                    endLng: target.coordinates.longitude,
                    // 출발지(Cyan) -> 도착지(Orange) 물류 흐름 색상
                    color: ['rgba(0, 180, 255, 0.85)', 'rgba(255, 140, 50, 0.85)'] as [string, string],
                    weight: computeArcWeight(edge, maxVol),
                    altitude,
                    edgeId: edge.id,
                    sourceNodeId: edge.sourceNodeId,
                    targetNodeId: edge.targetNodeId,
                    sourceName: source.name,
                    targetName: target.name,
                    hsCode: edge.attributes?.hsCode,
                    description: edge.description,
                    volume: edge.attributes?.volume,
                    price: edge.attributes?.price,
                    distanceKm,
                    transportMode: edge.attributes?.logisticsInfo?.transportMode,
                };
            })
            .filter((d): d is ArcData => d !== null);
    }, [edges, nodeMap, computeArcWeight]);

    // Globe.gl 초기화
    useEffect(() => {
        if (!containerRef.current) return;

        const globe = new Globe(containerRef.current, { animateIn: true })
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
            .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
            .showAtmosphere(true)
            .atmosphereColor('#3a86ff')
            .atmosphereAltitude(0.2)
            .width(containerRef.current.clientWidth)
            .height(containerRef.current.clientHeight);

        const renderer = globe.renderer();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 초기 시점: 한국 좌표(위도 36.5, 경도 127.5) 중심으로 설정
        globe.pointOfView({ lat: 36.5, lng: 127.5, altitude: 2.2 });

        globeRef.current = globe;

        // ResizeObserver로 컨테이너 크기 변경(패널 토글 등)에 즉각 반응
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (globeRef.current && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    globeRef.current
                        .width(entry.contentRect.width)
                        .height(entry.contentRect.height);
                }
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            if (globeRef.current) {
                globeRef.current.controls().dispose();
                globeRef.current.renderer().dispose();
                globeRef.current._destructor();
            }
            globeRef.current = null;
        };
    }, []);

    // 선택된 노드 변경 시 카메라 포커스 이동
    useEffect(() => {
        if (!globeRef.current || !selectedNodeId) return;
        const targetNode = nodeMap.get(selectedNodeId);
        if (targetNode?.coordinates) {
            globeRef.current.pointOfView(
                {
                    lat: targetNode.coordinates.latitude,
                    lng: targetNode.coordinates.longitude,
                    altitude: 1.6,
                },
                1000,
            );
        }
    }, [selectedNodeId, nodeMap]);

    // 포인트 레이어 업데이트
    useEffect(() => {
        if (!globeRef.current) return;

        globeRef.current
            .pointsData(pointsData)
            .pointLat((d: object) => (d as PointData).lat)
            .pointLng((d: object) => (d as PointData).lng)
            .pointAltitude(0.012)
            .pointRadius((d: object) => (d as PointData).size)
            .pointColor((d: object) => (d as PointData).color)
            .pointLabel((d: object) => {
                const p = d as PointData;
                const formattedCapacity = Number(p.productionCapacity).toLocaleString();
                return `
                    <div style="background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 12px; font-family: sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,0.4); min-width: 170px;">
                        <div style="font-weight: bold; font-size: 13px; color: #f8fafc; margin-bottom: 4px;">${p.name}</div>
                        <div style="font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; margin-bottom: 2px;">
                            <span>국가: <strong style="color: #cbd5e1;">${p.country}</strong></span>
                            <span>유형: <strong style="color: #cbd5e1;">${p.nodeType}</strong></span>
                        </div>
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">
                            생산용량: <strong style="color: #38bdf8;">${formattedCapacity} ${p.capacityUnit}</strong>
                        </div>
                        <div style="font-size: 11px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                            <span style="color: #94a3b8;">리스크 점수</span>
                            <span style="font-weight: bold; color: ${p.color};">${p.riskScore}점</span>
                        </div>
                    </div>
                `;
            })
            .onPointClick((point: object) => {
                const p = point as PointData;
                if (onNodeClick) {
                    onNodeClick(p.nodeId);
                }
            });
    }, [pointsData, onNodeClick]);

    // 아크 레이어 업데이트 (흐름 애니메이션 및 그라데이션)
    useEffect(() => {
        if (!globeRef.current) return;

        globeRef.current
            .arcsData(arcsData)
            .arcStartLat((d: object) => (d as ArcData).startLat)
            .arcStartLng((d: object) => (d as ArcData).startLng)
            .arcEndLat((d: object) => (d as ArcData).endLat)
            .arcEndLng((d: object) => (d as ArcData).endLng)
            .arcColor((d: object) => (d as ArcData).color)
            .arcAltitude((d: object) => (d as ArcData).altitude)
            .arcStroke((d: object) => (d as ArcData).weight)
            .arcDashLength(0.35)
            .arcDashGap(0.15)
            .arcDashAnimateTime(2600)
            .arcLabel((d: object) => {
                const a = d as ArcData;
                const formattedVol = a.volume ? Number(a.volume).toLocaleString() + ' kg' : 'N/A';
                const formattedPrc = a.price ? '$' + Number(a.price).toLocaleString() : 'N/A';
                const formattedDist = a.distanceKm ? Number(a.distanceKm).toLocaleString() + ' km' : 'N/A';

                return `
                    <div style="background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 12px; font-family: sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,0.4); min-width: 200px;">
                        <div style="font-weight: bold; font-size: 12px; color: #f8fafc; margin-bottom: 6px;">
                            ${a.sourceName} <span style="color: #38bdf8;">➔</span> ${a.targetName}
                        </div>
                        <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
                            ${a.hsCode ? `<div>HS 코드: <strong style="color: #cbd5e1;">${a.hsCode}</strong></div>` : ''}
                            ${a.transportMode ? `<div>운송수단: <strong style="color: #cbd5e1;">${a.transportMode}</strong></div>` : ''}
                            <div>운송거리: <strong style="color: #cbd5e1;">${formattedDist}</strong></div>
                            <div>물동량: <strong style="color: #38bdf8;">${formattedVol}</strong></div>
                            <div>거래금액: <strong style="color: #fb923c;">${formattedPrc}</strong></div>
                        </div>
                    </div>
                `;
            });
    }, [arcsData]);

    // 라벨 레이어 업데이트
    useEffect(() => {
        if (!globeRef.current) return;

        globeRef.current
            .labelsData(pointsData)
            .labelLat((d: object) => (d as PointData).lat)
            .labelLng((d: object) => (d as PointData).lng)
            .labelText((d: object) => (d as PointData).name)
            .labelSize(0.65)
            .labelDotRadius(0.3)
            .labelColor(() => 'rgba(255, 255, 255, 0.85)')
            .labelResolution(2)
            .labelAltitude(0.016);
    }, [pointsData]);

    return (
        <div className="w-full h-full relative">
            <div
                ref={containerRef}
                className="w-full h-full"
                aria-label="3D 지구본 뷰"
            />

            {/* 물류 흐름 방향 범례 */}
            <div className="absolute bottom-6 left-6 bg-card/90 backdrop-blur-md border border-border rounded-lg px-3.5 py-2.5 text-xs shadow-lg space-y-1.5 select-none z-10">
                <div className="font-bold text-[11px] text-foreground border-b border-border/50 pb-1 flex items-center justify-between gap-4">
                    <span>물류 흐름 방향</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Flow Direction</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00b4ff] shrink-0 shadow-xs" />
                        <span className="font-medium text-foreground">출발지 (공급)</span>
                    </div>
                    {/* 그라데이션 라인 & 화살표 */}
                    <div className="flex items-center gap-1 px-1">
                        <div className="w-8 h-1 rounded-full bg-gradient-to-r from-[#00b4ff] to-[#ff8c32]" />
                        <span className="text-[#ff8c32] text-xs font-bold leading-none select-none">→</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ff8c32] shrink-0 shadow-xs" />
                        <span className="font-medium text-foreground">도착지 (수요)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
