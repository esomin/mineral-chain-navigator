/**
 * MCS2025 원시 데이터에서 리튬 생산량을 추출하여
 * production-shares.json과 HHI를 자동 생성하는 스크립트
 *
 * 실행: npx tsx packages/seed-data/scripts/extract-lithium-production.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface McsRecord {
    SOURCE: string;
    COMMODITY: string;
    COUNTRY: string;
    TYPE: string;
    UNIT_MEAS: string;
    PROD_2023: number | '';
    'PROD_EST_ 2024': number | '';
    PROD_NOTES: string;
    CAP_2023: number | '';
    'CAP_EST_ 2024': number | '';
    CAP_NOTES: string;
    RESERVES_2024: number | string | '';
    RESERVE_NOTES: string;
}

interface CountryProduction {
    country: string;
    production2023: number | null;
    productionEst2024: number | null;
    reserves2024: number | null;
    share: number;
    reserveNotes: string;
}

interface ProductionSharesOutput {
    source: string;
    mineral: string;
    type: string;
    unit: string;
    year: number;
    worldTotal2023: number;
    worldTotalEst2024: number;
    worldReserves: number;
    countries: CountryProduction[];
    hhi2023: number;
    hhiInterpretation: string;
    targetCountries: CountryProduction[];
    fetchedAt: string;
}

// 대상 국가 (스코프에 맞춤)
const TARGET_COUNTRIES = ['Australia', 'Chile', 'China', 'Korea, Republic of', 'Japan'];

// 국가명 매핑 (출력용)
const COUNTRY_DISPLAY_NAMES: Record<string, string> = {
    'Australia': 'Australia',
    'Chile': 'Chile',
    'China': 'China',
    'Korea, Republic of': 'South Korea',
    'Japan': 'Japan',
};

function main() {
    // 1. MCS2025 원시 데이터 로드
    const rawDataPath = join(__dirname, '..', 'usgs-mcs2025-rsource.json');
    const rawData: McsRecord[] = JSON.parse(readFileSync(rawDataPath, 'utf-8'));

    // 2. 리튬 레코드만 필터링
    const lithiumRecords = rawData.filter(
        (r) => r.COMMODITY === 'Lithium' && r.TYPE === 'Mine production, lithium content'
    );

    console.log(`\n리튬 레코드 ${lithiumRecords.length}건 발견\n`);

    // 3. World total 추출
    const worldRecord = lithiumRecords.find((r) =>
        r.COUNTRY.startsWith('World total')
    );

    if (!worldRecord) {
        throw new Error('World total 레코드를 찾을 수 없습니다.');
    }

    const worldTotal2023 = typeof worldRecord.PROD_2023 === 'number' ? worldRecord.PROD_2023 : 0;
    const worldTotalEst2024 =
        typeof worldRecord['PROD_EST_ 2024'] === 'number' ? worldRecord['PROD_EST_ 2024'] : 0;
    const worldReserves = parseReserves(worldRecord.RESERVES_2024) ?? 0;

    console.log(`세계 생산량 2023: ${worldTotal2023.toLocaleString()} metric tons`);
    console.log(`세계 생산량 2024(est): ${worldTotalEst2024.toLocaleString()} metric tons`);
    console.log(`세계 매장량: ${worldReserves.toLocaleString()} metric tons\n`);

    // 4. 국가별 생산량 추출 (World total, Other Countries 제외)
    const countryRecords = lithiumRecords.filter(
        (r) => !r.COUNTRY.startsWith('World total') && r.COUNTRY !== 'Other Countries'
    );

    const countries: CountryProduction[] = countryRecords.map((r) => {
        const prod2023 = typeof r.PROD_2023 === 'number' ? r.PROD_2023 : null;
        const prodEst2024 = typeof r['PROD_EST_ 2024'] === 'number' ? r['PROD_EST_ 2024'] : null;
        const reserves = parseReserves(r.RESERVES_2024);
        const share = prod2023 && worldTotal2023 > 0 ? prod2023 / worldTotal2023 : 0;

        return {
            country: r.COUNTRY,
            production2023: prod2023,
            productionEst2024: prodEst2024,
            reserves2024: reserves,
            share: Math.round(share * 10000) / 10000, // 소수점 4자리
            reserveNotes: r.RESERVE_NOTES || '',
        };
    });

    // 생산량 기준 내림차순 정렬
    countries.sort((a, b) => (b.production2023 ?? 0) - (a.production2023 ?? 0));

    // 5. HHI 계산 (시장 점유율 제곱의 합, 0~10000 스케일)
    const hhi2023 = countries.reduce((sum, c) => {
        const sharePercent = c.share * 100;
        return sum + sharePercent * sharePercent;
    }, 0);
    const hhiRounded = Math.round(hhi2023);

    let hhiInterpretation: string;
    if (hhiRounded < 1500) {
        hhiInterpretation = 'Unconcentrated (competitive market)';
    } else if (hhiRounded < 2500) {
        hhiInterpretation = 'Moderately concentrated';
    } else {
        hhiInterpretation = 'Highly concentrated';
    }

    console.log(`HHI (2023): ${hhiRounded} — ${hhiInterpretation}\n`);

    // 6. 대상 국가 추출
    const targetCountries = TARGET_COUNTRIES.map((name) => {
        const found = countries.find((c) => c.country === name);
        if (found) {
            return {
                ...found,
                country: COUNTRY_DISPLAY_NAMES[name] || name,
            };
        }
        // 생산 데이터 없는 국가 (한국, 일본)
        return {
            country: COUNTRY_DISPLAY_NAMES[name] || name,
            production2023: null,
            productionEst2024: null,
            reserves2024: null,
            share: 0,
            reserveNotes: 'No lithium mine production (consumer/refiner only)',
        };
    });

    // 7. 출력 구성
    const output: ProductionSharesOutput = {
        source: 'USGS Mineral Commodity Summaries 2025',
        mineral: 'Lithium',
        type: 'Mine production, lithium content',
        unit: 'metric tons',
        year: 2023,
        worldTotal2023,
        worldTotalEst2024,
        worldReserves,
        countries,
        hhi2023: hhiRounded,
        hhiInterpretation,
        targetCountries,
        fetchedAt: new Date().toISOString(),
    };

    // 8. 출력 디렉터리 생성 및 파일 저장
    const outputDir = join(__dirname, '..', 'risk-factors');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'productionㅛ.json');
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`저장 완료: ${outputPath}\n`);

    // 9. 요약 출력
    console.log('--- 리튬 생산 점유율 (2023) ---');
    console.log('| 국가 | 생산량(t) | 점유율 | 매장량(t) |');
    console.log('|------|----------|--------|----------|');
    countries
        .filter((c) => c.production2023)
        .forEach((c) => {
            console.log(
                `| ${c.country.padEnd(12)} | ${String(c.production2023).padStart(8)} | ${(c.share * 100).toFixed(1).padStart(5)}% | ${String(c.reserves2024 ?? 'N/A').padStart(10)} |`
            );
        });

    console.log('\n--- 대상 5개국 ---');
    targetCountries.forEach((c) => {
        const prod = c.production2023 ? `${c.production2023.toLocaleString()}t` : 'N/A (소비국)';
        console.log(`  ${c.country}: ${prod} (점유율: ${(c.share * 100).toFixed(1)}%)`);
    });
}

function parseReserves(value: number | string | ''): number | null {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    // ">2000000" 같은 문자열 처리
    const cleaned = value.replace(/[>,]/g, '').trim();
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
}

main();
