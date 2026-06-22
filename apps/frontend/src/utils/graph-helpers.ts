/**
 * 그래프 렌더링 유틸리티 함수들.
 * 노드 크기 계산, 리스크 색상 매핑 등을 담당한다.
 */

// 리스크 색상 정의 (fill + stroke 조합)
export interface RiskColorSet {
    fill: string;
    stroke: string;
}

// 리스크 수준별 색상 매핑
const RISK_COLORS: Record<'green' | 'yellow' | 'red', RiskColorSet> = {
    green: { fill: '#b7eb8f', stroke: '#52c41a' },   // 저위험: 녹색
    yellow: { fill: '#ffe58f', stroke: '#faad14' },   // 중위험: 노란색
    red: { fill: '#ffa39e', stroke: '#f5222d' },      // 고위험: 빨간색
};

/**
 * 리스크 점수(0-100)를 색상 세트로 변환.
 *
 * - 0~33: green (저위험)
 * - 34~66: yellow (중위험)
 * - 67~100: red (고위험)
 */
export function getRiskColor(score: number): RiskColorSet {
    const clamped = Math.max(0, Math.min(100, score));
    if (clamped <= 33) return RISK_COLORS.green;
    if (clamped <= 66) return RISK_COLORS.yellow;
    return RISK_COLORS.red;
}

/**
 * production_capacity 값을 노드 반지름(px)으로 변환.
 *
 * 단위별 정규화 후 로그 스케일 적용으로 극단적 차이를 완화한다.
 * - RF-01 (100,000 tons), F-04 (100 GWh): 큰 원
 * - M-03 (5,000 tons_lce), F-03 (10 GWh): 작은 원
 *
 * 반지름 범위: 15px ~ 50px
 */
export function getNodeRadius(
    productionCapacity: number,
    capacityUnit: string,
): number {
    const MIN_RADIUS = 15;
    const MAX_RADIUS = 50;

    // 단위별 정규화를 위한 기준 최대값 (대략적인 스케일 매핑)
    const maxByUnit: Record<string, number> = {
        tons_lce: 200000,    // M-01: 200,000 tons LCE (최대)
        tons: 100000,        // RF-01: 100,000 tons (최대)
        gwh: 100,            // F-04: 100+ GWh (최대)
        tons_cathode: 100000, // F-01: 100,000 tons (양극재)
    };

    const maxCapacity = maxByUnit[capacityUnit] || 100000;

    // 0~1 범위 정규화
    const normalized = Math.min(productionCapacity / maxCapacity, 1);

    // 로그 스케일 적용 (작은 값도 시각적으로 구분 가능)
    // log(1 + x*9) / log(10) → 0일 때 0, 1일 때 1
    const logScale = Math.log10(1 + normalized * 9);

    // 반지름 범위 매핑
    return MIN_RADIUS + logScale * (MAX_RADIUS - MIN_RADIUS);
}

/**
 * 노드 타입별 기본 아이콘/뱃지 텍스트 반환.
 */
export function getNodeTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        Resource: 'R',
        Mine: 'M',
        Refinery: 'RF',
        Factory: 'F',
    };
    return labels[type] || '?';
}

/**
 * 국가별 노드 fill 색상 매핑.
 */
const COUNTRY_COLORS: Record<string, string> = {
    SouthKorea: '#4A90D9',   // 파랑
    China: '#E8453C',        // 빨강
    Chile: '#F5A623',        // 주황
    UnitedStates: '#7B68EE', // 보라
    Japan: '#50C878',        // 초록
    NA: '#888888',           // 회색
};

/**
 * 국가 코드를 노드 fill 색상으로 변환.
 */
export function getCountryColor(country: string): string {
    return COUNTRY_COLORS[country] || '#888888';
}

/**
 * 리스크 점수를 테두리(stroke) 색상 + 두께로 변환.
 *
 * - 0~33: 초록 테두리, 2px
 * - 34~66: 주황 테두리, 3px
 * - 67~100: 빨강 테두리, 4px
 */
export function getRiskStroke(score: number): { color: string; width: number } {
    const clamped = Math.max(0, Math.min(100, score));
    if (clamped <= 33) return { color: '#52c41a', width: 2 };
    if (clamped <= 66) return { color: '#faad14', width: 3 };
    return { color: '#f5222d', width: 4 };
}

/**
 * 국가 코드를 표시 이름으로 변환.
 */
export function getCountryDisplayName(country: string): string {
    const names: Record<string, string> = {
        SouthKorea: '한국',
        Japan: '일본',
        China: '중국',
        Chile: '칠레',
        UnitedStates: '미국',
        NA: 'N/A',
    };
    return names[country] || country;
}
