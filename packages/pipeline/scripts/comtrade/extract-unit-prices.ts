/**
 * UN Comtrade 병합 데이터(comtrade-api-response.json)로부터
 * HS 코드별, 무역 경로별 단위 단가(USD/kg, USD/ton)를 추출 및 집계하는 ETL 스크립트.
 *
 * 실행: npx tsx packages/pipeline/scripts/comtrade/extract-unit-prices.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 데이터 파일 경로
const inputPath = join(__dirname, '..', '..', 'data', 'raw', 'comtrade', 'comtrade-api-response.json');
const countriesPath = join(__dirname, '..', '..', 'data', 'raw', 'comtrade', 'comtrade-countries.json');
const outputDir = join(__dirname, '..', '..', 'data', 'prices');
const outputPath = join(outputDir, 'comtrade-unit-prices.json');

// HS 코드별 품목명 매핑
const HS_DESCRIPTIONS: Record<string, string> = {
    '253090': 'Lithium ores and concentrates (리튬 광석/정광)',
    '283691': 'Lithium carbonate (탄산리튬)',
    '282520': 'Lithium hydroxide and oxide (수산화리튬)',
};

interface ComtradeCountry {
    id: number;
    text: string;
}

interface ComtradeMergedRecord {
    cmdCode: string;
    reporterCode: number;
    partnerCode: number;
    netWgt: number;
    primaryValue: number;
    dataSource?: string;
}

interface ComtradeApiResponse {
    count: number;
    period: string;
    data: ComtradeMergedRecord[];
}

interface TradeFlowPriceItem {
    hsCode: string;
    hsDescription: string;
    exporterCode: number;
    exporter: string;
    importerCode: number;
    importer: string;
    netWgtKg: number;
    netWgtTons: number;
    primaryValueUsd: number;
    unitPriceUsdPerKg: number;
    unitPriceUsdPerTon: number;
    dataSource: string;
}

interface HSSummaryItem {
    hsCode: string;
    description: string;
    recordCount: number;
    totalVolumeKg: number;
    totalVolumeTons: number;
    totalValueUsd: number;
    weightedAverageUsdPerKg: number;
    weightedAverageUsdPerTon: number;
}

function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

function main() {
    if (!existsSync(inputPath)) {
        console.error(`[Error] 입력 파일을 찾을 수 없습니다: ${inputPath}`);
        process.exit(1);
    }

    // 국가 정보 및 병합 API 응답 읽기
    const countries: ComtradeCountry[] = existsSync(countriesPath)
        ? JSON.parse(readFileSync(countriesPath, 'utf-8'))
        : [];
    const countryMap = new Map<number, string>(countries.map((c) => [c.id, c.text]));

    const rawContent = readFileSync(inputPath, 'utf-8');
    const apiResponse: ComtradeApiResponse = JSON.parse(rawContent);

    const records = apiResponse.data || [];
    console.log(`[ExtractPrices] ${records.length}건의 무역 레코드로부터 단가 분석을 시작합니다.`);

    const tradeFlowPrices: TradeFlowPriceItem[] = [];
    const hsGroupMap = new Map<string, { totalNetWgtKg: number; totalPrimaryValueUsd: number; count: number }>();

    for (const record of records) {
        const hsCode = String(record.cmdCode || '');
        const netWgtKg = record.netWgt ?? 0;
        const primaryValueUsd = record.primaryValue ?? 0;

        if (netWgtKg <= 0 || primaryValueUsd <= 0) {
            continue;
        }

        const unitPriceUsdPerKg = roundTo(primaryValueUsd / netWgtKg, 4);
        const unitPriceUsdPerTon = roundTo(unitPriceUsdPerKg * 1000, 2);

        const exporterName = countryMap.get(record.reporterCode) ?? `Country(${record.reporterCode})`;
        const importerName = countryMap.get(record.partnerCode) ?? `Country(${record.partnerCode})`;

        tradeFlowPrices.push({
            hsCode,
            hsDescription: HS_DESCRIPTIONS[hsCode] ?? hsCode,
            exporterCode: record.reporterCode,
            exporter: exporterName,
            importerCode: record.partnerCode,
            importer: importerName,
            netWgtKg,
            netWgtTons: roundTo(netWgtKg / 1000, 2),
            primaryValueUsd: roundTo(primaryValueUsd, 2),
            unitPriceUsdPerKg,
            unitPriceUsdPerTon,
            dataSource: record.dataSource ?? 'unknown',
        });

        // HS 코드별 누적 집계
        const group = hsGroupMap.get(hsCode) || { totalNetWgtKg: 0, totalPrimaryValueUsd: 0, count: 0 };
        group.totalNetWgtKg += netWgtKg;
        group.totalPrimaryValueUsd += primaryValueUsd;
        group.count += 1;
        hsGroupMap.set(hsCode, group);
    }

    // HS 코드별 가중 평균 단가 집계
    const hsSummary: HSSummaryItem[] = Array.from(hsGroupMap.entries()).map(([hsCode, group]) => {
        const weightedAverageUsdPerKg = group.totalNetWgtKg > 0
            ? roundTo(group.totalPrimaryValueUsd / group.totalNetWgtKg, 4)
            : 0;
        const weightedAverageUsdPerTon = roundTo(weightedAverageUsdPerKg * 1000, 2);

        return {
            hsCode,
            description: HS_DESCRIPTIONS[hsCode] ?? hsCode,
            recordCount: group.count,
            totalVolumeKg: group.totalNetWgtKg,
            totalVolumeTons: roundTo(group.totalNetWgtKg / 1000, 2),
            totalValueUsd: roundTo(group.totalPrimaryValueUsd, 2),
            weightedAverageUsdPerKg,
            weightedAverageUsdPerTon,
        };
    });

    const resultDataset = {
        metadata: {
            title: "UN Comtrade Lithium Unit Prices Assessment",
            source: "UN Comtrade API 2025 Trade Data",
            extractedAt: new Date().toISOString(),
            totalRecords: tradeFlowPrices.length,
            hsCodeDescriptions: HS_DESCRIPTIONS,
        },
        hsSummary,
        tradeFlowPrices,
    };

    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(resultDataset, null, 4), 'utf-8');
    console.log(`[Saved] 단가 추출 결과가 저장되었습니다: ${outputPath}`);

    // 콘솔 요약 출력
    console.log("\n=== HS 코드별 가중 평균 단가 요약 ===");
    for (const summary of hsSummary) {
        console.log(`- [HS ${summary.hsCode}] ${summary.description}`);
        console.log(`  거래건수: ${summary.recordCount}건 | 총 물량: ${summary.totalVolumeTons.toLocaleString()} 톤 | 총 거래액: $${(summary.totalValueUsd / 1e6).toFixed(1)}M`);
        console.log(`  가중평균 단가: $${summary.weightedAverageUsdPerKg}/kg ($${summary.weightedAverageUsdPerTon.toLocaleString()}/ton)\n`);
    }
}

main();
