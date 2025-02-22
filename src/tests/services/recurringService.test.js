const RecurringService = require('../../services/recurringService');
const fs = require('fs').promises;

jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn()
    }
}));

describe('RecurringService', () => {
    let recurringService;
    let mockStorageService;
    const testFilePath = '/test/recurring.json';

    beforeEach(() => {
        mockStorageService = {
            getReceiptsByDate: jest.fn(),
            saveReceipt: jest.fn()
        };
        recurringService = new RecurringService(mockStorageService, testFilePath);
        jest.clearAllMocks();
    });

    describe('getRecurringExpenses', () => {
        it('should return expenses from file', async () => {
            const testExpenses = [{ id: 1 }, { id: 2 }];
            fs.readFile.mockResolvedValue(JSON.stringify(testExpenses));

            const expenses = await recurringService.getRecurringExpenses();
            expect(expenses).toEqual(testExpenses);
        });

        it('should create file if not exists', async () => {
            fs.access.mockRejectedValue(new Error());
            await recurringService.getRecurringExpenses();
            expect(fs.writeFile).toHaveBeenCalledWith(testFilePath, '[]');
        });
    });

    describe('addRecurringExpense', () => {
        it('should add new expense', async () => {
            const existingExpenses = [];
            const newExpense = {
                store: 'Test Store',
                amount: 100,
                description: 'Test',
                category: 'Test'
            };

            fs.readFile.mockResolvedValue(JSON.stringify(existingExpenses));
            await recurringService.addRecurringExpense(newExpense);

            expect(fs.writeFile).toHaveBeenCalledWith(
                testFilePath,
                JSON.stringify([newExpense], null, 2)
            );
        });
    });

    describe('addMonthlyExpenses', () => {
        it('should add expenses if not already added', async () => {
            const expenses = [{
                store: 'Test Store',
                amount: 100,
                description: 'Test',
                category: 'Test'
            }];

            fs.readFile.mockResolvedValue(JSON.stringify(expenses));
            mockStorageService.getReceiptsByDate.mockResolvedValue([]);

            await recurringService.addMonthlyExpenses();

            expect(mockStorageService.saveReceipt).toHaveBeenCalledWith(
                expect.objectContaining({
                    store: 'Test Store',
                    amount: 100,
                    isRecurring: true
                })
            );
        });

        it('should not add duplicate expenses', async () => {
            const expenses = [{
                store: 'Test Store',
                amount: 100,
                description: 'Test',
                category: 'Test'
            }];

            const existingReceipts = [{
                store: 'Test Store',
                amount: 100,
                isRecurring: true
            }];

            fs.readFile.mockResolvedValue(JSON.stringify(expenses));
            mockStorageService.getReceiptsByDate.mockResolvedValue(existingReceipts);

            await recurringService.addMonthlyExpenses();

            expect(mockStorageService.saveReceipt).not.toHaveBeenCalled();
        });
    });

    describe('validateExpense', () => {
        it('should validate correct expense', () => {
            const validExpense = {
                store: 'Test Store',
                amount: 100,
                description: 'Test',
                category: 'Test'
            };
            expect(recurringService.validateExpense(validExpense)).toBe(true);
        });

        it('should reject invalid expense', () => {
            const invalidExpenses = [
                null,
                {},
                { store: 'Test' },
                { store: 'Test', amount: '100' },
                { store: 'Test', amount: 100 }
            ];

            invalidExpenses.forEach(expense => {
                expect(recurringService.validateExpense(expense)).toBe(false);
            });
        });
    });
}); 