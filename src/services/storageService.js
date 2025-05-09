const fs = require('fs/promises');
const path = require('path');
const { getLocalDateString, toUTCISOString, fromUTCISOString } = require('../utils/dateUtils');
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
        // Convert to local date for filename
        const localDate = fromUTCISOString(date.toISOString(), this.config.TIME_ZONE);
        const fileName = `receipts-${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}.json`;
        return path.join(this.dataDir, fileName);
    }

    async getReceiptsByDate(date) {
        try {
            const targetDate = fromUTCISOString(date.toISOString(), this.config.TIME_ZONE);
            console.log('Looking for receipts on date:', targetDate.toISOString());

            const fileName = `receipts-${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}.json`;
            const filePath = path.join(this.dataDir, fileName);

            if (!existsSync(filePath)) {
                console.log('No receipt file found for:', fileName);
                return [];
            }

            const data = await fs.readFile(filePath, 'utf8');
            const receipts = JSON.parse(data);
            console.log('Found receipts in file:', receipts);

            // Convert all receipt dates to UTC for comparison
            return receipts.filter(receipt => {
                const receiptDate = fromUTCISOString(receipt.date, this.config.TIME_ZONE);
                const isSameDate = 
                    receiptDate.getFullYear() === targetDate.getFullYear() &&
                    receiptDate.getMonth() === targetDate.getMonth() &&
                    receiptDate.getDate() === targetDate.getDate();

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
            
            // Convert receipt date to UTC
            const receiptWithUTC = {
                ...receipt,
                date: toUTCISOString(receipt.date, this.config.TIME_ZONE)
            };
            
            const date = new Date(receiptWithUTC.date);
            const filePath = this.getFilePath(date);
            
            console.log('Saving receipt to:', {
                date: date.toISOString(),
                filePath,
                receipt: receiptWithUTC
            });

            let receipts = await this.getReceiptsByDate(date);
            receipts.push(receiptWithUTC);
            
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