const fs = require('fs/promises');
const path = require('path');
const { toUTCISOString } = require('../utils/dateUtils');
const config = require('../config');

async function fixReceipts() {
    const dataDir = path.join(__dirname, '../../data');
    const files = await fs.readdir(dataDir);
    const receiptFiles = files.filter(f => f.startsWith('receipts-') && f.endsWith('.json'));

    for (const file of receiptFiles) {
        console.log(`Processing ${file}...`);
        const filePath = path.join(dataDir, file);
        const data = await fs.readFile(filePath, 'utf8');
        const receipts = JSON.parse(data);

        // Fix each receipt's date
        const fixedReceipts = receipts.map(receipt => ({
            ...receipt,
            date: toUTCISOString(receipt.date, config.TIME_ZONE)
        }));

        // Write back the fixed receipts
        await fs.writeFile(filePath, JSON.stringify(fixedReceipts, null, 2));
        console.log(`Fixed ${receipts.length} receipts in ${file}`);
    }

    console.log('All receipts have been fixed!');
}

fixReceipts().catch(console.error); 