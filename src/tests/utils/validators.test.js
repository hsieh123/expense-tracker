const { validateReceipt, validateItem } = require('../../utils/validators');

describe('validators', () => {
    describe('validateReceipt', () => {
        it('should validate correct receipt', () => {
            const receipt = {
                date: '2024-02-14T12:00:00Z',
                store: 'Test Store',
                amount: 100,
                items: [
                    { name: 'Item 1', price: 50 },
                    { name: 'Item 2', price: 50 }
                ]
            };
            expect(validateReceipt(receipt)).toBe(true);
        });

        it('should reject invalid receipt', () => {
            const invalidReceipts = [
                null,
                {},
                { date: '2024-02-14' }, // missing required fields
                { date: '2024-02-14', store: 'Test', amount: '100' }, // wrong type
                { date: '2024-02-14', store: 'Test', amount: 100 } // missing items
            ];

            invalidReceipts.forEach(receipt => {
                expect(validateReceipt(receipt)).toBe(false);
            });
        });
    });

    describe('validateItem', () => {
        it('should validate correct item', () => {
            const item = {
                name: 'Test Item',
                price: 100
            };
            expect(validateItem(item)).toBe(true);
        });

        it('should reject invalid item', () => {
            const invalidItems = [
                null,
                {},
                { name: 'Test' },
                { price: 100 },
                { name: '', price: 100 },
                { name: 'Test', price: '100' }
            ];

            invalidItems.forEach(item => {
                expect(validateItem(item)).toBe(false);
            });
        });
    });
}); 