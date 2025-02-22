const fs = require('fs/promises');
const path = require('path');
const { getLocalDateString } = require('../utils/dateUtils');
const { validateReceipt } = require('../utils/validators');
const { existsSync } = require('fs');

class StorageService {
    constructor(dataDir, config) {
        this.dataDir = dataDir;
        this.config = config;
    }

    async ensureDataDir() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    getFilePath(date) {
        // 轉換為當地時區的日期
        const localDate = new Date(date.toLocaleString('en-US', { 
            timeZone: this.config.TIME_ZONE 
        }));
        
        console.log('Getting file path for:', {
            input: date.toISOString(),
            localDate: localDate.toLocaleString('en-US', { timeZone: this.config.TIME_ZONE }),
            year: localDate.getFullYear(),
            month: localDate.getMonth() + 1,
            day: localDate.getDate()
        });

        // 使用當地時間的年月日來生成檔案名
        const fileName = `receipts-${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}.json`;
        return path.join(this.dataDir, fileName);
    }

    async getReceiptsByDate(date) {
        try {
            const targetDate = new Date(date);
            console.log('Looking for receipts on date:', targetDate.toISOString());

            // 讀取對應日期的文件
            const fileName = `receipts-${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}.json`;
            const filePath = path.join(this.dataDir, fileName);

            if (!existsSync(filePath)) {
                console.log('No receipt file found for:', fileName);
                return [];
            }

            const data = await fs.readFile(filePath, 'utf8');
            const receipts = JSON.parse(data);
            console.log('Found receipts in file:', receipts);

            // 簡化日期比較：只比較年月日，忽略時間
            return receipts.filter(receipt => {
                const receiptDate = new Date(receipt.date);
                const isSameDate = 
                    receiptDate.getFullYear() === targetDate.getFullYear() &&
                    receiptDate.getMonth() === targetDate.getMonth() &&
                    receiptDate.getDate() === targetDate.getDate();

                console.log('Date comparison:', {
                    receipt: {
                        date: receiptDate.toISOString(),
                        year: receiptDate.getFullYear(),
                        month: receiptDate.getMonth(),
                        day: receiptDate.getDate()
                    },
                    target: {
                        date: targetDate.toISOString(),
                        year: targetDate.getFullYear(),
                        month: targetDate.getMonth(),
                        day: targetDate.getDate()
                    },
                    isSameDate
                });

                return isSameDate;
            });
        } catch (error) {
            console.error('獲取收據時發生錯誤:', error);
            return [];
        }
    }

    async saveReceipt(receipt) {
        try {
            if (!validateReceipt(receipt)) {
                return { success: false, error: '無效的收據格式' };
            }

            await this.ensureDataDir();
            const date = new Date(receipt.date);
            const filePath = this.getFilePath(date);
            
            console.log('Saving receipt to:', {
                date: date.toISOString(),
                filePath,
                receipt
            });

            let receipts = await this.getReceiptsByDate(date);
            receipts.push(receipt);
            
            await fs.writeFile(filePath, JSON.stringify(receipts, null, 2));
            return true;
        } catch (error) {
            console.error('儲存收據時發生錯誤:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteReceipt(date, index) {
        try {
            if (typeof index === 'object' && index.originalDate && typeof index.originalIndex === 'number') {
                date = index.originalDate;
                index = index.originalIndex;
            }

            const filePath = this.getFilePath(date);
            const receipts = await this.getReceiptsByDate(date);
            
            if (index >= 0 && index < receipts.length) {
                receipts.splice(index, 1);
                await fs.writeFile(filePath, JSON.stringify(receipts, null, 2));
                return true;
            }
            return false;
        } catch (error) {
            console.error('刪除收據時發生錯誤:', error);
            throw error;
        }
    }

    async getRecentReceipts(count = 5) {
        try {
            const today = new Date();
            const receipts = [];
            
            for (let i = 0; i < 7 && receipts.length < count; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dayReceipts = await this.getReceiptsByDate(date);
                
                receipts.push(...dayReceipts.map((receipt, idx) => ({
                    ...receipt,
                    originalDate: date,
                    originalIndex: idx,
                    date: date.toISOString().split('T')[0]
                })));
            }

            return receipts
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, count);
        } catch (error) {
            console.error('獲取最近收據時發生錯誤:', error);
            throw error;
        }
    }

    async getReceiptsByDateRange(startDate, endDate) {
        const receipts = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayReceipts = await this.getReceiptsByDate(d);
            receipts.push(...dayReceipts);
        }
        return receipts;
    }

    // ... 其他方法
}

module.exports = StorageService; 