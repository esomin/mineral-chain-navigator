import type { SupplyChainEdge, Country, HsCodeCategory } from '@navigator/shared';

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

/**
 * 유효한 HS 코드 목록 (3개 지정 코드).
 * - 253090: 리튬 광석 (HS 2530.90)
 * - 283691: 탄산리튬 (HS 2836.91)
 * - 282520: 수산화리튬 (HS 2825.20)
 */
const VALID_HS_CODES: Set<string> = new Set(['253090', '283691', '282520']);

/**
 * HS 코드 → HsCodeCategory 매핑.
 */
const HS_CODE_CATEGORY_MAP: Record<string, HsCodeCategory> = {
    '253090': 'raw_material',
    '283691': 'lithium_carbonate',
    '282520': 'lithium_hydroxide',
};

/**
 * UN Comtrade M49 국가 코드 → Country 매핑 (7개국).
 */
const COUNTRY_CODE_MAP: Record<number, Country> = {
    410: 'SouthKorea',
    392: 'Japan',
    156: 'China',
    152: 'Chile',
    842: 'UnitedStates',
    36: 'Australia',
    32: 'Argentina',
};

/**
 * HS 2530.90 (원자재) 광산 매핑: 수출국 → Mine 노드 ID.
 * 원자재 흐름은 광산에서 제련소로 이동.
 */
const COUNTRY_PRIMARY_MINE: Partial<Record<Country, string>> = {
    Chile: 'M-01',
    China: 'M-02',
    UnitedStates: 'M-03',
    Australia: 'M-04',
    Argentina: 'M-06',
};

/**
 * HS 2530.90 (원자재) 수입국 → Refinery 노드 ID (타겟).
 * 원자재는 제련소로 공급됨.
 */
const COUNTRY_RAW_MATERIAL_TARGET_REFINERY: Partial<Record<Country, string>> = {
    China: 'RF-01',
    Chile: 'RF-03',
    SouthKorea: 'RF-04',
    UnitedStates: 'RF-05',
    Australia: 'RF-06',
    Argentina: 'RF-07',
};

/**
 * HS 2836.91 (탄산리튬) 제련소 매핑: 수출국 → Refinery 노드 ID (소스).
 */
const COUNTRY_CARBONATE_REFINERY: Partial<Record<Country, string>> = {
    Chile: 'RF-03',
    Argentina: 'RF-07',
    China: 'RF-08',
};

/**
 * HS 2836.91 (탄산리튬) 수입국 → Factory 노드 ID (타겟).
 * 탄산리튬은 LFP 배터리 공장으로 공급됨.
 */
const COUNTRY_CARBONATE_FACTORY: Partial<Record<Country, string>> = {
    China: 'F-04',
    // CATL Ningde Gigafactory (LFP 배터리 주력)
};

/**
 * HS 2825.20 (수산화리튬) 국가별 primary refinery (수출국 소스 노드).
 */
const COUNTRY_HYDROXIDE_REFINERY: Partial<Record<Country, string>> = {
    China: 'RF-01',
    Chile: 'RF-03',
    SouthKorea: 'RF-04',
    UnitedStates: 'RF-05',
    Australia: 'RF-06',
};

/**
 * HS 2825.20 (수산화리튬) 국가별 primary factory (수입국 타겟 노드).
 */
const COUNTRY_HYDROXIDE_FACTORY: Partial<Record<Country, string>> = {
    SouthKorea: 'F-01',
    Japan: 'F-03',
    China: 'F-04',
    UnitedStates: 'F-05',
};

/**
 * IRA 준수 여부 판별.
 * Chile→US, Chile→SouthKorea 루트는 FTA 파트너로 IRA 준수.
 * Australia→US 루트도 FTA 파트너로 IRA 준수.
 */
function isIraCompliant(sourceCountry: Country, targetCountry: Country): boolean {
    if (sourceCountry === 'Chile' && (targetCountry === 'UnitedStates' || targetCountry === 'SouthKorea')) {
        return true;
    }
    if (sourceCountry === 'Australia' && targetCountry === 'UnitedStates') {
        return true;
    }
    return false;
}

/**
 * 엣지 ID 생성: E-TRADE-{sourceCountry}-{targetCountry}-{hsCode}-{year}
 * HS 코드별 Edge 분리 저장을 위해 hsCode 포함.
 */
function generateEdgeId(sourceCountry: Country, targetCountry: Country, hsCode: string, year: number): string {
    return `E-TRADE-${sourceCountry}-${targetCountry}-${hsCode}-${year}`;
}

/**
 * HS 코드에 따른 소스 노드 ID 결정.
 * - 253090 (원자재): 광산 노드
 * - 283691 (탄산리튬): 탄산리튬 제련소 노드
 * - 282520 (수산화리튬): 수산화리튬 제련소 노드
 */
function resolveSourceNodeId(country: Country, hsCode: string): string | null {
    switch (hsCode) {
        case '253090':
            return COUNTRY_PRIMARY_MINE[country] ?? null;
        case '283691':
            return COUNTRY_CARBONATE_REFINERY[country] ?? null;
        case '282520':
            return COUNTRY_HYDROXIDE_REFINERY[country] ?? null;
        default:
            return null;
    }
}

