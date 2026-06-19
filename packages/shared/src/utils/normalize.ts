/**
 * 값을 지정된 [min, max] 범위로 제한한다.
 * @param value - 제한할 값
 * @param min - 최솟값
 * @param max - 최댓값
 * @returns 범위 내로 제한된 값
 */
export function clamp(value: number, min: number, max: number): number {
    if (min > max) {
        return clamp(value, max, min);
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * 원시 점수를 [0, 1] 범위로 정규화한다.
 * 원시 점수는 0~100 범위를 기대하며,
 * [0, 100] 범위를 벗어나는 값은 정규화 전에 클램핑된다.
 * @param rawScore - 원시 점수 (일반적으로 0~100)
 * @returns [0, 1] 범위의 정규화된 점수
 */
export function normalizeScore(rawScore: number): number {
    const clamped = clamp(rawScore, 0, 100);
    return clamped / 100;
}
