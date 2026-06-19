/**
 * UN Comtrade API - 수산화리튬(HS 2825.20) 수입국 관점(M) 데이터 조회.
 * 수출국 데이터 미보고 시 fallback으로 사용.
 * 결과를 seed-data/raw-import-{period}.json으로 저장.
 *
 * 단독 실행: npx tsx packages/seed-data/scripts/fetch-comtrade-import.ts
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '..', '..', '.env') });

// 국가명 매핑
interface ComtradeCountry { id: number; text: string; }
const countriesPath = join(__dirname, '..', 'data', 'comtrade-countries.json');
const countries: ComtradeCountry[] = JSON.parse(readFileSync(countriesPath, 'utf-8'));
const countryNameMap = new Map<number, string>(countries.map((c) => [c.id, `${c.text}(${c.id})`]));

const COMTRADE_API_KEY = process.env['COMTRADE_API_KEY'] || '';
const BASE_URL = 'https://comtradeapi.un.org/data/v1/get/C/A/HS';
const HS_CODE = '282520';
const PERIOD = '2025';
const REPORTER_CODES = '410,392';       // 수입국: 한국, 일본
const PARTNER_CODES = '156,152,842';    // 수출국: 중국, 칠레, 미국

export const OUTPUT_PATH = join(__dirname, '..', 'data', `raw-import-${PERIOD}.json`);

async function main() {
    if (!COMTRADE_API_KEY) {
        console.error('[Error] COMTRADE_API_KEY 환경변수 미설정');
        process.exit(1);
    }

    console.log(`[Import] HS=${HS_CODE}, period=${PERIOD}, flow=M`);
    console.log(`  Reporters: ${REPORTER_CODES.split(',').map((c) => countryNameMap.get(Number(c))).join(', ')}`);
    console.log(`  Partners: ${PARTNER_CODES.split(',').map((c) => countryNameMap.get(Number(c))).join(', ')}`);

    const params = new URLSearchParams({
        cmdCode: HS_CODE,
        reporterCode: REPORTER_CODES,
        partnerCode: PARTNER_CODES,
        period: PERIOD,
        flowCode: 'M',
        'subscription-key': COMTRADE_API_KEY,
    });

    const requestUrl = `${BASE_URL}?${params.toString()}`;
    console.log(`  [Request] ${requestUrl.replace(COMTRADE_API_KEY, '***')}`);

    const response = await fetch(requestUrl, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) {
        console.error(`  [Error] HTTP ${response.status}`);
        process.exit(1);
    }

    const result = await response.json() as { count?: number; elapsedTime?: string };
    console.log(`  [OK] ${result.count ?? 0}건 (${result.elapsedTime ?? ''})`);

    writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 4), 'utf-8');
    console.log(`  [Saved] ${OUTPUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
