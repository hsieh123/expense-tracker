const echarts = require('echarts');
const { Canvas } = require('skia-canvas');

class ChartService {
    constructor(config) {
        this.config = config;
        this.colors = this.config.CHART_COLORS.colors;
    }

    _createCanvas(width = 800, height = 800) {
        const canvas = new Canvas(width, height);
        const chart = echarts.init(canvas);
        return { canvas, chart };
    }

    _applyCommonConfig(option) {
        return {
            backgroundColor: this.config.CHART_COLORS.backgroundColor,
            textStyle: {
                fontFamily: 'Arial, "Microsoft YaHei"',
                fontSize: 14,
                fontWeight: 'bold',
                color: this.config.CHART_COLORS.textColor
            },
            title: {
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: this.config.CHART_COLORS.textColor
                }
            },
            legend: {
                textStyle: {
                    fontSize: 14,
                    color: this.config.CHART_COLORS.textColor
                }
            },
            ...option
        };
    }

    async generatePieChart(data) {
        const { canvas, chart } = this._createCanvas();

        const option = this._applyCommonConfig({
            title: { text: '支出分類' },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: ${c} ({d}%)'
            },
            legend: {
                bottom: 20,
                textStyle: {
                    color: this.config.CHART_COLORS.textColor
                }
            },
            series: [{
                type: 'pie',
                radius: ['35%', '70%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: this.config.CHART_COLORS.backgroundColor,
                    borderWidth: 2
                },
                label: {
                    show: true,
                    position: params => params.percent > 15 ? 'inside' : 'outside',
                    formatter: params => `${params.name}\n$${params.value.toFixed(2)}`,
                    color: params => params.percent > 15 ? '#FFFFFF' : this.config.CHART_COLORS.textColor,
                    fontSize: 16,
                    fontWeight: 'bold',
                    lineHeight: 20,
                    padding: 8
                },
                labelLine: {
                    show: true,
                    length: 15,
                    length2: 25,
                    lineStyle: {
                        color: this.config.CHART_COLORS.textColor,
                        width: 2
                    }
                },
                data: data.map((item, index) => ({
                    name: item.category,
                    value: item.amount,
                    itemStyle: {
                        color: this.colors[index % this.colors.length]
                    }
                }))
            }]
        });

        chart.setOption(option);
        return canvas.toBuffer('png');
    }

    async generateBarChart(data) {
        if (!data || data.length === 0) {
            return null;
        }

        const { canvas, chart } = this._createCanvas(800, 400);
        const categories = this._getUniqueCategories(data);

        if (categories.length === 0) {
            return null;
        }

        const option = this._applyCommonConfig({
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            legend: {
                data: categories,
                top: 10,
                textStyle: {
                    color: this.config.CHART_COLORS.textColor
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: data.map(d => {
                    const [year, month, day] = d.date.split('-');
                    return `${month}/${day}`;
                }),
                axisLabel: {
                    color: this.config.CHART_COLORS.textColor,
                    fontSize: 12,
                    fontWeight: 'bold',
                    rotate: data.length > 15 ? 45 : 0
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: this.config.CHART_COLORS.textColor,
                    fontSize: 12,
                    fontWeight: 'bold',
                    formatter: '${value}'
                }
            },
            series: this._createBarSeries(categories, data)
        });

        chart.setOption(option);
        return canvas.toBuffer('png');
    }

    _createBarSeries(categories, data) {
        return categories.map((category, index) => ({
            name: category,
            type: 'bar',
            stack: 'total',
            barWidth: '60%',
            itemStyle: {
                color: this.colors[index % this.colors.length]
            },
            label: {
                show: true,
                position: 'inside',
                formatter: params => params.value > 0 ? `$${params.value.toFixed(0)}` : '',
                fontSize: 12,
                color: '#fff'
            },
            data: data.map(d => d.categories[category] || 0)
        }));
    }

    _createTooltipFormatter() {
        return (params) => {
            let result = `${params[0].axisValue}<br/>`;
            let total = 0;
            params.forEach(param => {
                if (param.value > 0) {
                    result += `${param.seriesName}: $${param.value.toFixed(2)}<br/>`;
                    total += param.value;
                }
            });
            result += `<br/>總計: $${total.toFixed(2)}`;
            return result;
        };
    }

    async generateStackedBarChart(data) {
        const canvas = new Canvas(800, 400);
        const chart = echarts.init(canvas);

        const option = {
            backgroundColor: '#2C2C2C',
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            legend: {
                top: 10,
                textStyle: {
                    color: '#fff'
                }
            },
            xAxis: {
                type: 'category',
                data: data.labels,
                axisLabel: { 
                    color: '#fff',
                    fontSize: 12
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    color: '#fff',
                    formatter: '${value}',
                    fontSize: 12
                }
            },
            series: data.datasets.map(dataset => ({
                name: dataset.label,
                type: 'bar',
                stack: 'total',
                data: dataset.values,
                itemStyle: {
                    borderRadius: [5, 5, 0, 0]
                }
            }))
        };

        chart.setOption(option);
        return canvas.toBuffer('png');
    }

    _getUniqueCategories(data) {
        const allCategories = new Set();
        data.forEach(day => {
            Object.keys(day.categories || {}).forEach(category => {
                allCategories.add(category);
            });
        });
        return Array.from(allCategories);
    }
}

module.exports = ChartService; 