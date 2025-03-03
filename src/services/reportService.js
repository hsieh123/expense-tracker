const { getFirstDayOfMonth, getLastDayOfMonth } = require('../utils/dateUtils');

class ReportService {
    constructor(storageService, chartService, config) {
        this.storage = storageService;
        this.chart = chartService;
        this.config = config;
    }

    _getDisplayName(category) {
        // 標準化類別名稱為大寫
        const upperCategory = category.toUpperCase();
        
        // 檢查是否為已定義的類別
        const cat = Object.entries(this.config.CATEGORIES)
            .find(([key, value]) => key === upperCategory || value.name === category);
        
        if (cat) {
            // 如果是已定義的類別，返回對應的中文名稱
            switch(cat[0]) {
                case 'GROCERIES': return '食品雜貨';
                case 'KIDS': return '兒童用品';
                case 'DINING': return '餐飲';
                case 'TRANSPORT': return '交通';
                case 'HEALTHCARE': return '醫療保健';
                case 'UTILITIES': return '水電費';
                case 'HOUSING': return '住房';
                case 'CLOTHING': return '服飾';
                case 'RECREATION': return '娛樂';
                case 'EDUCATION': return '教育';
                case 'SEASONAL': return '季節性支出';
                case 'MISC': return '其他';
                default: return cat[1].displayName || cat[1].name;
            }
        }
        
        // 如果是未定義的類別，將其歸類為"其他"
        console.warn(`未知的支出類別: ${category}，已歸類為"其他"`);
        return '其他';
    }

    /**
     * 生成指定時間範圍的報表
     * @private
     */
    async _generateReport(startDate, endDate, title, includeRecurring = false) {
        console.log(`Generating ${title} report for:`, {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            includeRecurring
        });

        const dailyData = [];
        let totalData = {
            total: 0,
            totalRecurring: 0,
            categories: {},
            recurringCategories: {}
        };

        // 收集每日數據
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            console.log(`\nProcessing date: ${d.toISOString()}`);
            const receipts = await this.storage.getReceiptsByDate(new Date(d));
            console.log(`Found ${receipts.length} receipts:`, 
                receipts.map(r => ({
                    store: r.store,
                    amount: r.amount,
                    date: r.date,
                    items: r.items.map(i => ({
                        name: i.name,
                        price: i.price,
                        category: i.category
                    }))
                }))
            );
            
            // 分離固定支出和非固定支出
            const recurringReceipts = receipts.filter(r => r.isRecurring);
            const nonRecurringReceipts = receipts.filter(r => !r.isRecurring);
            
            // 計算非固定支出
            const dayData = this._calculateTotals(nonRecurringReceipts);
            
            // 計算固定支出
            const recurringData = this._calculateTotals(recurringReceipts);

            // 添加到每日數據
            const dayEntry = {
                date: d.toISOString().split('T')[0],
                categories: Object.fromEntries(
                    Object.entries({
                        ...dayData.categories,
                        ...(includeRecurring ? recurringData.categories : {})
                    })
                    .map(([category, amount]) => [
                        this._getDisplayName(category),
                        parseFloat(amount.toFixed(2))
                    ])
                )
            };
            dailyData.push(dayEntry);

            // 累計總數據
            totalData.total += dayData.total;
            totalData.totalRecurring += recurringData.total;
            
            // 累計非固定支出類別
            Object.entries(dayData.categories).forEach(([category, amount]) => {
                const displayName = this._getDisplayName(category);
                totalData.categories[displayName] = (totalData.categories[displayName] || 0) + amount;
            });
            
            // 累計固定支出類別
            Object.entries(recurringData.categories).forEach(([category, amount]) => {
                const displayName = this._getDisplayName(category);
                totalData.recurringCategories[displayName] = 
                    (totalData.recurringCategories[displayName] || 0) + amount;
            });
        }

        // 格式化圓餅圖數據
        const categoryData = Object.entries({
            ...totalData.categories,
            ...(includeRecurring ? totalData.recurringCategories : {})
        }).map(([category, amount]) => ({
            category,
            amount: parseFloat(amount.toFixed(2))
        }));

