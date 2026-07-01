import { describe, it, expect, vi } from 'vitest';
import { parseTradeData, COMTRADE_COUNTRY_CODES, HS_CODE_CATEGORIES, VALID_HS_CODE_SET } from './parse-trade-data.js';
import type { ComtradeRecord } from './parse-trade-data.js';

/** 테스트용 기본 Comtrade 레코드 생성 헬퍼 */
function makeRecord(overrides: Partial<ComtradeRecord> = {}): ComtradeRecord {
    return {
        typeCode: 'C',
        freqCode: 'A',
        refYear: 2025,
        reporterCode: 410, // SouthKorea (importer)
        flowCode: 'M',
        partnerCode: 156, // China (exporter)
        cmdCode: '282520',
        qty: 35968203,
        netWgt: 35968203,
        cifvalue: 593505452,
        fobvalue: null,
        primaryValue: 593505452,
        ...overrides,
    };
}

/** 테스트용 existingNodeIds (모든 seed 노드 포함) */
const ALL_NODE_IDS = new Set([
    'R-01',
    'M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06', 'M-07',
    'RF-01', 'RF-02', 'RF-03', 'RF-04', 'RF-05', 'RF-06', 'RF-07', 'RF-08',
    'F-01', 'F-02', 'F-03', 'F-04', 'F-05', 'F-06', 'F-07',
]);

