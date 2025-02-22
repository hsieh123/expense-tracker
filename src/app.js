const path = require('path');
const config = require('./config');
const StorageService = require('./services/storageService');
const ChartService = require('./services/chartService');
const ReportService = require('./services/reportService');
const RecurringService = require('./services/recurringService');
const BotService = require('./services/botService');
const fs = require('fs/promises');

class App {
    constructor(bot) {
        this.bot = bot;
    }

    async start() {
        try {
            await this.ensureDataDir();
            console.log('✅ 資料目錄已就緒');
            console.log('🤖 機器人已啟動！');
        } catch (error) {
            console.error('初始化失敗:', error);
            throw error;
        }
    }

    async ensureDataDir() {
        try {
            await fs.mkdir(config.DATA_DIR, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
}

// 只導出 App 類
module.exports = App; 