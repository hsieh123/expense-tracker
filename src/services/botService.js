const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

class BotService {
    constructor(config, storageService, reportService, recurringService) {
        this.config = config;
        this.storage = storageService;
        this.report = reportService;
        this.recurring = recurringService;
        
        this.bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
        this.userStates = new Map();
        this.deleteStates = new Map();
        
        this.initializeBot();
        this.setupScheduledTasks();

        // 設置命令列表
        this.bot.setMyCommands([
            { command: 'start', description: '顯示主選單' }
        ]);

        // 監聽新成員加入和私聊開始
        this.bot.on('new_chat_members', msg => this.showMainMenu(msg.chat.id));
        this.bot.on('private_chat_started', msg => this.showMainMenu(msg.chat.id));
    }

    /**
     * 初始化 bot 和事件處理
     * @private
     */
    initializeBot() {
        // 處理文字訊息
        this.bot.on('text', async (msg) => {
            if (msg.chat.id.toString() !== this.config.GROUP_ID) {
                console.log('群組ID不符合:', msg.chat.id);
                return;
            }

            try {
                if (msg.text.startsWith('/')) {
                    await this.handleCommand(msg);
                    return;
                }

                const userState = this.userStates.get(msg.chat.id);
                if (userState) {
                    await this.handleManualInput(msg);
                    return;
                }

                if (this.deleteStates.has(msg.chat.id)) {
                    await this.handleDeleteInput(msg);
                    return;
                }

                // 嘗試解析為 JSON
                try {
                    await this.handleJsonInput(msg.chat.id, msg.text);
                } catch (error) {
                    // 如果不是有效的 JSON，靜默失敗
                    console.log('非 JSON 格式的訊息:', error.message);
                }

            } catch (error) {
                console.error('處理訊息時發生錯誤:', error);
                await this.bot.sendMessage(msg.chat.id, '❌ 發生錯誤，請重試');
            }
        });

        // 處理按鈕回調
        this.bot.on('callback_query', async (query) => {
            try {
                await this.handleCallbackQuery(query);
            } catch (error) {
                console.error('處理按鈕回調時發生錯誤:', error);
                await this.bot.sendMessage(
                    query.message.chat.id,
                    '❌ 發生錯誤，請重新開始'
                );
            }
        });
    }

    /**
     * 設置定時任務
     * @private
     */
    setupScheduledTasks() {
        // 每天晚上 9 點發送日報
        schedule.scheduleJob('0 21 * * *', async () => {
            const report = await this.report.generateDailyReport(new Date());
            await this.sendReport(this.config.GROUP_ID, '今日', report);
        });

        // 每週日晚上 9 點發送週報
        schedule.scheduleJob('0 21 * * 0', async () => {
            const report = await this.report.generateWeeklyReport(new Date());
            await this.sendReport(this.config.GROUP_ID, '本週', report);
        });

        // 每月 1 日晚上 9 點發送月報
        schedule.scheduleJob('0 21 1 * *', async () => {
            const report = await this.report.generateMonthlyReport(new Date());
            await this.sendReport(this.config.GROUP_ID, '本月', report);
        });

        // 每月 1 日凌晨自動添加固定支出
        schedule.scheduleJob('0 0 1 * *', async () => {
            try {
                await this.recurring.addMonthlyExpenses();
                console.log('已自動添加本月固定支出');
            } catch (error) {
                console.error('自動添加固定支出時發生錯誤:', error);
            }
        });
    }

