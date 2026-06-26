import { useEffect, useRef, useCallback } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { useNavigate } from 'react-router-dom';

// 아크 가중치 모드 타입
export type ArcWeightMode = 'volume' | 'price';

export interface GlobeViewProps {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
    riskScores: Map<string, number>;
    arcWeightMode: ArcWeightMode;
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
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
}

// 포인트 데이터를 위한 인터페이스
interface PointData {
    lat: number;
    lng: number;
    size: number;
    color: string;
    nodeId: string;
    name: string;
}

// 리스크 점수 기반 색상 반환
function getPointColor(score: number | undefined): string {
    if (score === undefined) return '#888888';
    if (score <= 33) return '#52c41a'; // 저위험: 녹색
    if (score <= 66) return '#faad14'; // 중위험: 노란색
    return '#f5222d'; // 고위험: 빨간색
}

// 아크 색상 반환 (소스 노드 국가 기반)
function getArcColor(sourceCountry: string): [string, string] {
    const colors: Record<string, [string, string]> = {
        China: ['rgba(93, 52, 14, 0.6)', 'rgba(93, 52, 14, 0.3)'],
        Chile: ['rgba(0, 57, 166, 0.6)', 'rgba(0, 57, 166, 0.3)'],
        UnitedStates: ['rgba(123, 104, 238, 0.6)', 'rgba(123, 104, 238, 0.3)'],
        SouthKorea: ['rgba(0, 188, 212, 0.6)', 'rgba(0, 188, 212, 0.3)'],
        Japan: ['rgba(255, 105, 180, 0.6)', 'rgba(255, 105, 180, 0.3)'],
    };
    return colors[sourceCountry] || ['rgba(136, 136, 136, 0.6)', 'rgba(136, 136, 136, 0.3)'];
}

/**
 * 3D 지구본 뷰 컴포넌트.
 * Globe.gl을 활용하여 리튬 공급망 경로를 아크로 렌더링한다.
 * Requirements 10.1, 10.2, 10.3, 10.4 구현.
 */
