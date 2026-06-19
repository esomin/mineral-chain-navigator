import { describe, it, expect } from 'vitest';
import { getRiskColor } from './get-risk-color.js';

describe('getRiskColor', () => {
    it('should return green for score 0 (minimum)', () => {
        expect(getRiskColor(0)).toBe('green');
    });

    it('should return green for low-risk scores (1-33)', () => {
        expect(getRiskColor(10)).toBe('green');
        expect(getRiskColor(20)).toBe('green');
        expect(getRiskColor(33)).toBe('green');
    });

    it('should return yellow for medium-risk scores (34-66)', () => {
        expect(getRiskColor(34)).toBe('yellow');
        expect(getRiskColor(50)).toBe('yellow');
        expect(getRiskColor(66)).toBe('yellow');
    });

    it('should return red for high-risk scores (67-100)', () => {
        expect(getRiskColor(67)).toBe('red');
        expect(getRiskColor(80)).toBe('red');
        expect(getRiskColor(100)).toBe('red');
    });

    it('should handle boundary between green and yellow (33 → green, 34 → yellow)', () => {
        expect(getRiskColor(33)).toBe('green');
        expect(getRiskColor(34)).toBe('yellow');
    });

    it('should handle boundary between yellow and red (66 → yellow, 67 → red)', () => {
        expect(getRiskColor(66)).toBe('yellow');
        expect(getRiskColor(67)).toBe('red');
    });

    it('should clamp scores below 0 to green', () => {
        expect(getRiskColor(-10)).toBe('green');
        expect(getRiskColor(-1)).toBe('green');
    });

    it('should clamp scores above 100 to red', () => {
        expect(getRiskColor(101)).toBe('red');
        expect(getRiskColor(150)).toBe('red');
    });

    it('should handle fractional scores correctly', () => {
        expect(getRiskColor(33.5)).toBe('yellow');
        expect(getRiskColor(66.5)).toBe('red');
        expect(getRiskColor(33.0)).toBe('green');
        expect(getRiskColor(66.0)).toBe('yellow');
    });
});
