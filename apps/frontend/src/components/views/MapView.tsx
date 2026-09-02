import { useState, useMemo, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView as DeckMapView } from '@deck.gl/core';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import { Map as MapGL } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { getNodeRadius, getRiskColor } from '../../utils/graph-helpers';
import { MapTooltip, type TooltipInfo } from './map/MapTooltip';

// 무료 다크 지도 스타일 (Mapbox 토큰 불필요)
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// 초기 뷰 상태 (세계 지도 중앙)
const INITIAL_VIEW_STATE = {
    longitude: 110,
    latitude: 20,
    zoom: 2,
    pitch: 0,
    bearing: 0,
};

export interface MapViewProps {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
    riskScores: Map<string, number>;
    onNodeClick?: (nodeId: string) => void;
}

// 아크 데이터 타입 (소스/타겟 노드 포함)
interface ArcData extends SupplyChainEdge {
    source: SupplyChainNode;
    target: SupplyChainNode;
}

/**
 * Deck.gl + Maplibre 기반 2D GIS 지도 뷰 컴포넌트.
 * - 27개 마스터 노드 중 지리 좌표를 가진 실제 시설 노드 렌더링 (Resource 가상 노드 제외)
 * - 물류 경로(엣지) 대권 아크 렌더링 (wrapLongitude를 통한 날짜변경선 끊김 방지)
 * - 노드/경로 호버 시 툴팁 표시
 */