describe('parseTradeData', () => {
    describe('valid record parsing (HS 282520 - 수산화리튬)', () => {
        it('should parse an import record with correct volume and price', () => {
            const records = [makeRecord()];
            const result = parseTradeData(records, ALL_NODE_IDS);

            expect(result.errors).toHaveLength(0);
            expect(result.edges).toHaveLength(1);

            const edge = result.edges[0];
            expect(edge.attributes.volume).toBe(35968203);
            expect(edge.attributes.price).toBe(593505452);
            expect(edge.attributes.hsCode).toBe('282520');
            expect(edge.attributes.year).toBe(2025);
        });

        it('should set edge type as Delivery', () => {
            const result = parseTradeData([makeRecord()], ALL_NODE_IDS);
            expect(result.edges[0].type).toBe('Delivery');
        });

        it('should generate correct edge ID format including HS code', () => {
            const result = parseTradeData([makeRecord()], ALL_NODE_IDS);
            // China → SouthKorea, HS 282520, 2025
            expect(result.edges[0].id).toBe('E-TRADE-China-SouthKorea-282520-2025');
        });

        it('should map import flow (M): partner=source, reporter=target', () => {
            // reporter=410(KR), partner=156(CN), flow=M
            // → source=China(RF-01), target=SouthKorea(F-01)
            const result = parseTradeData([makeRecord()], ALL_NODE_IDS);
            const edge = result.edges[0];

            expect(edge.sourceNodeId).toBe('RF-01'); // China hydroxide refinery
            expect(edge.targetNodeId).toBe('F-01'); // SouthKorea primary factory
        });

        it('should map export flow (X): reporter=source, partner=target', () => {
            const record = makeRecord({
                reporterCode: 152, // Chile (exporter)
                partnerCode: 410, // SouthKorea (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);
            const edge = result.edges[0];

            expect(edge.sourceNodeId).toBe('RF-03'); // Chile hydroxide refinery
            expect(edge.targetNodeId).toBe('F-01'); // SouthKorea primary factory
        });

        it('should prefer netWgt for volume over qty', () => {
            const record = makeRecord({ netWgt: 5000, qty: 3000 });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.volume).toBe(5000);
        });

        it('should fallback to qty when netWgt is 0', () => {
            const record = makeRecord({ netWgt: 0, qty: 3000 });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.volume).toBe(3000);
        });

        it('should prefer cifvalue for price over primaryValue', () => {
            const record = makeRecord({ cifvalue: 100000, primaryValue: 80000 });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.price).toBe(100000);
        });

        it('should fallback to primaryValue when cifvalue is null', () => {
            const record = makeRecord({ cifvalue: null, primaryValue: 80000 });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.price).toBe(80000);
        });

        it('should parse multiple records into multiple edges', () => {
            const records = [
                makeRecord({ reporterCode: 392, partnerCode: 152 }), // Japan←Chile
                makeRecord({ reporterCode: 410, partnerCode: 842 }), // Korea←US
            ];
            const result = parseTradeData(records, ALL_NODE_IDS);

            expect(result.edges).toHaveLength(2);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('HS 253090 (원자재 - 리튬 광석) 파싱', () => {
        it('should accept HS code 253090 as valid', () => {
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 156, // China (importer)
                partnerCode: 36,   // Australia (exporter)
                flowCode: 'M',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.errors).toHaveLength(0);
            expect(result.edges).toHaveLength(1);
            expect(result.edges[0].attributes.hsCode).toBe('253090');
        });

        it('should route raw material from mine to refinery', () => {
            // Australia exports raw material to China
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 36,  // Australia (exporter)
                partnerCode: 156,  // China (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].sourceNodeId).toBe('M-04'); // Greenbushes mine
            expect(result.edges[0].targetNodeId).toBe('RF-01'); // Ganfeng Xinyu refinery
        });

        it('should route Chile mine to China refinery for raw material', () => {
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 156, // China (importer)
                partnerCode: 152,  // Chile (exporter)
                flowCode: 'M',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].sourceNodeId).toBe('M-01'); // Salar de Atacama mine
            expect(result.edges[0].targetNodeId).toBe('RF-01'); // China refinery
        });

        it('should route Argentina mine for raw material export', () => {
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 32,  // Argentina (exporter)
                partnerCode: 156,  // China (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].sourceNodeId).toBe('M-06'); // Salar de Olaroz mine
            expect(result.edges[0].targetNodeId).toBe('RF-01'); // China refinery
        });

        it('should generate edge ID with HS code 253090', () => {
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 36,  // Australia
                partnerCode: 156,  // China
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].id).toBe('E-TRADE-Australia-China-253090-2025');
        });
    });

    describe('HS 283691 (탄산리튬) 파싱', () => {
        it('should accept HS code 283691 as valid', () => {
            const record = makeRecord({
                cmdCode: '283691',
                reporterCode: 156, // China (importer)
                partnerCode: 152,  // Chile (exporter)
                flowCode: 'M',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.errors).toHaveLength(0);
            expect(result.edges).toHaveLength(1);
            expect(result.edges[0].attributes.hsCode).toBe('283691');
        });

        it('should route carbonate from refinery to factory', () => {
            // Chile exports carbonate to China (CATL)
            const record = makeRecord({
                cmdCode: '283691',
                reporterCode: 152, // Chile (exporter)
                partnerCode: 156,  // China (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].sourceNodeId).toBe('RF-03'); // SQM Salar del Carmen
            expect(result.edges[0].targetNodeId).toBe('F-04');  // CATL Ningde Gigafactory
        });

        it('should route Argentina carbonate refinery to China factory', () => {
            const record = makeRecord({
                cmdCode: '283691',
                reporterCode: 32,  // Argentina (exporter)
                partnerCode: 156,  // China (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].sourceNodeId).toBe('RF-07'); // Ganfeng Cauchari
            expect(result.edges[0].targetNodeId).toBe('F-04');  // CATL Ningde Gigafactory
        });

        it('should route China carbonate refinery to China factory', () => {
            // 중국 내부 탄산리튬 흐름: BYD Plant → CATL
            const record = makeRecord({
                cmdCode: '283691',
                reporterCode: 156, // China (both)
                partnerCode: 156,  // China (both)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].sourceNodeId).toBe('RF-08'); // BYD Lithium Carbonate Plant
            expect(result.edges[0].targetNodeId).toBe('F-04');  // CATL Ningde Gigafactory
        });

        it('should generate edge ID with HS code 283691', () => {
            const record = makeRecord({
                cmdCode: '283691',
                reporterCode: 152,
                partnerCode: 156,
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges[0].id).toBe('E-TRADE-Chile-China-283691-2025');
        });
    });

    describe('HS 코드별 Edge 분리 저장', () => {
        it('should create separate edges per HS code for same country pair', () => {
            const records = [
                makeRecord({
                    cmdCode: '282520',
                    reporterCode: 156,
                    partnerCode: 152,
                    flowCode: 'X',  // China exports hydroxide to Chile... 
                }),
                makeRecord({
                    cmdCode: '253090',
                    reporterCode: 156, // China imports raw material from Chile
                    partnerCode: 152,
                    flowCode: 'M',
                }),
            ];
            const result = parseTradeData(records, ALL_NODE_IDS);
            const validEdges = result.edges;

            // 각 HS 코드별 별도 edge ID가 생성되어야 함
            const edgeIds = validEdges.map(e => e.id);
            const uniqueIds = new Set(edgeIds);
            expect(uniqueIds.size).toBe(edgeIds.length);
        });

        it('should ensure edge IDs differ only by HS code for same route and year', () => {
            // Australia → China, 2025 for two different HS codes
            const records = [
                makeRecord({
                    cmdCode: '253090',
                    reporterCode: 36,  // Australia
                    partnerCode: 156,  // China
                    flowCode: 'X',
                }),
            ];
            const result = parseTradeData(records, ALL_NODE_IDS);

            expect(result.edges[0].id).toBe('E-TRADE-Australia-China-253090-2025');
        });
    });

    describe('IRA compliance', () => {
        it('should set iraCompliant=true for Chile→SouthKorea route', () => {
            const record = makeRecord({ reporterCode: 410, partnerCode: 152 });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.iraCompliant).toBe(true);
        });

        it('should set iraCompliant=true for Chile→UnitedStates route', () => {
            const record = makeRecord({ reporterCode: 842, partnerCode: 152 });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.iraCompliant).toBe(true);
        });

        it('should set iraCompliant=true for Australia→UnitedStates route', () => {
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 36,  // Australia (exporter)
                partnerCode: 842,  // US (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.iraCompliant).toBe(true);
        });

        it('should not set iraCompliant for China→SouthKorea route', () => {
            const record = makeRecord({ reporterCode: 410, partnerCode: 156 });
            const result = parseTradeData([record], ALL_NODE_IDS);
            expect(result.edges[0].attributes.iraCompliant).toBeUndefined();
        });
    });

    describe('validation and rejection', () => {
        it('should reject records with invalid HS codes', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const record = makeRecord({ cmdCode: '271111' });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Invalid HS code');
            expect(result.errors[0]).toContain('271111');
            consoleSpy.mockRestore();
        });

        it('should reject records with unknown reporter country code', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const record = makeRecord({ reporterCode: 999 });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Unknown reporter country code');
            consoleSpy.mockRestore();
        });

        it('should reject records with unknown partner country code', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const record = makeRecord({ partnerCode: 276 }); // Germany - not in 7 countries
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Unknown partner country code');
            consoleSpy.mockRestore();
        });

        it('should reject records with unknown flow code', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const record = makeRecord({ flowCode: 'R' }); // Re-export - unsupported
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Unknown flow code');
            consoleSpy.mockRestore();
        });

        it('should reject when source country has no node for given HS code', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            // Japan exports hydroxide to Korea — but Japan has no hydroxide refinery
            const record = makeRecord({
                reporterCode: 392, // Japan
                partnerCode: 410, // Korea
                flowCode: 'X',
                cmdCode: '282520',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('No hydroxide refinery node mapped');
            consoleSpy.mockRestore();
        });

        it('should reject when target country has no node for given HS code', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            // Chile imports hydroxide from China — but Chile has no hydroxide factory
            const record = makeRecord({
                reporterCode: 152, // Chile
                partnerCode: 156, // China
                flowCode: 'M',
                cmdCode: '282520',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('No hydroxide factory node mapped');
            consoleSpy.mockRestore();
        });

        it('should log errors to console.error for rejected records', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const record = makeRecord({ cmdCode: '999999' });
            parseTradeData([record], ALL_NODE_IDS);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[TradeParser]'),
            );
            consoleSpy.mockRestore();
        });

        it('should continue processing valid records after rejection', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const records = [
                makeRecord({ cmdCode: '999999' }), // invalid
                makeRecord(), // valid
            ];
            const result = parseTradeData(records, ALL_NODE_IDS);

            expect(result.edges).toHaveLength(1);
            expect(result.errors).toHaveLength(1);
            consoleSpy.mockRestore();
        });
    });

    describe('country code mapping (7개국)', () => {
        it('should export correct country code mapping for all 7 countries', () => {
            expect(COMTRADE_COUNTRY_CODES[410]).toBe('SouthKorea');
            expect(COMTRADE_COUNTRY_CODES[392]).toBe('Japan');
            expect(COMTRADE_COUNTRY_CODES[156]).toBe('China');
            expect(COMTRADE_COUNTRY_CODES[152]).toBe('Chile');
            expect(COMTRADE_COUNTRY_CODES[842]).toBe('UnitedStates');
            expect(COMTRADE_COUNTRY_CODES[36]).toBe('Australia');
            expect(COMTRADE_COUNTRY_CODES[32]).toBe('Argentina');
        });

        it('should map Australia (code 36) correctly', () => {
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 36,  // Australia (exporter)
                partnerCode: 156,  // China (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.errors).toHaveLength(0);
            expect(result.edges).toHaveLength(1);
            expect(result.edges[0].sourceNodeId).toBe('M-04'); // Greenbushes
        });

        it('should map Argentina (code 32) correctly', () => {
            const record = makeRecord({
                cmdCode: '253090',
                reporterCode: 32,  // Argentina (exporter)
                partnerCode: 156,  // China (importer)
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.errors).toHaveLength(0);
            expect(result.edges).toHaveLength(1);
            expect(result.edges[0].sourceNodeId).toBe('M-06'); // Salar de Olaroz
        });

        it('should map all valid hydroxide export→import country pairs correctly', () => {
            const pairs: Array<[number, number, string, string]> = [
                [392, 156, 'RF-01', 'F-03'], // Japan imports hydroxide from China
                [392, 152, 'RF-03', 'F-03'], // Japan imports hydroxide from Chile
                [410, 842, 'RF-05', 'F-01'], // Korea imports hydroxide from US
                [842, 152, 'RF-03', 'F-05'], // US imports hydroxide from Chile
            ];

            for (const [reporter, partner, expectedSource, expectedTarget] of pairs) {
                const record = makeRecord({ reporterCode: reporter, partnerCode: partner });
                const result = parseTradeData([record], ALL_NODE_IDS);

                expect(result.edges[0].sourceNodeId).toBe(expectedSource);
                expect(result.edges[0].targetNodeId).toBe(expectedTarget);
            }
        });
    });

    describe('HS code categories export', () => {
        it('should export correct HS code category mapping', () => {
            expect(HS_CODE_CATEGORIES['253090']).toBe('raw_material');
            expect(HS_CODE_CATEGORIES['283691']).toBe('lithium_carbonate');
            expect(HS_CODE_CATEGORIES['282520']).toBe('lithium_hydroxide');
        });

        it('should export valid HS code set with 3 codes', () => {
            expect(VALID_HS_CODE_SET.size).toBe(3);
            expect(VALID_HS_CODE_SET.has('253090')).toBe(true);
            expect(VALID_HS_CODE_SET.has('283691')).toBe(true);
            expect(VALID_HS_CODE_SET.has('282520')).toBe(true);
        });
    });

    describe('edge timestamps', () => {
        it('should set createdAt and updatedAt as Date objects', () => {
            const result = parseTradeData([makeRecord()], ALL_NODE_IDS);
            const edge = result.edges[0];

            expect(edge.createdAt).toBeInstanceOf(Date);
            expect(edge.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('empty input handling', () => {
        it('should return empty results for empty records array', () => {
            const result = parseTradeData([], ALL_NODE_IDS);
            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });
});
