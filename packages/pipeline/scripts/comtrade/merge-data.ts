/**
 * raw-export와 raw-import 데이터를 병합하여 comtrade-api-response.json 생성.
 *
 * 전략:
 * - 수출(X) 데이터를 우선 사용
 * - X에서 특정 수출국 데이터가 없으면 → 수입(M) 데이터로 보완
 * - 각 레코드에 dataSource 태깅 ('reporter-X' | 'partner-M')
 *
 * 단독 실행: npx tsx packages/seed-data/scripts/merge-comtrade-data.ts
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PERIOD = '2025';
const EXPORTER_CODES = [156, 152, 842]; // 중국, 칠레, 미국

// 국가명 매핑
interface ComtradeCountry { id: number; text: string; }
const countriesPath = join(__dirname, '..', '..', 'data', 'raw', 'comtrade', 'comtrade-countries.json');
const countries: ComtradeCountry[] = JSON.parse(readFileSync(countriesPath, 'utf-8'));
const countryNameMap = new Map<number, string>(countries.map((c) => [c.id, `${c.text}(${c.id})`]));

// 파일 경로
const exportPath = join(__dirname, '..', '..', 'data', 'raw', 'comtrade', `raw-export-${PERIOD}.json`);
const importPath = join(__dirname, '..', '..', 'data', 'raw', 'comtrade', `raw-import-${PERIOD}.json`);
const outputPath = join(__dirname, '..', '..', 'data', 'raw', 'comtrade', 'comtrade-api-response.json');

interface ComtradeRecord {
    reporterCode: number;
    partnerCode: number;
    flowCode: string;
    netWgt: number;
    fobvalue: number | null;
    cifvalue: number | null;
    primaryValue: number;
    [key: string]: unknown;
}

interface MergedRecord extends ComtradeRecord {
    dataSource: 'reporter-X' | 'partner-M';
}

function main() {
    console.log('=== Comtrade 데이터 병합 ===');

    // Export 데이터 로드
    const mergedRecords: MergedRecord[] = [];
    const coveredExporters = new Set<number>();

    if (existsSync(exportPath)) {
        const exportData = JSON.parse(readFileSync(exportPath, 'utf-8'));
        const records: ComtradeRecord[] = exportData.data ?? [];
        console.log(`[Export] ${records.length}건 로드`);

        for (const record of records) {
            coveredExporters.add(record.reporterCode);
            mergedRecords.push({ ...record, dataSource: 'reporter-X' });
        }
    } else {
        console.log(`[Export] ${exportPath} 없음 — 건너뜀`);
    }

    // 누락된 수출국 확인
    const missingExporters = EXPORTER_CODES.filter((code) => !coveredExporters.has(code));

    if (missingExporters.length > 0 && existsSync(importPath)) {
        const importData = JSON.parse(readFileSync(importPath, 'utf-8'));
        const records: ComtradeRecord[] = importData.data ?? [];
        console.log(`[Import] ${records.length}건 로드`);
        console.log(`  Fallback 대상: ${missingExporters.map((c) => countryNameMap.get(c)).join(', ')}`);

        // 누락 수출국에 해당하는 레코드만 추가
        // M 레코드에서 partnerCode = 수출국
        const fallbackRecords = records.filter((r) => missingExporters.includes(r.partnerCode));
        console.log(`  적용: ${fallbackRecords.length}건`);

        for (const record of fallbackRecords) {
            mergedRecords.push({ ...record, dataSource: 'partner-M' });
        }
    } else if (missingExporters.length > 0) {
        console.log(`[Import] ${importPath} 없음 — fallback 불가`);
        console.log(`  ⚠ 누락 수출국: ${missingExporters.map((c) => countryNameMap.get(c)).join(', ')}`);
    } else {
        console.log('[Import] Fallback 불필요 — 모든 수출국 커버됨');
    }

    // 요약 출력
    console.log(`\n[Result] 총 ${mergedRecords.length}건`);
    console.log(`  X(수출국 보고): ${mergedRecords.filter((r) => r.dataSource === 'reporter-X').length}건`);
    console.log(`  M(수입국 보고, fallback): ${mergedRecords.filter((r) => r.dataSource === 'partner-M').length}건`);

    if (mergedRecords.length > 0) {
        console.log('\n--- 병합 결과 ---');
        for (const record of mergedRecords) {
            const reporter = record.reporterCode;
            const partner = record.partnerCode;
            const netWgt = record.netWgt ?? 0;
            const value = record.fobvalue ?? record.cifvalue ?? record.primaryValue ?? 0;
            const tag = record.dataSource === 'reporter-X' ? 'X' : 'M↔';

            if (record.dataSource === 'partner-M') {
                // M: reporter=수입국, partner=수출국 → "수출국 → 수입국" 방향으로 표시
                console.log(`  ${countryNameMap.get(partner)} → ${countryNameMap.get(reporter)}: ${(netWgt / 1000).toFixed(0)}t, $${(value / 1e6).toFixed(1)}M [${tag}]`);
            } else {
                console.log(`  ${countryNameMap.get(reporter)} → ${countryNameMap.get(partner)}: ${(netWgt / 1000).toFixed(0)}t, $${(value / 1e6).toFixed(1)}M [${tag}]`);
            }
        }
    }

    // 출력 파일 저장
    const output = {
        count: mergedRecords.length,
        period: PERIOD,
        hsCode: '253090,283691,282520',
        strategy: missingExporters.length > 0
            ? `X-primary with M-fallback for ${missingExporters.map((c) => countryNameMap.get(c)).join(', ')}`
            : 'X-only (all exporters reported)',
        mergedAt: new Date().toISOString(),
        data: mergedRecords,
    };

    writeFileSync(outputPath, JSON.stringify(output, null, 4), 'utf-8');
    console.log(`\n[Saved] ${outputPath}`);
}

main();