export function MapView({ nodes, edges, riskScores, onNodeClick }: MapViewProps) {
    // 유효한 지리 좌표를 가진 노드만 필터링 (Resource 노드 및 가상 좌표 제외)
    const validNodes = useMemo(() => {
        return nodes.filter(
            (node) =>
                node.country !== 'NA' &&
                node.coordinates &&
                typeof node.coordinates.latitude === 'number' &&
                typeof node.coordinates.longitude === 'number' &&
                !isNaN(node.coordinates.latitude) &&
                !isNaN(node.coordinates.longitude) &&
                (node.coordinates.latitude !== 0 || node.coordinates.longitude !== 0)
        );
    }, [nodes]);

    // 툴팁 상태
    const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

    // 리스크 점수 기반 노드 색상 계산
    const getNodeColor = useCallback(
        (node: SupplyChainNode): [number, number, number, number] => {
            const score = riskScores.get(node.id) ?? 0;
            const riskColor = getRiskColor(score);
            return parseRgba(riskColor);
        },
        [riskScores],
    );

    // 노드 반지름 계산 (production_capacity 비례)
    const getRadius = useCallback((node: SupplyChainNode): number => {
        const baseRadius = getNodeRadius(node.metadata?.productionCapacity || 0, node.metadata?.capacityUnit || 'tons');
        // 지도에서는 km 단위로 확대 (약 50~150km)
        return baseRadius * 3000;
    }, []);

    // ScatterplotLayer: 노드 표시
    const nodeLayer = useMemo(() => {
        return new ScatterplotLayer<SupplyChainNode>({
            id: 'nodes-layer',
            data: validNodes,
            pickable: true,
            opacity: 0.85,
            stroked: true,
            filled: true,
            radiusMinPixels: 6,
            radiusMaxPixels: 35,
            lineWidthMinPixels: 2,
            wrapLongitude: true,
            getPosition: (d) => [d.coordinates.longitude, d.coordinates.latitude],
            getRadius: (d) => getRadius(d),
            getFillColor: (d) => getNodeColor(d),
            getLineColor: (d) => {
                const score = riskScores.get(d.id) ?? 0;
                if (score > 66) return [245, 34, 45, 255] as [number, number, number, number];
                if (score > 33) return [250, 173, 20, 255] as [number, number, number, number];
                return [82, 196, 26, 255] as [number, number, number, number];
            },
            updateTriggers: {
                getFillColor: [riskScores],
                getLineColor: [riskScores],
            },
        });
    }, [validNodes, riskScores, getNodeColor, getRadius]);

    // ArcLayer: 물류 경로 렌더링
    const arcLayer = useMemo(() => {
        // 유효 노드 매핑
        const nodeMap = new Map(validNodes.map((n) => [n.id, n]));
        const edgeData: ArcData[] = edges
            .map((edge) => {
                const source = nodeMap.get(edge.sourceNodeId);
                const target = nodeMap.get(edge.targetNodeId);
                if (!source || !target) return null;
                return { ...edge, source, target };
            })
            .filter((d): d is ArcData => d !== null);

        // 무역량 최대값 (아크 두께 정규화용)
        const maxVolume = Math.max(...edgeData.map((e) => e.attributes?.volume ?? 1), 1);

        return new ArcLayer<ArcData>({
            id: 'arcs-layer',
            data: edgeData,
            pickable: true,
            getSourcePosition: (d) => [d.source.coordinates.longitude, d.source.coordinates.latitude],
            getTargetPosition: (d) => [d.target.coordinates.longitude, d.target.coordinates.latitude],
            getSourceColor: [0, 180, 255, 170],
            getTargetColor: [255, 140, 50, 170],
            getWidth: (d) => {
                // 무역량에 비례하는 아크 두께 (1~7px)
                const volume = d.attributes?.volume ?? 1;
                return 1 + (volume / maxVolume) * 6;
            },
            greatCircle: false,
            wrapLongitude: true,
        });
    }, [validNodes, edges]);

    // 레이어 배열 구성
    const layers = useMemo(() => {
        const result = [];
        if (arcLayer) result.push(arcLayer);
        if (nodeLayer) result.push(nodeLayer);
        return result;
    }, [nodeLayer, arcLayer]);

    // 호버 이벤트 핸들러
    const handleHover = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (info: any) => {
            if (!info.object) {
                setTooltip(null);
                return;
            }

            const { x, y, layer, object } = info;

            if (layer?.id === 'nodes-layer') {
                // 노드 호버 툴팁
                const node = object as SupplyChainNode;
                const score = riskScores.get(node.id) ?? 0;
                setTooltip({
                    type: 'node',
                    x,
                    y,
                    data: {
                        name: node.name,
                        nodeType: node.type,
                        country: node.country,
                        productionCapacity: node.metadata?.productionCapacity || 0,
                        capacityUnit: node.metadata?.capacityUnit || 'tons',
                        riskScore: score,
                    },
                });
            } else if (layer?.id === 'arcs-layer') {
                // 경로(아크) 호버 툴팁
                const edge = object as ArcData;
                setTooltip({
                    type: 'edge',
                    x,
                    y,
                    data: {
                        sourceName: edge.source.name,
                        targetName: edge.target.name,
                        volume: edge.attributes?.volume,
                        price: edge.attributes?.price,
                    },
                });
            }
        },
        [riskScores],
    );

    // 클릭 이벤트 핸들러
    const handleClick = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (info: any) => {
            if (info.layer?.id === 'nodes-layer' && info.object && onNodeClick) {
                const node = info.object as SupplyChainNode;
                onNodeClick(node.id);
            }
        },
        [onNodeClick],
    );

    return (
        <div className="w-full h-full relative">
            <DeckGL
                views={new DeckMapView({ repeat: true })}
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={layers}
                onHover={handleHover}
                onClick={handleClick}
            >
                <MapGL mapStyle={MAP_STYLE} />
            </DeckGL>

            {/* 호버 툴팁 */}
            {tooltip && <MapTooltip info={tooltip} />}
        </div>
    );
}

/**
 * rgba/rgb CSS 문자열을 [r, g, b, a] 배열로 파싱.
 */
function parseRgba(color: string): [number, number, number, number] {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return [128, 128, 128, 200];

    const parts = match[1].split(',').map((s) => parseFloat(s.trim()));
    return [
        parts[0] ?? 128,
        parts[1] ?? 128,
        parts[2] ?? 128,
        parts[3] !== undefined ? Math.round(parts[3] * 255) : 200,
    ];
}
