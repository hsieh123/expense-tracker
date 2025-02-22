const ReportService = require('../../services/reportService');

describe('ReportService', () => {
    let reportService;
    let mockStorage;
    let mockChart;

    beforeEach(() => {
        mockStorage = {
            getReceiptsByDate: jest.fn()
        };

        mockChart = {
            generatePieChart: jest.fn().mockResolvedValue(Buffer.from('test')),
            generateStackedBarChart: jest.fn().mockResolvedValue(Buffer.from('test'))
        };

        reportService = new ReportService(mockStorage, mockChart);
    });

    describe('generateDailyReport', () => {
        it('should generate daily report with charts', async () => {
            const testReceipts = [{
                amount: 100,
                items: [
                    { category: 'Food', price: 60 },
                    { category: 'Drinks', price: 40 }
                ]
            }];

            mockStorage.getReceiptsByDate.mockResolvedValue(testReceipts);
            mockChart.generatePieChart
                .mockResolvedValueOnce(Buffer.from('all'))
                .mockResolvedValueOnce(Buffer.from('non-recurring'));

            const report = await reportService.generateDailyReport(new Date());

            expect(report.total).toBe(100);
            expect(report.categories).toEqual({
                Food: 60,
                Drinks: 40
            });
            expect(mockChart.generatePieChart).toHaveBeenCalledTimes(2);
            expect(report.charts.all).toEqual(Buffer.from('all'));
            expect(report.charts.nonRecurring).toEqual(Buffer.from('non-recurring'));
        });
    });

    describe('generateMonthlyReport', () => {
        it('should generate monthly report with charts', async () => {
            const testReceipts = [
                {
                    amount: 100,
                    items: [
                        { category: 'Food', price: 100 }
                    ]
                }
            ];

            mockStorage.getReceiptsByDate.mockResolvedValue(testReceipts);

            const report = await reportService.generateMonthlyReport(new Date());

            expect(report.total).toBeGreaterThan(0);
            expect(report.categories).toHaveProperty('Food');
            expect(report.charts.category).toBeInstanceOf(Buffer);
            expect(report.charts.trend).toBeInstanceOf(Buffer);
        });
    });

    describe('generateYearlyReport', () => {
        it('should generate yearly report with charts', async () => {
            const testReceipts = [
                {
                    amount: 100,
                    items: [
                        { category: 'Food', price: 100 }
                    ]
                }
            ];

            mockStorage.getReceiptsByDate.mockResolvedValue(testReceipts);

            const report = await reportService.generateYearlyReport(new Date());

            expect(report.total).toBeGreaterThan(0);
            expect(report.categories).toHaveProperty('Food');
            expect(report.charts.category).toBeInstanceOf(Buffer);
            expect(report.charts.trend).toBeInstanceOf(Buffer);
        });
    });
}); 