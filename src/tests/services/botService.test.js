const BotService = require('../../services/botService');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const StorageService = require('../../services/storageService');
const ReportService = require('../../services/reportService');
const RecurringService = require('../../services/recurringService');

jest.mock('node-telegram-bot-api');
jest.mock('node-schedule');

describe('BotService', () => {
    let botService;
    let mockStorage;
    let mockReport;
    let mockRecurring;
    let mockConfig;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // 正確設置 mock
        mockReport = {
            generateDailyReport: jest.fn(),
            generateWeeklyReport: jest.fn(),
            generateMonthlyReport: jest.fn()
        };

        mockStorage = {
            saveReceipt: jest.fn(),
            getReceiptsByDate: jest.fn(),
            deleteReceipt: jest.fn(),
            ensureDataDir: jest.fn(),
            getRecentReceipts: jest.fn()
        };

        mockRecurring = {
            addMonthlyExpenses: jest.fn(),
            getRecurringExpenses: jest.fn()
        };

        mockConfig = {
            BOT_TOKEN: 'test_token',
            GROUP_ID: 'test_group',
            CATEGORIES: {
                GROCERIES: { name: 'Groceries' },
                DINING: { name: 'Dining' }
            }
        };

        botService = new BotService(mockConfig, mockStorage, mockReport, mockRecurring);
        botService.bot = {
            sendMessage: jest.fn(),
            sendPhoto: jest.fn()
        };
    });

    describe('initialization', () => {
        it('should initialize bot with correct token', () => {
            expect(TelegramBot).toHaveBeenCalledWith('test_token', { polling: true });
        });

        it('should setup scheduled tasks', () => {
            expect(schedule.scheduleJob).toHaveBeenCalledTimes(4);
        });
    });

    describe('message handling', () => {
        it('should ignore messages from wrong group', async () => {
            const msg = {
                chat: { id: 'wrong_group' },
                text: '/start'
            };

            await botService.handleMessage(msg);
            expect(mockStorage.saveReceipt).not.toHaveBeenCalled();
        });

        // ... 更多測試
    });

    describe('command handling', () => {
        it('should handle /start command', async () => {
            const msg = {
                chat: { id: 'test_group' },
                text: '/start'
            };

            botService.bot.sendMessage = jest.fn();
            await botService.handleCommand(msg);

            expect(botService.bot.sendMessage).toHaveBeenCalledWith(
                'test_group',
                expect.stringContaining('歡迎使用')
            );
        });

        it('should handle /today command', async () => {
            const msg = {
                chat: { id: 'test_group' },
                text: '/today'
            };

            const mockDailyReport = {
                total: 100,
                categories: { Food: 100 },
                charts: {
                    category: Buffer.from('test'),
                    trend: Buffer.from('test')
                }
            };

            mockReport.generateDailyReport.mockResolvedValue(mockDailyReport);

            await botService.handleCommand(msg);

            expect(mockReport.generateDailyReport).toHaveBeenCalled();
            expect(botService.bot.sendMessage).toHaveBeenCalled();
            expect(botService.bot.sendPhoto).toHaveBeenCalled();
        });

        // ... 其他命令的測試 ...
    });

    describe('manual input handling', () => {
        it('should handle date input', async () => {
            const msg = {
                chat: { id: 'test_group' },
                text: '2024-02-14 12:00'
            };

            botService.userStates.set('test_group', {
                state: 'WAITING_FOR_DATE',
                receipt: { items: [] }
            });

            botService.bot.sendMessage = jest.fn();

            await botService.handleManualInput(msg);

            expect(botService.bot.sendMessage).toHaveBeenCalledWith(
                'test_group',
                expect.stringContaining('請輸入商店名稱')
            );
        });

        // ... 其他輸入狀態的測試 ...
    });

    describe('callback query handling', () => {
        it('should handle category selection', async () => {
            const query = {
                id: 'query_id',
                message: { chat: { id: 'test_group' } },
                data: 'cat_Food'
            };

            botService.userStates.set('test_group', {
                state: 'WAITING_FOR_CATEGORY',
                receipt: {
                    items: [{ name: 'Test Item', price: 100 }]
                },
                currentItemIndex: 0
            });

            botService.bot.answerCallbackQuery = jest.fn();
            botService.bot.sendMessage = jest.fn();

            await botService.handleCallbackQuery(query);

            expect(botService.bot.answerCallbackQuery).toHaveBeenCalled();
            expect(botService.bot.sendMessage).toHaveBeenCalled();
        });

        // ... 其他回調的測試 ...
    });

    describe('handleFinishReceipt', () => {
        it('應該成功儲存有效的收據', async () => {
            const chatId = '123';
            const validReceipt = {
                date: '2024-02-14T12:00:00.000Z',
                store: 'Test Store',
                items: [
                    {
                        name: 'Item 1',
                        price: 100,
                        category: 'GROCERIES'
                    }
                ]
            };

            botService.userStates.set(chatId, { receipt: validReceipt });
            mockStorage.saveReceipt.mockResolvedValue(true);

            await botService.handleFinishReceipt(chatId);

            expect(mockStorage.saveReceipt).toHaveBeenCalledWith({
                ...validReceipt,
                amount: 100
            });
            expect(botService.bot.sendMessage).toHaveBeenCalledWith(
                chatId,
                '✅ 收據已儲存！'
            );
        });

        it('應該處理缺少必要欄位的錯誤', async () => {
            const chatId = '123';
            const invalidReceipt = {
                store: 'Test Store',
                items: []
            };

            botService.userStates.set(chatId, { receipt: invalidReceipt });

            await botService.handleFinishReceipt(chatId);

            expect(botService.bot.sendMessage).toHaveBeenCalledWith(
                chatId,
                '❌ 儲存失敗：缺少必要欄位'
            );
        });
    });

    describe('handleDelete', () => {
        it('應該顯示最近5筆收據的刪除選項', async () => {
            const chatId = '123';
            const mockReceipts = [
                { date: '2024-02-14', store: 'Store 1', amount: 100 },
                { date: '2024-02-13', store: 'Store 2', amount: 200 },
                { date: '2024-02-12', store: 'Store 3', amount: 300 },
                { date: '2024-02-11', store: 'Store 4', amount: 400 },
                { date: '2024-02-10', store: 'Store 5', amount: 500 }
            ];

            mockStorage.getRecentReceipts.mockResolvedValue(mockReceipts);

            await botService.handleDelete(chatId);

            expect(mockStorage.getRecentReceipts).toHaveBeenCalledWith(5);
            expect(botService.bot.sendMessage).toHaveBeenCalledWith(
                chatId,
                expect.stringContaining('選擇要刪除的收據'),
                expect.objectContaining({
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.arrayContaining([
                            expect.arrayContaining([
                                expect.objectContaining({
                                    text: expect.stringContaining('Store 1')
                                })
                            ])
                        ])
                    })
                })
            );
        });

        it('應該在沒有收據時顯示適當訊息', async () => {
            const chatId = '123';
            mockStorage.getRecentReceipts.mockResolvedValue([]);

            await botService.handleDelete(chatId);

            expect(botService.bot.sendMessage).toHaveBeenCalledWith(
                chatId,
                '沒有可刪除的收據'
            );
        });
    });

    // ... 其他測試
}); 