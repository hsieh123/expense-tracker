const fs = require('fs').promises;
const path = require('path');
const { getFirstDayOfMonth } = require('../utils/dateUtils');

class RecurringService {
    constructor(storageService, recurringFilePath) {
        this.storage = storageService;
        this.filePath = recurringFilePath;
    }

    /**
     * 確保固定支出檔案存在
     * @private
     */
    async _ensureFile() {
        try {
            await fs.access(this.filePath);
        } catch {
            await fs.writeFile(this.filePath, JSON.stringify([], null, 2));
        }
    }

    /**
     * 獲取所有固定支出
     * @returns {Promise<Array>} 固定支出列表
     */
    async getRecurringExpenses() {
        await this._ensureFile();
        const data = await fs.readFile(this.filePath, 'utf8');
        return JSON.parse(data);
    }

    /**
     * 新增固定支出
     * @param {Object} expense - 固定支出資料
     * @returns {Promise<void>}
     */
    async addRecurringExpense(expense) {
        const expenses = await this.getRecurringExpenses();
        expenses.push(expense);
        await fs.writeFile(this.filePath, JSON.stringify(expenses, null, 2));
    }

    /**
     * 刪除固定支出
     * @param {number} index - 固定支出索引
     * @returns {Promise<boolean>} 是否成功刪除
     */
    async deleteRecurringExpense(index) {
        const expenses = await this.getRecurringExpenses();
        if (index >= 0 && index < expenses.length) {
            expenses.splice(index, 1);
            await fs.writeFile(this.filePath, JSON.stringify(expenses, null, 2));
            return true;
        }
        return false;
    }

    /**
     * 自動添加當月固定支出
     * @returns {Promise<void>}
     */
    async addMonthlyExpenses() {
        const firstDayOfMonth = getFirstDayOfMonth(new Date());
        
        // 檢查當天是否已經有相同的固定支出
        const existingReceipts = await this.storage.getReceiptsByDate(firstDayOfMonth);
        const expenses = await this.getRecurringExpenses();
        
        for (const expense of expenses) {
            // 檢查是否已經添加過這筆固定支出
            const isDuplicate = existingReceipts.some(receipt => 
                receipt.store === expense.store && 
                receipt.amount === expense.amount &&
                receipt.isRecurring
            );
            
            if (!isDuplicate) {
                // 建立新的收據
                const receipt = {
                    date: firstDayOfMonth.toISOString(),
                    store: expense.store,
                    amount: expense.amount,
                    isRecurring: true,
                    items: [{
                        name: expense.description,
                        price: expense.amount,
                        category: expense.category
                    }]
                };
                
                await this.storage.saveReceipt(receipt);
            }
        }
    }

    /**
     * 驗證固定支出格式
     * @param {Object} expense - 固定支出資料
     * @returns {boolean} 是否有效
     */
    validateExpense(expense) {
        return !!(expense &&
            typeof expense === 'object' &&
            expense.store &&
            typeof expense.amount === 'number' &&
            expense.description &&
            expense.category);
    }
}

module.exports = RecurringService; 