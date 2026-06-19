import { describe, it, expect, vi } from 'vitest';
import { parseTradeData, COMTRADE_COUNTRY_CODES } from './parse-trade-data.js';
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
    'RF-01', 'RF-02', 'RF-03', 'RF-04', 'RF-05',
    'F-01', 'F-02', 'F-03', 'F-04', 'F-05',
]);

describe('parseTradeData', () => {
    describe('valid record parsing', () => {
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

        it('should generate correct edge ID format', () => {
            const result = parseTradeData([makeRecord()], ALL_NODE_IDS);
            // China → SouthKorea, 2025
            expect(result.edges[0].id).toBe('E-TRADE-China-SouthKorea-2025');
        });

        it('should map import flow (M): partner=source, reporter=target', () => {
            // reporter=410(KR), partner=156(CN), flow=M
            // → source=China(RF-01), target=SouthKorea(F-01)
            const result = parseTradeData([makeRecord()], ALL_NODE_IDS);
            const edge = result.edges[0];

            expect(edge.sourceNodeId).toBe('RF-01'); // China primary refinery
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

            expect(edge.sourceNodeId).toBe('RF-03'); // Chile primary refinery
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
            const record = makeRecord({ partnerCode: 276 }); // Germany - not in 5 countries
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

    describe('country code mapping', () => {
        it('should export correct country code mapping', () => {
            expect(COMTRADE_COUNTRY_CODES[410]).toBe('SouthKorea');
            expect(COMTRADE_COUNTRY_CODES[392]).toBe('Japan');
            expect(COMTRADE_COUNTRY_CODES[156]).toBe('China');
            expect(COMTRADE_COUNTRY_CODES[152]).toBe('Chile');
            expect(COMTRADE_COUNTRY_CODES[842]).toBe('UnitedStates');
        });

        it('should map all valid export→import country pairs correctly', () => {
            const pairs: Array<[number, number, string, string]> = [
                [392, 156, 'RF-01', 'F-03'], // Japan imports from China
                [392, 152, 'RF-03', 'F-03'], // Japan imports from Chile
                [410, 842, 'RF-05', 'F-01'], // Korea imports from US
                [842, 152, 'RF-03', 'F-05'], // US imports from Chile
            ];

            for (const [reporter, partner, expectedSource, expectedTarget] of pairs) {
                const record = makeRecord({ reporterCode: reporter, partnerCode: partner });
                const result = parseTradeData([record], ALL_NODE_IDS);

                expect(result.edges[0].sourceNodeId).toBe(expectedSource);
                expect(result.edges[0].targetNodeId).toBe(expectedTarget);
            }
        });

        it('should reject when source country has no refinery (e.g. Japan as exporter)', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            // Japan exports to Korea — but Japan has no refinery node
            const record = makeRecord({
                reporterCode: 392, // Japan
                partnerCode: 410, // Korea
                flowCode: 'X',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('No refinery node mapped');
            consoleSpy.mockRestore();
        });

        it('should reject when target country has no factory (e.g. Chile as importer)', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            // Chile imports from China — but Chile has no factory node
            const record = makeRecord({
                reporterCode: 152, // Chile
                partnerCode: 156, // China
                flowCode: 'M',
            });
            const result = parseTradeData([record], ALL_NODE_IDS);

            expect(result.edges).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('No factory node mapped');
            consoleSpy.mockRestore();
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
