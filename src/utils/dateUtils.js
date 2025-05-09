/**
 * 日期相關工具函數
 */

/**
 * 獲取當地時間的日期字符串 (YYYY-MM-DD)
 * @param {Date} date - 日期對象
 * @returns {string} 格式化的日期字符串
 */
function getLocalDateString(date) {
    // 確保使用 UTC 時間
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 獲取當月第一天
 * @param {Date} date - 日期對象
 * @returns {Date} 當月第一天的日期對象
 */
function getFirstDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * 獲取當月最後一天
 * @param {Date} date - 日期對象
 * @returns {Date} 當月最後一天的日期對象
 */
function getLastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Convert any date to UTC ISO string
 * @param {Date|string} date - Date object or ISO string
 * @param {string} timezone - Timezone string (e.g., 'America/Chicago')
 * @returns {string} UTC ISO string
 */
function toUTCISOString(date, timezone) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return localDate.toISOString();
}

/**
 * Convert UTC ISO string to local date
 * @param {string} isoString - UTC ISO string
 * @param {string} timezone - Timezone string (e.g., 'America/Chicago')
 * @returns {Date} Local date object
 */
function fromUTCISOString(isoString, timezone) {
    return new Date(new Date(isoString).toLocaleString('en-US', { timeZone: timezone }));
}

module.exports = {
    getLocalDateString,
    getFirstDayOfMonth,
    getLastDayOfMonth,
    toUTCISOString,
    fromUTCISOString
}; 