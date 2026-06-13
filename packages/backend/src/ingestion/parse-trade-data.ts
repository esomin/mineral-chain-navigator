import type { SupplyChainEdge, Country } from '@mineral-chain/shared';

/**
 * UN Comtrade API 응답의 개별 레코드 인터페이스.
 */
export interface ComtradeRecord {
    typeCode: string;
    freqCode: string;
    refYear: number;
    reporterCode: number;
    flowCode: string; // "M" = import, "X" = export
    partnerCode: number;
    cmdCode: string;
    qty: number;
    netWgt: number;
    cifvalue: number | null;
    fobvalue: number | null;
    primaryValue: number;
    [key: string]: unknown;
}

/**
 * 무역 데이터 파싱 결과.
 */
export interface TradeParseResult {
    edges: SupplyChainEdge[];
    errors: string[];
}

/** HS 코드: 수산화리튬 */
const VALID_HS_CODE = '282520';

/**
 * UN Comtrade M49 국가 코드 → Country 매핑.
 */
const COUNTRY_CODE_MAP: Record<number, Country> = {
    410: 'SouthKorea',
    392: 'Japan',
    156: 'China',
    152: 'Chile',
    842: 'UnitedStates',
};

/**
 * 국가별 primary refinery (수출자 측 소스 노드).
 * 해당 국가에 정제소가 없으면 매핑하지 않음 → 엣지 거부.
 */
const COUNTRY_PRIMARY_REFINERY: Partial<Record<Country, string>> = {
    China: 'RF-01',
    Chile: 'RF-03',
    SouthKorea: 'RF-04',
    UnitedStates: 'RF-05',
    // Japan: 정제소 없음 → 수출국으로 나타나면 거부
    // NA: 해당 없음
};

/**
 * 국가별 primary factory (수입자 측 타겟 노드).
 * 해당 국가에 공장이 없으면 매핑하지 않음 → 엣지 거부.
 */
const COUNTRY_PRIMARY_FACTORY: Partial<Record<Country, string>> = {
    SouthKorea: 'F-01',
    Japan: 'F-03',
    China: 'F-04',
    UnitedStates: 'F-05',
    // Chile: 공장 없음 → 수입국으로 나타나면 거부
    // NA: 해당 없음
};

/**
 * IRA 준수 여부 판별.
 * Chile→US, Chile→SouthKorea 루트는 FTA 파트너로 IRA 준수.
 */
function isIraCompliant(sourceCountry: Country, targetCountry: Country): boolean {
    if (sourceCountry === 'Chile' && (targetCountry === 'UnitedStates' || targetCountry === 'SouthKorea')) {
        return true;
    }
    return false;
}

/**
 * 엣지 ID 생성: E-TRADE-{sourceCountry}-{targetCountry}-{year}
 */
function generateEdgeId(sourceCountry: Country, targetCountry: Country, year: number): string {
    return `E-TRADE-${sourceCountry}-${targetCountry}-${year}`;
}

/**
 * Comtrade API 응답 레코드를 SupplyChainEdge 배열로 파싱한다.
 *
 * - flowCode "M": reporter = importer (destination), partner = exporter (source)
 * - flowCode "X": reporter = exporter (source), partner = importer (destination)
 * - cmdCode "282520"만 유효
 * - 5개 지정국(KR, JP, CN, CL, US)만 유효
 *
 * - 무역 레코드를 Edge의 volume/price 속성으로 매핑
 * - 수출국은 해당 국가 primary refinery, 수입국은 primary factory로 매핑
 */
export function parseTradeData(
    records: ComtradeRecord[],
    existingNodeIds: Set<string>,
): TradeParseResult {
    const edges: SupplyChainEdge[] = [];
    const errors: string[] = [];

    for (const record of records) {
        // HS 코드 검증
        if (record.cmdCode !== VALID_HS_CODE) {
            const msg = `Invalid HS code "${record.cmdCode}" (expected ${VALID_HS_CODE}), reporter=${record.reporterCode}, partner=${record.partnerCode}`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        // reporter/partner 국가 매핑
        const reporterCountry = COUNTRY_CODE_MAP[record.reporterCode];
        const partnerCountry = COUNTRY_CODE_MAP[record.partnerCode];

        if (!reporterCountry) {
            const msg = `Unknown reporter country code: ${record.reporterCode}`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        if (!partnerCountry) {
            const msg = `Unknown partner country code: ${record.partnerCode}`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        // flowCode에 따라 source/target 결정
        let sourceCountry: Country;
        let targetCountry: Country;

        if (record.flowCode === 'M') {
            // Import: reporter = importer (destination), partner = exporter (source)
            sourceCountry = partnerCountry;
            targetCountry = reporterCountry;
        } else if (record.flowCode === 'X') {
            // Export: reporter = exporter (source), partner = importer (destination)
            sourceCountry = reporterCountry;
            targetCountry = partnerCountry;
        } else {
            const msg = `Unknown flow code "${record.flowCode}" for reporter=${record.reporterCode}, partner=${record.partnerCode}`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        // 소스/타겟 노드 ID 결정 (매핑 없으면 거부)
        const sourceNodeId = resolveNodeId(sourceCountry, 'source', existingNodeIds);
        if (!sourceNodeId) {
            const msg = `No refinery node mapped for source country "${sourceCountry}" — skipping record (reporter=${record.reporterCode}, partner=${record.partnerCode})`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        const targetNodeId = resolveNodeId(targetCountry, 'target', existingNodeIds);
        if (!targetNodeId) {
            const msg = `No factory node mapped for target country "${targetCountry}" — skipping record (reporter=${record.reporterCode}, partner=${record.partnerCode})`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        // volume: netWgt 우선, qty fallback
        const volume = record.netWgt || record.qty || 0;

        // price: cifvalue 우선, primaryValue fallback
        const price = record.cifvalue ?? record.primaryValue ?? 0;

        const year = record.refYear;
        const edgeId = generateEdgeId(sourceCountry, targetCountry, year);
        const iraCompliant = isIraCompliant(sourceCountry, targetCountry);
        const now = new Date();

        const edge: SupplyChainEdge = {
            id: edgeId,
            type: 'Delivery',
            sourceNodeId,
            targetNodeId,
            attributes: {
                volume,
                price,
                hsCode: VALID_HS_CODE,
                year,
                ...(iraCompliant ? { iraCompliant: true } : {}),
            },
            createdAt: now,
            updatedAt: now,
        };

        edges.push(edge);
    }

    return { edges, errors };
}

/**
 * 국가에 해당하는 노드 ID를 반환한다.
 * 해당 역할(source=정제소, target=공장)에 매핑되는 노드가 없으면 null 반환.
 */
function resolveNodeId(
    country: Country,
    role: 'source' | 'target',
    existingNodeIds: Set<string>,
): string | null {
    const mapping = role === 'source' ? COUNTRY_PRIMARY_REFINERY : COUNTRY_PRIMARY_FACTORY;
    const primaryId = mapping[country];

    if (!primaryId) {
        return null;
    }

    return primaryId;
}

/**
 * 국가 코드 매핑 테이블 (외부 참조용 export)
 */
export const COMTRADE_COUNTRY_CODES = COUNTRY_CODE_MAP;