        return {
            total: parseFloat((totalData.total + (includeRecurring ? totalData.totalRecurring : 0)).toFixed(2)),
            totalRecurring: parseFloat(totalData.totalRecurring.toFixed(2)),
            categories: includeRecurring ? 
                { ...totalData.categories, ...totalData.recurringCategories } : 
                totalData.categories,
            recurringCategories: totalData.recurringCategories,
            charts: {
                category: await this.chart.generatePieChart(categoryData),
                daily: await this.chart.generateBarChart(dailyData)
            }
        };
    }

    /**
     * 生成日報表
     */
    async generateDailyReport(date) {
        // 使用當地時區（America/Chicago）設置日期範圍
        const targetDate = new Date(date);
        const localDate = new Date(targetDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE }));
        
        // 設置為當地時間的 00:00:00
        const startDate = new Date(localDate);
        startDate.setHours(0, 0, 0, 0);
        
        // 設置為當地時間的 23:59:59.999
        const endDate = new Date(localDate);
        endDate.setHours(23, 59, 59, 999);

        // 將時間轉換回 UTC 以便存儲查詢
        const utcStartDate = new Date(startDate.toLocaleString('en-US', { timeZone: 'UTC' }));
        const utcEndDate = new Date(endDate.toLocaleString('en-US', { timeZone: 'UTC' }));

        console.log('Daily report date ranges:', {
            input: targetDate.toISOString(),
            local: {
                date: localDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE }),
                start: startDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE }),
                end: endDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE })
            },
            utc: {
                start: utcStartDate.toISOString(),
                end: utcEndDate.toISOString()
            }
        });

        const report = await this._generateReport(utcStartDate, utcEndDate, '日');
        
        // 如果沒有支出，返回空報表
        if (report.total === 0) {
            return {
                total: 0,
                categories: {},
                message: '今日尚無支出記錄'
            };
        }
        
        // 日報表不需要趨勢圖
        delete report.charts.daily;
        
        return report;
    }

    /**
     * 生成週報表
     */
    async generateWeeklyReport(date) {
        // 使用當地時區（America/Chicago）設置日期範圍
        const targetDate = new Date(date);
        const localDate = new Date(targetDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE }));
        
        // 設置結束日期為當地時間的 23:59:59.999
        const endDate = new Date(localDate);
        endDate.setHours(23, 59, 59, 999);
        
        // 設置開始日期為當地時間的 7 天前的 00:00:00
        const startDate = new Date(localDate);
        startDate.setDate(startDate.getDate() - 6); // 往前推6天（包含當天共7天）
        startDate.setHours(0, 0, 0, 0);

        // 將時間轉換回 UTC 以便存儲查詢
        const utcStartDate = new Date(startDate.toLocaleString('en-US', { timeZone: 'UTC' }));
        const utcEndDate = new Date(endDate.toLocaleString('en-US', { timeZone: 'UTC' }));

        console.log('Weekly report date range:', {
            input: targetDate.toISOString(),
            local: {
                start: startDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE }),
                end: endDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE })
            },
            utc: {
                start: utcStartDate.toISOString(),
                end: utcEndDate.toISOString()
            },
            description: '過去7天的消費'
        });

        return this._generateReport(utcStartDate, utcEndDate, '週');
    }

    /**
     * 生成月報表
     */
    async generateMonthlyReport(date) {
        // 確保使用當月第一天作為起始日期
        const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        console.log('Monthly report date range:', {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        });

        return this._generateReport(startDate, endDate, '月');
    }

    /**
     * 生成年報表
     */
    async generateYearlyReport(date) {
        const startDate = new Date(date.getFullYear(), 0, 1);
        const endDate = new Date(date.getFullYear(), 11, 31);

        const report = await this._generateReport(startDate, endDate, '年');
        
        // 年報表不需要趨勢圖
        delete report.charts.daily;
        
        return report;
    }

    async generateYearlyDetailReport(date) {
        const startDate = new Date(date.getFullYear(), 0, 1);
        const endDate = new Date(date.getFullYear(), 11, 31);

        const report = await this._generateReport(startDate, endDate, '年');
        
        // 生成英文報告
        const english = this._generateEnglishReport(report);
        
        return {
            ...report,
            english
        };
    }

    _generateEnglishReport(report) {
        const year = new Date().getFullYear();
        let text = `Annual Expense Report ${year}\n\n`;
        
        // Total expenses
        const grandTotal = report.total + report.totalRecurring;
        text += `Total Annual Expenses: $${grandTotal.toFixed(2)}\n`;
        text += `- Regular Expenses: $${report.total.toFixed(2)}\n`;
        text += `- Recurring Expenses: $${report.totalRecurring.toFixed(2)}\n\n`;
        
        // Regular expense categories
        text += 'Regular Expense Categories:\n';
        Object.entries(report.categories)
            .sort(([,a], [,b]) => b - a)
            .forEach(([category, amount]) => {
                const percentage = ((amount / report.total) * 100).toFixed(1);
                text += `${category}: $${amount.toFixed(2)} (${percentage}%)\n`;
            });
        
        // Recurring expense categories
        text += '\nRecurring Expense Categories:\n';
        Object.entries(report.recurringCategories)
            .sort(([,a], [,b]) => b - a)
            .forEach(([category, amount]) => {
                const percentage = ((amount / report.totalRecurring) * 100).toFixed(1);
                text += `${category}: $${amount.toFixed(2)} (${percentage}%)\n`;
            });
        
        return text;
    }

    /**
     * 計算收據總額和分類統計
     * @private
     */
    _calculateTotals(receipts) {
        const result = {
            total: 0,
            categories: {}
        };

        receipts.forEach(receipt => {
            result.total += receipt.amount;
            receipt.items.forEach(item => {
                const category = item.category || 'MISC';
                result.categories[category] = (result.categories[category] || 0) + item.price;
            });
        });

        return result;
    }
}

module.exports = ReportService; 