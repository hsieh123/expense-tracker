module.exports = {
    // 測試環境
    testEnvironment: 'node',
    
    // 測試檔案的匹配模式
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    
    // 覆蓋率收集
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/app.js',  // 排除入口文件
        '!**/node_modules/**'
    ],
    
    // 在每次測試前執行的設置
    setupFiles: ['./tests/setup.js'],
    
    // 忽略特定文件
    testPathIgnorePatterns: [
        '/node_modules/',
        'src/tests/services/chartService.test.js'
    ]
}; 