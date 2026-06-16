/**
 * UN Comtrade API에서 수산화리튬(HS 2825.20) 수출 데이터를 조회하여
 * seed-data/comtrade-api-response.json으로 저장하는 스크립트.
 *
 * 수출국(중국, 칠레, 미국) → 수입국(한국, 일본) 방향의 X(Export) 데이터를 조회.
 * 수산화리튬 관점에서 Refinery 국가가 reporter, Factory 국가가 partner.
 *
 * 실행: npm run fetch:comtrade
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 프로젝트 루트의 .env 로드
config({ path: join(__dirname, '..', '..', '..', '.env') });

// 국가 코드 → 이름 매핑 로드
interface ComtradeCountry {
    id: number;
    text: string;
    reporterCode: number;
    reporterCodeIsoAlpha3: string;
}

const countriesPath = join(__dirname, '..', 'comtrade-countries.json');
const countries: ComtradeCountry[] = JSON.parse(readFileSync(countriesPath, 'utf-8'));
const countryNameMap = new Map<number, string>(
    countries.map((c) => [c.id, `${c.text}(${c.id})`])
);

const COMTRADE_API_KEY = process.env['COMTRADE_API_KEY'] || '';
const BASE_URL = 'https://comtradeapi.un.org/data/v1/get/C/A/HS';

// 수산화리튬 HS Code
const HS_CODE = '282520';

// 기준 연도
const PERIOD = '2024';

// 수출국 (Refinery 소재국): 중국, 칠레, 미국
const REPORTER_CODES = '156,152,842';

// 수입국 (Factory 소재국): 한국, 일본
const PARTNER_CODES = '410,392';

// 출력 파일 경로 (seed-data/comtrade-api-response.json)
const OUTPUT_PATH = join(__dirname, '..', 'comtrade-api-response.json');

interface ComtradeApiResponse {
    elapsedTime: string;
    count: number;
    data: Record<string, unknown>[];
    error?: string;
}

async function fetchComtradeExportData(): Promise<ComtradeApiResponse | null> {
    if (!COMTRADE_API_KEY) {
        console.error('[Error] COMTRADE_API_KEY 환경변수가 설정되지 않았습니다.');
        console.error('  실행 방법: COMTRADE_API_KEY=your_key npx tsx packages/seed-data/scripts/fetch-comtrade-export.ts');
        process.exit(1);
    }

    const params = new URLSearchParams({
        cmdCode: HS_CODE,
        reporterCode: REPORTER_CODES,
        partnerCode: PARTNER_CODES,
        period: PERIOD,
        flowCode: 'X',
        'subscription-key': COMTRADE_API_KEY,
    });

    const requestUrl = `${BASE_URL}?${params.toString()}`;
    // API 키를 로그에서 마스킹
    const maskedUrl = requestUrl.replace(COMTRADE_API_KEY, '***');
    console.log(`[Request] ${maskedUrl}`);

    const response = await fetch(requestUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        console.error(`[Error] HTTP ${response.status}: ${response.statusText}`);
        const body = await response.text();
        console.error(`[Response Body] ${body.slice(0, 500)}`);
        return null;
    }

    return (await response.json()) as ComtradeApiResponse;
}

async function main() {
    console.log('=== UN Comtrade 수산화리튬 수출 데이터 조회 ===');
    console.log(`HS Code: ${HS_CODE} (산화리튬 및 수산화리튬)`);
    console.log(`Period: ${PERIOD}`);
    console.log(`Reporters (수출국): China(156), Chile(152), USA(842)`);
    console.log(`Partners (수입국): South Korea(410), Japan(392)`);
    console.log(`Flow: X (Export)`);
    console.log('');

    const result = await fetchComtradeExportData();

    if (!result) {
        console.error('[Failed] API 호출 실패');
        process.exit(1);
    }

    if (result.error) {
        console.error(`[API Error] ${result.error}`);
        process.exit(1);
    }

    console.log(`[Success] ${result.count}건 조회 (${result.elapsedTime})`);

    // 레코드 요약 출력
    if (result.data && result.data.length > 0) {
        console.log('\n--- 조회 결과 요약 ---');
        for (const record of result.data) {
            const reporter = record['reporterCode'] as number;
            const partner = record['partnerCode'] as number;
            const reporterName = countryNameMap.get(reporter) ?? String(reporter);
            const partnerName = countryNameMap.get(partner) ?? String(partner);
            const netWgt = record['netWgt'] as number;
            const fobvalue = record['fobvalue'] as number | null;
            const primaryValue = record['primaryValue'] as number;
            console.log(
                `  ${reporterName} → ${partnerName}: ${(netWgt / 1000).toFixed(0)}t, $${((fobvalue ?? primaryValue) / 1e6).toFixed(1)}M`
            );
        }
    }

    // 파일 저장
    writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 4), 'utf-8');
    console.log(`\n[Saved] ${OUTPUT_PATH}`);
}

main().catch((err) => {
    console.error('[Unhandled Error]', err);
    process.exit(1);
});