    /**
     * 處理命令
     * @private
     */
    async handleCommand(msg) {
        const chatId = msg.chat.id;
        const text = msg.text.toLowerCase();

        try {
            switch (text) {
                case '/start':
                case '選單':
                case '主選單':
                    await this.showMainMenu(chatId);
                    break;
                case '📊 日報':
                case '日報':
                case '/day':
                    // 使用當前時間，並考慮時區
                    const now = new Date();
                    const localDate = new Date(now.toLocaleString('en-US', { 
                        timeZone: this.config.TIME_ZONE 
                    }));
                    const dailyReport = await this.report.generateDailyReport(localDate);
                    await this.sendReport(chatId, dailyReport, '今日');
                    break;
                case '📈 週報':
                case '週報':
                case '/week':
                    const weekReport = await this.report.generateWeeklyReport(new Date());
                    await this.sendReport(chatId, weekReport, '本週');
                    break;
                case '📅 月報':
                case '月報':
                case '/month':
                    const monthReport = await this.report.generateMonthlyReport(new Date());
                    await this.sendReport(chatId, monthReport, '本月');
                    break;
                case '📆 年報':
                case '年報':
                case '/year':
                    const yearReport = await this.report.generateYearlyReport(new Date());
                    await this.sendYearReport(chatId, yearReport);
                    break;
                case '➕ 新增':
                case '/add':
                    await this.startManualEntry(chatId);
                    break;
                case '❌ 刪除':
                case '/delete':
                    await this.handleDelete(chatId);
                    break;
                case '/prompt':
                    await this.showPromptTemplate(chatId);
                    break;
                case '/recurring':
                    await this.showRecurringMenu(chatId);
                    break;
                case '/json':
                    await this.bot.sendMessage(chatId, 
                        '請輸入 JSON 格式的收據資料，格式如下：\n' +
                        '{\n' +
                        '  "date": "2024-02-14T12:00:00",\n' +
                        '  "store": "商店名稱",\n' +
                        '  "items": [\n' +
                        '    {\n' +
                        '      "name": "商品名稱",\n' +
                        '      "price": 100,\n' +
                        '      "category": "GROCERIES"\n' +
                        '    }\n' +
                        '  ]\n' +
                        '}'
                    );
                    this.userStates.set(chatId, { state: 'WAITING_FOR_JSON' });
                    break;
            }
        } catch (error) {
            console.error('處理命令時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 錯誤：' + error.message);
        }
    }

    /**
     * 處理手動輸入
     * @private
     */
    async handleManualInput(msg) {
        const chatId = msg.chat.id;
        const userState = this.userStates.get(chatId);

        try {
            switch (userState.state) {
                case 'WAITING_FOR_DATE':
                    await this.handleDateInput(chatId, msg.text);
                    break;

                case 'WAITING_FOR_STORE':
                    await this.handleStoreInput(chatId, msg.text);
                    break;

                case 'WAITING_FOR_ITEM_NAME':
                    await this.handleItemNameInput(chatId, msg.text);
                    break;

                case 'WAITING_FOR_ITEM_PRICE':
                    await this.handleItemPriceInput(chatId, msg.text);
                    break;

                case 'RECURRING_STORE':
                    await this.handleRecurringStoreInput(chatId, msg.text);
                    break;

                case 'RECURRING_AMOUNT':
                    await this.handleRecurringAmountInput(chatId, msg.text);
                    break;

                case 'RECURRING_DESCRIPTION':
                    await this.handleRecurringDescriptionInput(chatId, msg.text);
                    break;

                case 'WAITING_FOR_JSON':
                    await this.handleJsonInput(chatId, msg.text);
                    this.userStates.delete(chatId);
                    break;
            }
        } catch (error) {
            console.error('處理手動輸入時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 發生錯誤，請重新開始');
            this.userStates.delete(chatId);
        }
    }

    /**
     * 處理回調查詢
     * @private
     */
    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        await this.bot.answerCallbackQuery(query.id);

        if (query.data.startsWith('cat_')) {
            await this.handleCategorySelection(chatId, query.data);
            return;
        }

        if (query.data.startsWith('del_receipt_')) {
            await this.handleDeleteReceipt(chatId, query.data, query.message.message_id);
            return;
        }

