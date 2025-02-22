/**
 * 驗證相關工具函數
 */

/**
 * 驗證收據格式
 * @param {Object} receipt - 收據對象
 * @returns {boolean} 是否有效
 */
function validateReceipt(receipt) {
    if (!receipt || typeof receipt !== 'object') {
        return false;
    }

    return !!(receipt.date && 
             typeof receipt.amount === 'number' && 
             receipt.store &&
             Array.isArray(receipt.items));
}

/**
 * 驗證商品項目格式
 * @param {Object} item - 商品項目對象
 * @returns {boolean} 是否有效
 */
function validateItem(item) {
    return !!(item &&
             typeof item === 'object' &&
             item.name &&
             typeof item.price === 'number');
}

module.exports = {
    validateReceipt,
    validateItem
}; 