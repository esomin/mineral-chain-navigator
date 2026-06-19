import { describe, it, expect, vi } from 'vitest';
import { normalizeRecord } from './normalize.js';
import type { RawDataRecord } from '@mineral-chain/shared';

describe('normalizeRecord', () => {
    it('should normalize a valid raw record with source and timestamp', () => {
        const raw: RawDataRecord = {
            source: 'USGS',
            recordType: 'mine_production',
            data: { mineral: 'lithium', output: 50000 },
        };

        const result = normalizeRecord(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.record.source).toBe('USGS');
            expect(result.record.recordType).toBe('mine_production');
            expect(result.record.timestamp).toBeInstanceOf(Date);
            expect(result.record.id).toBeTruthy();
            expect(result.record.data).toEqual({ mineral: 'lithium', output: 50000 });
        }
    });

    it('should reject a record with empty source', () => {
        const raw: RawDataRecord = {
            source: '',
            recordType: 'trade',
            data: { volume: 100 },
        };

        const result = normalizeRecord(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors).toContain('source is required and must be a non-empty string');
        }
    });

    it('should reject a record with missing recordType', () => {
        const raw = {
            source: 'IEA',
            recordType: '',
            data: { price: 25.5 },
        } as RawDataRecord;

        const result = normalizeRecord(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors).toContain('recordType is required and must be a non-empty string');
        }
    });

    it('should reject a record with null data', () => {
        const raw = {
            source: 'LME',
            recordType: 'price',
            data: null,
        } as unknown as RawDataRecord;

        const result = normalizeRecord(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors).toContain('data is required and must be a non-null object');
        }
    });

    it('should log errors to console.error on validation failure', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const raw = {
            source: '',
            recordType: '',
            data: null,
        } as unknown as RawDataRecord;

        normalizeRecord(raw);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should trim whitespace from source and recordType', () => {
        const raw: RawDataRecord = {
            source: '  USGS  ',
            recordType: '  trade_data  ',
            data: { country: 'AU' },
        };

        const result = normalizeRecord(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.record.source).toBe('USGS');
            expect(result.record.recordType).toBe('trade_data');
        }
    });

    it('should not mutate the original data object', () => {
        const originalData = { mineral: 'cobalt', amount: 1000 };
        const raw: RawDataRecord = {
            source: 'USGS',
            recordType: 'production',
            data: originalData,
        };

        const result = normalizeRecord(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            result.record.data.extra = 'added';
            expect(originalData).not.toHaveProperty('extra');
        }
    });
});
