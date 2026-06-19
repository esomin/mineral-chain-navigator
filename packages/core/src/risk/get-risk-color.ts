/**
 * 리스크 점수(0-100)를 색상 코드로 매핑.
 *
 * - green: 저위험 (0 ~ 33)
 * - yellow: 중위험 (34 ~ 66)
 * - red: 고위험 (67 ~ 100)
 *
 * 점수는 [0, 100] 범위로 가정하며, 범위 밖 값은 클램프 후 매핑한다.
 */
export function getRiskColor(score: number): 'green' | 'yellow' | 'red' {
    const clamped = Math.max(0, Math.min(100, score));

    if (clamped <= 33) return 'green';
    if (clamped <= 66) return 'yellow';
    return 'red';
}
