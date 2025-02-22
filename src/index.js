const path = require('path');
const config = require('./config');

// 導入所有服務
const StorageService = require('./services/storageService');
const ChartService = require('./services/chartService');
const ReportService = require('./services/reportService');
const RecurringService = require('./services/recurringService');
const BotService = require('./services/botService');
const App = require('./app');

// 確保捕獲未處理的錯誤
process.on('uncaughtException', (error) => {
    console.error('未捕獲的異常:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('未處理的 Promise 拒絕:', error);
});

// 初始化所有服務
const storage = new StorageService(config.DATA_DIR, config);
const chart = new ChartService(config);
const report = new ReportService(storage, chart, config);
const recurring = new RecurringService(storage, config);
const bot = new BotService(config, storage, report, recurring);

// 啟動應用
const app = new App(bot);
app.start().catch(error => {
    console.error('啟動失敗:', error);
    process.exit(1);
}); 