        switch (query.data) {
            case 'time_now':
                await this.handleTimeNowSelection(chatId);
                break;

            case 'finish':
                await this.handleFinishReceipt(chatId);
                break;

            case 'add_item':
                await this.handleAddItem(chatId);
                break;

            case 'cancel':
                await this.handleCancel(chatId);
                break;

            case 'recurring_list':
                await this.handleRecurringList(chatId);
                break;

            case 'recurring_add':
                await this.handleRecurringAdd(chatId);
                break;

            case 'recurring_delete':
                await this.handleRecurringDelete(chatId);
                break;

            case 'recurring_add_monthly':
                await this.handleRecurringAddMonthly(chatId);
                break;

            case 'generate_year_report':
                const report = await this.report.generateYearlyDetailReport(new Date());
                await this.bot.sendMessage(query.message.chat.id, 
                    '<b>Annual Expense Report</b>\n\n' +
                    report.english + '\n\n' +
                    '建議提示詞：\n' +
                    '請用繁體中文幫我分析這份年度支出報告，並提供以下內容：\n' +
                    '1. 總體支出概況\n' +
                    '2. 主要支出類別分析\n' +
                    '3. 異常或值得注意的支出\n' +
                    '4. 建議改進的方向',
                    { parse_mode: 'HTML' }
                );
                break;
        }
    }

    async handleDateInput(chatId, text) {
        try {
            const inputDate = new Date(text);
            if (isNaN(inputDate)) {
                throw new Error('無效的日期格式');
            }

            // 轉換為當地時區
            const localDate = new Date(inputDate.toLocaleString('en-US', { 
                timeZone: this.config.TIME_ZONE 
            }));

            const userState = this.userStates.get(chatId);
            userState.receipt = {
                date: localDate.toISOString(), // 使用 ISO 格式
                items: []
            };
            userState.state = 'WAITING_FOR_STORE';

            await this.bot.sendMessage(
                chatId, 
                `日期已設定為：${localDate.toLocaleString('zh-TW', { 
                    timeZone: this.config.TIME_ZONE,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}\n\n請輸入商店名稱`
            );
        } catch (error) {
            await this.bot.sendMessage(
                chatId, 
                '❌ 無效的日期格式，請重新輸入（例如：2024-02-14 12:00）'
            );
        }
    }

    async handleStoreInput(chatId, text) {
        const userState = this.userStates.get(chatId);
        userState.receipt.store = text;
        userState.state = 'WAITING_FOR_ITEM_NAME';
        await this.bot.sendMessage(chatId, '請輸入商品名稱');
    }

    async handleItemNameInput(chatId, text) {
        const userState = this.userStates.get(chatId);
        userState.currentItem = { name: text };
        userState.state = 'WAITING_FOR_ITEM_PRICE';
        await this.bot.sendMessage(chatId, '請輸入商品價格');
    }

    async handleItemPriceInput(chatId, text) {
        const userState = this.userStates.get(chatId);
        const price = parseFloat(text);
        
        if (isNaN(price)) {
            await this.bot.sendMessage(chatId, '❌ 無效的價格，請重新輸入');
            return;
        }

        userState.currentItem.price = price;
        userState.currentItemIndex = userState.receipt.items.length;
        userState.receipt.items.push(userState.currentItem);
        userState.state = 'WAITING_FOR_CATEGORY';

        await this.showCategorySelector(chatId);
    }

    async handleCategorySelection(chatId, data) {
        const userState = this.userStates.get(chatId);
        const category = data.replace('cat_', '');
        
        if (typeof userState.currentItemIndex !== 'undefined' && 
            userState.receipt.items[userState.currentItemIndex]) {
            userState.receipt.items[userState.currentItemIndex].category = category;
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '➕ 添加另一個商品', callback_data: 'add_item' }],
                    [{ text: '✅ 完成', callback_data: 'finish' }],
                    [{ text: '❌ 取消', callback_data: 'cancel' }]
                ]
            };

            await this.bot.sendMessage(
                chatId,
                '商品已添加！請選擇下一步：',
                { reply_markup: keyboard }
            );
        } else {
            console.error('找不到當前項目索引');
            await this.bot.sendMessage(chatId, '❌ 發生錯誤，請重新開始');
            this.userStates.delete(chatId);
        }
    }

    async showCategorySelector(chatId) {
        const categories = Object.entries(this.config.CATEGORIES);
        const keyboard = {
            inline_keyboard: categories.reduce((acc, [key, value], index) => {
                if (index % 2 === 0) {
                    acc.push([]);
                }
                acc[acc.length - 1].push({
                    text: value.name,
                    callback_data: `cat_${key}`
                });
                return acc;
            }, [])
        };

        await this.bot.sendMessage(
            chatId,
            '請選擇商品類別：',
            { reply_markup: keyboard }
        );
    }

    /**
     * 發送歡迎訊息
     * @private
     */
    async showMainMenu(chatId) {
        const keyboard = {
            keyboard: [
                [
                    { text: '📊 日報', command: '/day' },
                    { text: '📈 週報', command: '/week' }
                ],
                [
                    { text: '📅 月報', command: '/month' },
                    { text: '📆 年報', command: '/year' }
                ],
                [
                    { text: '➕ 新增', command: '/add' },
                    { text: '❌ 刪除', command: '/delete' }
                ]
            ].map(row => 
                row.map(btn => ({
                    text: btn.text,
                    // 直接使用命令文字
                    text: btn.command
                }))
            ),
            resize_keyboard: true,
            persistent: true
        };

        await this.bot.sendMessage(
            chatId,
            '🤖 *記帳助手*\n\n' +
            '請選擇功能：\n\n' +
            '📊 查看支出報表\n' +
            '➕ 新增收據\n' +
            '❌ 刪除記錄',
            {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }

    /**
     * 發送報表
     * @private
     */
    async sendReport(chatId, report, title) {
        try {
            if (report.message) {
                await this.bot.sendMessage(chatId, `📊 ${title}報表\n\n${report.message}`);
                return;
            }

            let message = `📊 ${title}報表\n\n`;
            message += `💰 總支出：$${report.total.toFixed(2)}\n\n`;
            
            if (Object.keys(report.categories).length > 0) {
                message += '📈 支出分類：\n';
                Object.entries(report.categories)
                    .sort(([,a], [,b]) => b - a)
                    .forEach(([category, amount]) => {
                        const percentage = ((amount / report.total) * 100).toFixed(1);
                        message += `${category}: $${amount.toFixed(2)} (${percentage}%)\n`;
                    });

                // 發送圓餅圖
                if (report.charts?.category) {
                    await this.bot.sendPhoto(chatId, report.charts.category);
                }

                // 發送趨勢圖（週報和月報）
                if ((title === '本週' || title === '本月') && report.charts?.daily) {
                    await this.bot.sendPhoto(chatId, report.charts.daily, {
                        caption: '每日支出趨勢'
                    });
                }
            }

            await this.bot.sendMessage(chatId, message);
        } catch (error) {
            console.error('發送報表時發生錯誤:', error);
            throw error;
        }
    }

    async sendYearReport(chatId, report) {
        try {
            // 發送圓餅圖
            if (report.charts?.category) {
                await this.bot.sendPhoto(chatId, report.charts.category, {
                    caption: '年度非固定支出分類',
                    parse_mode: 'HTML'
                });
            }

            // 發送文字報表
            let message = '<b>年度報表</b>\n\n';
            
            // 總計
            const grandTotal = report.total + report.totalRecurring;
            message += `總支出：$${grandTotal.toFixed(2)}\n`;
            message += `- 非固定支出：$${report.total.toFixed(2)}\n`;
            message += `- 固定支出：$${report.totalRecurring.toFixed(2)}\n\n`;
            
            // 非固定支出明細
            message += '非固定支出明細：\n';
            Object.entries(report.categories)
                .sort(([,a], [,b]) => b - a)
                .forEach(([category, amount]) => {
                    const percentage = ((amount / report.total) * 100).toFixed(1);
                    message += `${category}: $${amount.toFixed(2)} (${percentage}%)\n`;
                });
            
            // 固定支出明細
            message += '\n固定支出明細：\n';
            Object.entries(report.recurringCategories)
                .sort(([,a], [,b]) => b - a)
                .forEach(([category, amount]) => {
                    const percentage = ((amount / report.totalRecurring) * 100).toFixed(1);
                    message += `${category}: $${amount.toFixed(2)} (${percentage}%)\n`;
                });

            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

            // 詢問是否需要詳細報告
            const keyboard = {
                inline_keyboard: [[{
                    text: '生成詳細年度報告',
                    callback_data: 'generate_year_report'
                }]]
            };

            await this.bot.sendMessage(chatId, 
                '需要生成詳細的年度報告嗎？\n' +
                '報告將包含完整的支出數據，可用於AI分析。', 
                { reply_markup: keyboard }
            );
        } catch (error) {
            console.error('發送年度報表時發生錯誤:', error);
            throw error;
        }
    }

    async handleRecurringAddMonthly(chatId) {
        try {
            await this.recurring.addMonthlyExpenses();
            await this.bot.sendMessage(chatId, '✅ 已成功添加本月固定支出');
        } catch (error) {
            console.error('添加固定支出時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 添加固定支出時發生錯誤');
        }
    }

    async handleRecurringList(chatId) {
        try {
            const expenses = await this.recurring.getRecurringExpenses();
            if (expenses.length === 0) {
                await this.bot.sendMessage(chatId, '目前沒有設定任何固定支出');
                return;
            }

            let message = '📋 固定支出列表：\n\n';
            expenses.forEach((expense, index) => {
                message += `${index + 1}. ${expense.store}\n`;
                message += `   💰 金額：$${expense.amount}\n`;
                message += `   📝 描述：${expense.description}\n`;
                message += `   🏷️ 類別：${expense.category}\n\n`;
            });

            await this.bot.sendMessage(chatId, message);
        } catch (error) {
            console.error('獲取固定支出列表時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 獲取固定支出列表時發生錯誤');
        }
    }

    async handleRecurringAdd(chatId) {
        try {
            this.userStates.set(chatId, {
                state: 'RECURRING_STORE',
                recurringExpense: {}
            });
            await this.bot.sendMessage(chatId, '請輸入商店名稱：');
        } catch (error) {
            console.error('開始添加固定支出時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 發生錯誤，請重試');
        }
    }

    async handleRecurringDelete(chatId) {
        try {
            const expenses = await this.recurring.getRecurringExpenses();
            if (expenses.length === 0) {
                await this.bot.sendMessage(chatId, '沒有可刪除的固定支出');
                return;
            }

            let message = '選擇要刪除的固定支出：\n\n';
            const keyboard = {
                inline_keyboard: expenses.map((expense, index) => [{
                    text: `${index + 1}. ${expense.store} ($${expense.amount})`,
                    callback_data: `del_recurring_${index}`
                }])
            };

            await this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('顯示刪除固定支出選項時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 發生錯誤，請重試');
        }
    }

    async showRecurringMenu(chatId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '📋 查看列表', callback_data: 'recurring_list' }],
                [{ text: '➕ 新增固定支出', callback_data: 'recurring_add' }],
                [{ text: '❌ 刪除固定支出', callback_data: 'recurring_delete' }],
                [{ text: '🔄 添加本月固定支出', callback_data: 'recurring_add_monthly' }]
            ]
        };

        await this.bot.sendMessage(
            chatId,
            '📊 固定支出管理\n\n請選擇操作：',
            { reply_markup: keyboard }
        );
    }

    async showPromptTemplate(chatId) {
        const message = '📝 AI 辨識提示範本：\n\n' + this.config.AI_PROMPT_TEMPLATE;
        await this.bot.sendMessage(chatId, message);
    }

    async startManualEntry(chatId) {
        this.userStates.set(chatId, {
            state: 'WAITING_FOR_DATE',
            receipt: {
                items: []
            }
        });

        const keyboard = {
            inline_keyboard: [
                [{ text: '現在時間', callback_data: 'time_now' }]
            ]
        };

        await this.bot.sendMessage(
            chatId,
            '請輸入收據日期時間（例如：2024-02-14 12:00）\n或點擊下方按鈕使用現在時間',
            { reply_markup: keyboard }
        );
    }

    async handleTimeNowSelection(chatId) {
        try {
            // 使用當地時區的當前時間
            const now = new Date();
            const localDate = new Date(now.toLocaleString('en-US', { 
                timeZone: this.config.TIME_ZONE 
            }));

            const userState = this.userStates.get(chatId);
            userState.receipt = {
                date: localDate.toISOString(), // 使用 ISO 格式
                items: []
            };
            userState.state = 'WAITING_FOR_STORE';

            await this.bot.sendMessage(
                chatId, 
                `日期已設定為：${localDate.toLocaleString('zh-TW', { 
                    timeZone: this.config.TIME_ZONE,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}\n\n請輸入商店名稱`
            );
        } catch (error) {
            console.error('設置當前時間時發生錯誤:', error);
            await this.handleError(chatId, error);
        }
    }

    async handleFinishReceipt(chatId) {
        const userState = this.userStates.get(chatId);
        
        try {
            // 計算總金額
            userState.receipt.amount = userState.receipt.items.reduce(
                (sum, item) => sum + item.price, 
                0
            );

            // 驗證必要欄位
            if (!userState.receipt.date || 
                !userState.receipt.store || 
                !Array.isArray(userState.receipt.items) ||
                userState.receipt.items.length === 0) {
                throw new Error('缺少必要欄位');
            }

            // 驗證每個項目
            for (const item of userState.receipt.items) {
                if (!item.name || typeof item.price !== 'number' || !item.category) {
                    throw new Error('項目資料不完整');
                }
            }

            const result = await this.storage.saveReceipt(userState.receipt);
            if (result === true) {
                await this.bot.sendMessage(chatId, '✅ 收據已儲存！');
            } else {
                await this.bot.sendMessage(chatId, '❌ 儲存失敗：' + result.error);
            }
        } catch (error) {
            console.error('儲存收據時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 儲存失敗：' + error.message);
        } finally {
            this.userStates.delete(chatId);
        }
    }

    async handleAddItem(chatId) {
        const userState = this.userStates.get(chatId);
        userState.state = 'WAITING_FOR_ITEM_NAME';
        await this.bot.sendMessage(chatId, '請輸入商品名稱');
    }

    async handleCancel(chatId) {
        this.userStates.delete(chatId);
        await this.bot.sendMessage(chatId, '❌ 已取消');
    }

    async handleDelete(chatId) {
        try {
            const receipts = await this.storage.getRecentReceipts(5);
            
            if (receipts.length === 0) {
                await this.bot.sendMessage(chatId, '沒有可刪除的收據');
                return;
            }

            let message = '選擇要刪除的收據：\n\n';
            const keyboard = {
                inline_keyboard: receipts.map((receipt, index) => [{
                    text: `${receipt.date} ${receipt.store} ($${receipt.amount})`,
                    callback_data: `del_receipt_${index}`
                }])
            };

            await this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('顯示刪除選項時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 發生錯誤，請重試');
        }
    }

    async handleDeleteReceipt(chatId, data, messageId) {
        try {
            const [_, index] = data.match(/del_receipt_(\d+)/);
            const receipts = await this.storage.getRecentReceipts(5);
            const receipt = receipts[parseInt(index)];

            if (!receipt) {
                throw new Error('找不到指定的收據');
            }

            const success = await this.storage.deleteReceipt(receipt.originalDate, receipt);
            if (success) {
                const remainingReceipts = await this.storage.getRecentReceipts(5);
                
                if (remainingReceipts.length > 0) {
                    await this.bot.editMessageText(
                        '選擇要刪除的收據：\n\n✅ 上一筆收據已刪除',
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            reply_markup: {
                                inline_keyboard: remainingReceipts.map((r, idx) => [{
                                    text: `${r.date} ${r.store} ($${r.amount})`,
                                    callback_data: `del_receipt_${idx}`
                                }])
                            }
                        }
                    );
                } else {
                    await this.bot.editMessageText(
                        '✅ 收據已刪除\n\n沒有更多可刪除的收據',
                        {
                            chat_id: chatId,
                            message_id: messageId
                        }
                    );
                }
            } else {
                throw new Error('刪除失敗');
            }
        } catch (error) {
            console.error('刪除收據時發生錯誤:', error);
            await this.bot.sendMessage(chatId, '❌ 刪除失敗：' + error.message);
        }
    }

    async handleJsonInput(chatId, text) {
        try {
            const receipt = JSON.parse(text);
            
            // 驗證必要欄位
            if (!receipt.date || !receipt.store || !Array.isArray(receipt.items)) {
                throw new Error('缺少必要欄位 (date, store, items)');
            }

            // 驗證日期格式
            const date = new Date(receipt.date);
            if (isNaN(date)) {
                throw new Error('無效的日期格式');
            }

            // 驗證項目
            if (receipt.items.length === 0) {
                throw new Error('至少需要一個項目');
            }

            for (const item of receipt.items) {
                if (!item.name || typeof item.price !== 'number' || !item.category) {
                    throw new Error('項目格式錯誤 (需要 name, price, category)');
                }
            }

            // 計算總金額
            receipt.amount = receipt.items.reduce((sum, item) => sum + item.price, 0);

            // 儲存收據
            const result = await this.storage.saveReceipt(receipt);
            if (result === true) {
                await this.bot.sendMessage(chatId, '✅ 收據已儲存！');
            } else {
                await this.bot.sendMessage(chatId, '❌ 儲存失敗：' + result.error);
            }
        } catch (error) {
            // 如果是在 initializeBot 中調用，我們會捕獲這個錯誤並靜默失敗
            // 如果是在其他地方調用（比如 /json 命令），我們會顯示錯誤訊息
            if (error instanceof SyntaxError) {
                throw new Error('無效的 JSON 格式');
            }
            throw error;
        }
    }

    async handleError(chatId, error, customMessage = null) {
        console.error('操作發生錯誤:', error);
        await this.bot.sendMessage(
            chatId, 
            customMessage || '❌ 錯誤：' + error.message
        );
    }
}

module.exports = BotService; 