// Data Ingestion Types

/**
 * Raw data record from external sources (USGS, IEA, LME, etc.)
 */
export interface RawDataRecord {
    source: string;
    recordType: string;
    data: Record<string, unknown>;
}

/**
 * Normalized record after schema transformation.
 * Always includes source attribution and timestamp.
 */
export interface NormalizedRecord {
    id: string;
    source: string;
    timestamp: Date;
    recordType: string;
    data: Record<string, unknown>;
}

/**
 * Result of a normalization attempt.
 */
export type NormalizationResult =
    | { success: true; record: NormalizedRecord }
    | { success: false; errors: string[] };
