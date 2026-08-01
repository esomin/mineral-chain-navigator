import type { RawDataRecord, NormalizedRecord, NormalizationResult } from '@navigator/shared';

/**
 * Validates a raw data record before normalization.
 * Returns an array of error messages (empty if valid).
 */
function validateRawRecord(raw: RawDataRecord): string[] {
    const errors: string[] = [];

    if (!raw.source || typeof raw.source !== 'string' || raw.source.trim() === '') {
        errors.push('source is required and must be a non-empty string');
    }

    if (!raw.recordType || typeof raw.recordType !== 'string' || raw.recordType.trim() === '') {
        errors.push('recordType is required and must be a non-empty string');
    }

    if (!raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
        errors.push('data is required and must be a non-null object');
    }

    return errors;
}

/**
 * Generates a unique ID for normalized records.
 */
function generateId(source: string, recordType: string, timestamp: Date): string {
    const ts = timestamp.getTime().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `${source}-${recordType}-${ts}-${rand}`;
}

/**
 * Normalizes a raw data record into the unified schema.
 * Assigns source attribution and timestamp.
 * Rejects invalid records with error logging.
 *
 * Requirements: 2.1, 2.4
 */
export function normalizeRecord(raw: RawDataRecord): NormalizationResult {
    const errors = validateRawRecord(raw);

    if (errors.length > 0) {
        console.error(
            `[Ingestion] Validation failed for record from source "${raw?.source ?? 'unknown'}":`,
            errors,
        );
        return { success: false, errors };
    }

    const timestamp = new Date();
    const normalized: NormalizedRecord = {
        id: generateId(raw.source, raw.recordType, timestamp),
        source: raw.source.trim(),
        timestamp,
        recordType: raw.recordType.trim(),
        data: { ...raw.data },
    };

    return { success: true, record: normalized };
}
