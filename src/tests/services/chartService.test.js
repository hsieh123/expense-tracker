const ChartService = require('../../services/chartService');
const { createCanvas } = require('canvas');

// Mock Chart.js
jest.mock('chart.js/auto', () => ({
    register: jest.fn(),
    Chart: class Chart {
        constructor() {
            // 空的構造函數
        }
    }
}));

// Mock chartjs-plugin-datalabels
jest.mock('chartjs-plugin-datalabels', () => ({}));

// Mock canvas with more complete context
jest.mock('canvas', () => ({
    createCanvas: jest.fn(() => ({
        getContext: jest.fn(() => ({
            fillStyle: '',
            fillRect: jest.fn(),
            canvas: { width: 600, height: 900 },
            // 添加 Chart.js 需要的其他屬性
            measureText: jest.fn(() => ({ width: 100 })),
            setTransform: jest.fn(),
            beginPath: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn()
        })),
        toBuffer: jest.fn(() => Buffer.from('test'))
    }))
}));

describe('ChartService', () => {
    let chartService;

    beforeEach(() => {
        chartService = new ChartService({
            colors: ['#FF0000', '#00FF00'],
            backgroundColor: '#000000',
            textColor: '#FFFFFF'
        });
        jest.clearAllMocks();
    });

    describe('generatePieChart', () => {
        it('should generate pie chart buffer', async () => {
            const data = {
                labels: ['Category 1', 'Category 2'],
                values: [100, 200]
            };

            const buffer = await chartService.generatePieChart(data);

            expect(createCanvas).toHaveBeenCalledWith(600, 900);
            expect(buffer).toBeInstanceOf(Buffer);
        });
    });

    describe('generateStackedBarChart', () => {
        it('should generate stacked bar chart buffer', async () => {
            const data = {
                labels: ['Jan', 'Feb'],
                datasets: [
                    {
                        label: 'Category 1',
                        values: [100, 150]
                    },
                    {
                        label: 'Category 2',
                        values: [200, 250]
                    }
                ]
            };

            const buffer = await chartService.generateStackedBarChart(data);

            expect(createCanvas).toHaveBeenCalledWith(600, 900);
            expect(buffer).toBeInstanceOf(Buffer);
        });
    });
}); 