/**
 * HS 코드에 따른 타겟 노드 ID 결정.
 * - 253090 (원자재): 제련소 노드
 * - 283691 (탄산리튬): LFP 배터리 공장 노드
 * - 282520 (수산화리튬): NCM 배터리 공장 노드
 */
function resolveTargetNodeId(country: Country, hsCode: string): string | null {
    switch (hsCode) {
        case '253090':
            return COUNTRY_RAW_MATERIAL_TARGET_REFINERY[country] ?? null;
        case '283691':
            return COUNTRY_CARBONATE_FACTORY[country] ?? null;
        case '282520':
            return COUNTRY_HYDROXIDE_FACTORY[country] ?? null;
        default:
            return null;
    }
}

/**
 * HS 코드에 따른 노드 역할 설명 (에러 메시지용).
 */
function getSourceRoleLabel(hsCode: string): string {
    switch (hsCode) {
        case '253090':
            return 'mine';
        case '283691':
            return 'carbonate refinery';
        case '282520':
            return 'hydroxide refinery';
        default:
            return 'source';
    }
}

function getTargetRoleLabel(hsCode: string): string {
    switch (hsCode) {
        case '253090':
            return 'refinery';
        case '283691':
            return 'carbonate factory';
        case '282520':
            return 'hydroxide factory';
        default:
            return 'target';
    }
}

/**
 * Comtrade API 응답 레코드를 SupplyChainEdge 배열로 파싱한다.
 *
 * - flowCode "M": reporter = importer (destination), partner = exporter (source)
 * - flowCode "X": reporter = exporter (source), partner = importer (destination)
 * - cmdCode가 3개 지정 HS 코드(253090, 283691, 282520) 중 하나여야 유효
 * - 7개 지정국(KR, JP, CN, CL, US, AU, AR)만 유효
 *
 * HS 코드별 노드 해석:
 * - 253090 (원자재): 소스=광산, 타겟=제련소
 * - 283691 (탄산리튬): 소스=제련소(탄산리튬), 타겟=공장(LFP)
 * - 282520 (수산화리튬): 소스=제련소(수산화리튬), 타겟=공장(NCM)
 */
export function parseTradeData(
    records: ComtradeRecord[],
    existingNodeIds: Set<string>,
): TradeParseResult {
    const edges: SupplyChainEdge[] = [];
    const errors: string[] = [];

    for (const record of records) {
        // HS 코드 검증: 3개 지정 코드만 유효
        if (!VALID_HS_CODES.has(record.cmdCode)) {
            const validCodes = Array.from(VALID_HS_CODES).join(', ');
            const msg = `Invalid HS code "${record.cmdCode}" (expected one of: ${validCodes}), reporter=${record.reporterCode}, partner=${record.partnerCode}`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        const hsCode = record.cmdCode;

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

        // flowCode에 따라 source/target 국가 결정
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

        // HS 코드별 소스/타겟 노드 ID 결정
        const sourceNodeId = resolveSourceNodeId(sourceCountry, hsCode);
        if (!sourceNodeId) {
            const roleLabel = getSourceRoleLabel(hsCode);
            const msg = `No ${roleLabel} node mapped for source country "${sourceCountry}" (HS ${hsCode}) — skipping record (reporter=${record.reporterCode}, partner=${record.partnerCode})`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        const targetNodeId = resolveTargetNodeId(targetCountry, hsCode);
        if (!targetNodeId) {
            const roleLabel = getTargetRoleLabel(hsCode);
            const msg = `No ${roleLabel} node mapped for target country "${targetCountry}" (HS ${hsCode}) — skipping record (reporter=${record.reporterCode}, partner=${record.partnerCode})`;
            errors.push(msg);
            console.error(`[TradeParser] ${msg}`);
            continue;
        }

        // volume: netWgt 우선, qty fallback
        const volume = record.netWgt || record.qty || 0;

        // price: flowCode에 따라 fob/cif 선택
        let price: number;
        let priceType: 'fob' | 'cif';
        if (record.flowCode === 'X') {
            price = record.fobvalue ?? record.primaryValue ?? 0;
            priceType = 'fob';
        } else {
            price = record.cifvalue ?? record.primaryValue ?? 0;
            priceType = 'cif';
        }

        // unitPrice: 단가 (USD/kg)
        const unitPrice = volume > 0 ? Math.round((price / volume) * 100) / 100 : 0;

        const year = record.refYear;
        const edgeId = generateEdgeId(sourceCountry, targetCountry, hsCode, year);
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
                unitPrice,
                priceType,
                hsCode,
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
 * 국가 코드 매핑 테이블 (외부 참조용 export)
 */
export const COMTRADE_COUNTRY_CODES = COUNTRY_CODE_MAP;

/**
 * HS 코드 분류 카테고리 매핑 (외부 참조용 export)
 */
export const HS_CODE_CATEGORIES = HS_CODE_CATEGORY_MAP;

/**
 * 유효 HS 코드 집합 (외부 참조용 export)
 */
export const VALID_HS_CODE_SET = VALID_HS_CODES;
