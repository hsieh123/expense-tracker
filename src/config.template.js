module.exports = {
    BOT_TOKEN: 'YOUR_BOT_TOKEN',
    GROUP_ID: 'YOUR_GROUP_ID',
    DATA_DIR: './data',
    DATA_FILE: './data/receipts.json',
    CATEGORIES: {
        GROCERIES: { name: 'Groceries' },
        KIDS: { name: 'Kids' },
        DINING: { name: 'Dining' },
        TRANSPORT: { name: 'Transport' },
        HEALTHCARE: { name: 'Healthcare' },
        UTILITIES: { name: 'Utilities' },
        HOUSING: { name: 'Housing' },
        CLOTHING: { name: 'Clothing' },
        RECREATION: { name: 'Recreation' },
        EDUCATION: { name: 'Education' },
        SEASONAL: { name: 'Seasonal' },
        MISC: { name: 'Miscellaneous' }
    },
    AI_PROMPT_TEMPLATE: `Please help convert this receipt photo into the following JSON format:
{
    "date": "YYYY-MM-DDTHH:mm:ss",
    "amount": number,
    "store": "store name",
    "items": [
        {
            "name": "item name",
            "price": number,
            "category": "category name"
        }
    ]
}`,
    // Chart colors configuration
    CHART_COLORS: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
        colors: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#33FF99', '#FF99CC',
            '#99CCFF', '#FFFF99', '#FF99FF', '#99FFCC'
        ]
    }
}; 