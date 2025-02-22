const { 
    getLocalDateString, 
    getFirstDayOfMonth, 
    getLastDayOfMonth 
} = require('../../utils/dateUtils');

describe('dateUtils', () => {
    describe('getLocalDateString', () => {
        it('should return correct date string', () => {
            const date = new Date('2024-02-14T12:00:00Z');
            expect(getLocalDateString(date)).toBe('2024-02-14');
        });
    });

    describe('getFirstDayOfMonth', () => {
        it('should return first day of month', () => {
            const date = new Date('2024-02-14');
            const firstDay = getFirstDayOfMonth(date);
            expect(firstDay.getDate()).toBe(1);
            expect(firstDay.getMonth()).toBe(1); // 0-based month
            expect(firstDay.getFullYear()).toBe(2024);
        });
    });

    describe('getLastDayOfMonth', () => {
        it('should return last day of month', () => {
            const date = new Date('2024-02-14');
            const lastDay = getLastDayOfMonth(date);
            expect(lastDay.getDate()).toBe(29); // 2024 is leap year
            expect(lastDay.getMonth()).toBe(1);
            expect(lastDay.getFullYear()).toBe(2024);
        });
    });
}); 