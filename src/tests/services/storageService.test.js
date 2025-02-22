const StorageService = require('../../services/storageService');
const fs = require('fs').promises;
const path = require('path');

jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn()
    }
}));

describe('StorageService', () => {
    let storage;
    const testDataDir = '/test/data';

    beforeEach(() => {
        storage = new StorageService(testDataDir);
        jest.clearAllMocks();
    });

    describe('ensureDataDir', () => {
        it('should create directory if not exists', async () => {
            await storage.ensureDataDir();
            expect(fs.mkdir).toHaveBeenCalledWith(testDataDir, { recursive: true });
        });

        it('should ignore EEXIST error', async () => {
            const error = new Error('Directory exists');
            error.code = 'EEXIST';
            fs.mkdir.mockRejectedValueOnce(error);

            await expect(storage.ensureDataDir()).resolves.not.toThrow();
        });
    });

    describe('getReceiptsByDate', () => {
        it('should return receipts for date', async () => {
            const testReceipts = [{ id: 1 }, { id: 2 }];
            fs.readFile.mockResolvedValueOnce(JSON.stringify(testReceipts));

            const date = new Date('2024-02-14T00:00:00Z');
            const receipts = await storage.getReceiptsByDate(date);
            
            expect(receipts).toEqual(testReceipts);
            expect(fs.readFile).toHaveBeenCalledWith(
                expect.stringContaining('receipts-2024-02-14.json'),
                'utf8'
            );
        });

        it('should return empty array if file not found', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            fs.readFile.mockRejectedValueOnce(error);

            const date = new Date('2024-02-14');
            const receipts = await storage.getReceiptsByDate(date);
            
            expect(receipts).toEqual([]);
        });
    });

    describe('saveReceipt', () => {
        const validReceipt = {
            date: '2024-02-14T12:00:00Z',
            store: 'Test Store',
            amount: 100,
            items: [{ name: 'Test Item', price: 100 }]
        };

        it('should save valid receipt', async () => {
            fs.readFile.mockResolvedValueOnce('[]');
            
            const result = await storage.saveReceipt(validReceipt);
            
            expect(result).toBe(true);
            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('receipts-2024-02-14.json'),
                expect.any(String)
            );
        });

        it('should reject invalid receipt', async () => {
            const invalidReceipt = { date: '2024-02-14' };
            
            const result = await storage.saveReceipt(invalidReceipt);
            
            expect(result).toEqual({
                success: false,
                error: '無效的收據格式'
            });
            expect(fs.writeFile).not.toHaveBeenCalled();
        });
    });
}); 