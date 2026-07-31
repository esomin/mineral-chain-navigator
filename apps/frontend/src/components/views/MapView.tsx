import { useState, useMemo, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import { Map as MapGL } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SupplyChainNode, SupplyChainEdge } from '@navigator/shared';
import { getCountryColor, getNodeRadius, getRiskColor } from '../../utils/graph-helpers';
import { MapLayerToggle, type MapLayerState } from './map/MapLayerToggle';
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
 * Deck.gl + Maplibre 기반 GIS 지도 뷰 컴포넌트.
 * - ScatterplotLayer로 27개 마스터 노드를 지리 좌표에 표시
 * - ArcLayer로 물류 경로(엣지) 라인 렌더링
 * - 레이어 토글 (노드 타입, 리스크 레벨, 무역량)
 * - 노드/경로 호버 시 툴팁 표시
 */
export function MapView({ nodes, edges, riskScores, onNodeClick }: MapViewProps) {
    // 레이어 토글 상태
    const [layerState, setLayerState] = useState<MapLayerState>({
        showNodeType: true,
        showRiskLevel: true,
        showTradeVolume: true,
    });

    // 툴팁 상태
    const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

    // 리스크 점수 기반 노드 색상 계산
    const getNodeColor = useCallback(
        (node: SupplyChainNode): [number, number, number, number] => {
            if (layerState.showRiskLevel) {
                // 리스크 레벨 기준 색상
                const score = riskScores.get(node.id) ?? 0;
                const riskColor = getRiskColor(score);
                return parseRgba(riskColor);
            }
            // 국가 기준 색상
            const countryColor = getCountryColor(node.country);
            return parseRgba(countryColor);
        },
        [riskScores, layerState.showRiskLevel],
    );

    // 노드 반지름 계산 (production_capacity 비례)
    const getRadius = useCallback((node: SupplyChainNode): number => {
        const baseRadius = getNodeRadius(node.metadata.productionCapacity, node.metadata.capacityUnit);
        // 지도에서는 km 단위로 확대 (약 50~150km)
        return baseRadius * 3000;
    }, []);

    // ScatterplotLayer: 노드 표시
    const nodeLayer = useMemo(() => {
        if (!layerState.showNodeType) return null;

        return new ScatterplotLayer<SupplyChainNode>({
            id: 'nodes-layer',
            data: nodes,
            pickable: true,
            opacity: 0.85,
            stroked: true,
            filled: true,
            radiusMinPixels: 6,
            radiusMaxPixels: 40,
            lineWidthMinPixels: 2,
            getPosition: (d) => [d.coordinates.longitude, d.coordinates.latitude],
            getRadius: (d) => getRadius(d),
            getFillColor: (d) => getNodeColor(d),
            getLineColor: (d) => {
                // 리스크 레벨 테두리 색상
                if (layerState.showRiskLevel) {
                    const score = riskScores.get(d.id) ?? 0;
                    if (score > 66) return [245, 34, 45, 255] as [number, number, number, number];
                    if (score > 33) return [250, 173, 20, 255] as [number, number, number, number];
                    return [82, 196, 26, 255] as [number, number, number, number];
                }
                return [100, 100, 100, 200] as [number, number, number, number];
            },
            updateTriggers: {
                getFillColor: [layerState.showRiskLevel, riskScores],
                getLineColor: [layerState.showRiskLevel, riskScores],
            },
        });
    }, [nodes, riskScores, layerState.showNodeType, layerState.showRiskLevel, getNodeColor, getRadius]);

    // ArcLayer: 물류 경로 렌더링
    const arcLayer = useMemo(() => {
        if (!layerState.showTradeVolume) return null;

        // 엣지 데이터에 소스/타겟 노드 좌표 매핑
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        const edgeData: ArcData[] = edges
            .map((edge) => {
                const source = nodeMap.get(edge.sourceNodeId);
                const target = nodeMap.get(edge.targetNodeId);
                if (!source || !target) return null;
                return { ...edge, source, target };
            })
            .filter((d): d is ArcData => d !== null);

        // 무역량 최대값 (아크 두께 정규화용)
        const maxVolume = Math.max(...edgeData.map((e) => e.attributes.volume ?? 1), 1);

        return new ArcLayer<ArcData>({
            id: 'arcs-layer',
            data: edgeData,
            pickable: true,
            getSourcePosition: (d) => [d.source.coordinates.longitude, d.source.coordinates.latitude],
            getTargetPosition: (d) => [d.target.coordinates.longitude, d.target.coordinates.latitude],
            getSourceColor: [0, 128, 255, 160],
            getTargetColor: [255, 100, 50, 160],
            getWidth: (d) => {
                // 무역량에 비례하는 아크 두께 (1~8px)
                const volume = d.attributes.volume ?? 1;
                return 1 + (volume / maxVolume) * 7;
            },
            greatCircle: true,
        });
    }, [nodes, edges, layerState.showTradeVolume]);

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
                        productionCapacity: node.metadata.productionCapacity,
                        capacityUnit: node.metadata.capacityUnit,
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
                        volume: edge.attributes.volume,
                        price: edge.attributes.price,
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
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={layers}
                onHover={handleHover}
                onClick={handleClick}
            >
                <MapGL mapStyle={MAP_STYLE} />
            </DeckGL>

            {/* 레이어 토글 컨트롤 패널 */}
            <MapLayerToggle layerState={layerState} onChange={setLayerState} />

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
