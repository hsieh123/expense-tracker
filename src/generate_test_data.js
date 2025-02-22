const fs = require('fs').promises;
const path = require('path');
const { CATEGORIES } = require('./config');
const { StorageService } = require('./services/storageService');

const TEST_DATA_DIR = path.join(__dirname, '../data-test');

const storage = new StorageService(path.join(__dirname, '../data'));

// 生成隨機金額
function randomAmount(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 生成隨機收據
function generateReceipt(date) {
    const categories = Object.values(CATEGORIES).slice(0, -1); // 排除 MISC
    const itemCount = Math.floor(Math.random() * 3) + 1; // 1-3 個項目
    const items = [];
    
    for (let i = 0; i < itemCount; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        items.push({
            name: `${category.name} Item ${i + 1}`,
            price: randomAmount(50, 500),
            category: category.name
        });
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);
    
    return {
        date: date.toISOString(),
        store: `Store ${Math.floor(Math.random() * 10) + 1}`,
        amount: total,
        items: items
    };
}

async function generateYearData() {
    try {
        // 確保目錄存在
        await fs.mkdir(TEST_DATA_DIR, { recursive: true });

        // 生成一年的數據
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-12-31');

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const receiptsCount = Math.floor(Math.random() * 3) + 1; // 每天 1-3 筆收據
            const receipts = [];

            for (let i = 0; i < receiptsCount; i++) {
                receipts.push(generateReceipt(new Date(date)));
            }

            const fileName = `receipts-${date.toISOString().split('T')[0]}.json`;
            const filePath = path.join(TEST_DATA_DIR, fileName);
            await fs.writeFile(filePath, JSON.stringify(receipts, null, 2));
        }

        console.log('測試數據生成完成！');
    } catch (error) {
        console.error('生成測試數據時發生錯誤:', error);
    }
}

generateYearData(); 