export function GlobeView({ nodes, edges, riskScores, arcWeightMode, onNodeClick }: GlobeViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const globeRef = useRef<GlobeInstance | null>(null);
    const navigate = useNavigate();

    // 노드 ID → 노드 매핑
    const nodeMap = useRef<Map<string, SupplyChainNode>>(new Map());

    // 노드 맵 업데이트
    useEffect(() => {
        const map = new Map<string, SupplyChainNode>();
        nodes.forEach((node) => map.set(node.id, node));
        nodeMap.current = map;
    }, [nodes]);

    // 아크 가중치 계산 (모드에 따라 volume 또는 price 비례)
    const computeArcWeight = useCallback(
        (edge: SupplyChainEdge): number => {
            if (arcWeightMode === 'volume') {
                // volume 비례: 0~5 범위로 정규화
                const volume = edge.attributes.volume || 0;
                const maxVolume = 50_000_000; // 5천만 kg 기준
                return Math.max(0.5, (volume / maxVolume) * 5);
            } else {
                // price 비례: 0~5 범위로 정규화
                const price = edge.attributes.price || 0;
                const maxPrice = 500_000_000; // 5억 USD 기준
                return Math.max(0.5, (price / maxPrice) * 5);
            }
        },
        [arcWeightMode],
    );

    // 포인트 데이터 생성
    const pointsData: PointData[] = nodes
        .filter((node) => node.country !== 'NA') // 글로벌 리소스 노드 제외
        .map((node) => ({
            lat: node.coordinates.latitude,
            lng: node.coordinates.longitude,
            size: Math.max(0.3, Math.min(1.0, node.metadata.productionCapacity / 100000)),
            color: getPointColor(riskScores.get(node.id)),
            nodeId: node.id,
            name: node.name,
        }));

    // 아크 데이터 생성
    const arcsData: ArcData[] = edges
        .filter((edge) => {
            const source = nodeMap.current.get(edge.sourceNodeId);
            const target = nodeMap.current.get(edge.targetNodeId);
            // 좌표가 있는 노드 간만 아크 생성 (Resource(N/A) 제외)
            return source && target && source.country !== 'NA' && target.country !== 'NA';
        })
        .map((edge) => {
            const source = nodeMap.current.get(edge.sourceNodeId)!;
            const target = nodeMap.current.get(edge.targetNodeId)!;
            return {
                startLat: source.coordinates.latitude,
                startLng: source.coordinates.longitude,
                endLat: target.coordinates.latitude,
                endLng: target.coordinates.longitude,
                color: getArcColor(source.country),
                weight: computeArcWeight(edge),
                edgeId: edge.id,
                sourceNodeId: edge.sourceNodeId,
                targetNodeId: edge.targetNodeId,
            };
        });

    // Globe.gl 초기화
    useEffect(() => {
        if (!containerRef.current) return;

        const globe = new Globe(containerRef.current, { animateIn: true })
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
            // 60fps 유지를 위한 렌더링 최적화
            .width(containerRef.current.clientWidth)
            .height(containerRef.current.clientHeight);

        // 렌더러 성능 최적화 설정
        const renderer = globe.renderer();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        globeRef.current = globe;

        // 리사이즈 대응
        const handleResize = () => {
            if (containerRef.current && globeRef.current) {
                globeRef.current
                    .width(containerRef.current.clientWidth)
                    .height(containerRef.current.clientHeight);
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            // 정리: Globe 인스턴스의 controls 및 렌더러 해제
            if (globeRef.current) {
                globeRef.current.controls().dispose();
                globeRef.current.renderer().dispose();
                globeRef.current._destructor();
            }
            globeRef.current = null;
        };
    }, []);

    // 포인트 레이어 업데이트
    useEffect(() => {
        if (!globeRef.current) return;

        globeRef.current
            .pointsData(pointsData)
            .pointLat((d: object) => (d as PointData).lat)
            .pointLng((d: object) => (d as PointData).lng)
            .pointAltitude(0.01)
            .pointRadius((d: object) => (d as PointData).size)
            .pointColor((d: object) => (d as PointData).color)
            .pointLabel((d: object) => (d as PointData).name)
            .onPointClick((point: object) => {
                const p = point as PointData;
                if (onNodeClick) {
                    onNodeClick(p.nodeId);
                }
                // 지역 클릭 시 상세 지도 뷰로 전환 (Requirement 10.3)
                navigate('/map');
            });
    }, [pointsData, onNodeClick, navigate]);

    // 아크 레이어 업데이트
    useEffect(() => {
        if (!globeRef.current) return;

        globeRef.current
            .arcsData(arcsData)
            .arcStartLat((d: object) => (d as ArcData).startLat)
            .arcStartLng((d: object) => (d as ArcData).startLng)
            .arcEndLat((d: object) => (d as ArcData).endLat)
            .arcEndLng((d: object) => (d as ArcData).endLng)
            .arcColor((d: object) => (d as ArcData).color)
            .arcStroke((d: object) => (d as ArcData).weight)
            .arcDashLength(0.4)
            .arcDashGap(0.2)
            .arcDashAnimateTime(2000);
    }, [arcsData]);

    // 라벨 레이어 업데이트
    useEffect(() => {
        if (!globeRef.current) return;

        globeRef.current
            .labelsData(pointsData)
            .labelLat((d: object) => (d as PointData).lat)
            .labelLng((d: object) => (d as PointData).lng)
            .labelText((d: object) => (d as PointData).name)
            .labelSize(0.6)
            .labelDotRadius(0.3)
            .labelColor(() => 'rgba(255, 255, 255, 0.75)')
            .labelResolution(2)
            .labelAltitude(0.015);
    }, [pointsData]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full"
            aria-label="3D 지구본 뷰"
        />
    );
}
