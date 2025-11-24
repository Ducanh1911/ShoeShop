/**
 * Compare Before/After DDoS Protection
 * So sánh hiệu quả của rate limiting protection
 * 
 * Cách sử dụng:
 * 1. Comment middlewares trong UserRoutes.js (loginSpeedLimiter, loginRateLimiter)
 * 2. Chạy: node compare.js before
 * 3. Uncomment middlewares
 * 4. Chạy: node compare.js after
 * 5. Chạy: node compare.js report (để xem so sánh)
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const RESULTS_DIR = './results';
const CONFIG = {
    TARGET_URL: 'http://localhost:1000/api/users/login',
    CONCURRENT_REQUESTS: 15,
    TOTAL_REQUESTS: 150,
    DELAY_BETWEEN_BATCHES: 50,
    TIMEOUT: 5000,
};

const FAKE_CREDENTIALS = [
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'user@example.com', password: 'user123' },
    { email: 'test@test.com', password: 'test123' },
];

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'PostmanRuntime/7.26.8',
];

// ================== ENSURE RESULTS DIR ==================
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR);
}

// ================== STATISTICS ==================
const stats = {
    total: 0,
    success: 0,
    failed: 0,
    rateLimited: 0,
    timeout: 0,
    errors: {},
    responseTimes: [],
    startTime: 0,
    endTime: 0,
};

// ================== HELPER FUNCTIONS ==================
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ================== ATTACK FUNCTION ==================
async function sendLoginRequest() {
    const credential = getRandomItem(FAKE_CREDENTIALS);
    const userAgent = getRandomItem(USER_AGENTS);
    const startTime = Date.now();

    try {
        const response = await axios.post(
            CONFIG.TARGET_URL,
            credential,
            {
                headers: {
                    'User-Agent': userAgent,
                    'Content-Type': 'application/json',
                },
                timeout: CONFIG.TIMEOUT,
            }
        );

        const responseTime = Date.now() - startTime;
        stats.responseTimes.push(responseTime);
        stats.success++;

        return { status: 'success', statusCode: response.status, responseTime };

    } catch (error) {
        const responseTime = Date.now() - startTime;

        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            stats.timeout++;
            return { status: 'timeout', responseTime };
        }

        if (error.response) {
            const statusCode = error.response.status;

            if (statusCode === 429) {
                stats.rateLimited++;
                return { status: 'rate-limited', statusCode, responseTime };
            }

            stats.failed++;
            stats.errors[`HTTP_${statusCode}`] = (stats.errors[`HTTP_${statusCode}`] || 0) + 1;
            return { status: 'failed', statusCode, responseTime };
        }

        stats.failed++;
        stats.errors[error.code || 'UNKNOWN'] = (stats.errors[error.code || 'UNKNOWN'] || 0) + 1;
        return { status: 'error', responseTime, error: error.message };
    } finally {
        stats.total++;
    }
}

// ================== BATCH ATTACK ==================
async function runBatchAttack(batchSize) {
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
        promises.push(sendLoginRequest());
    }
    return await Promise.allSettled(promises);
}

// ================== MAIN ATTACK ==================
async function runTest(testName) {
    console.log(`\n🚀 Running ${testName} test...`);
    console.log(`Target: ${CONFIG.TARGET_URL}`);
    console.log(`Total Requests: ${CONFIG.TOTAL_REQUESTS}`);
    console.log(`Concurrent: ${CONFIG.CONCURRENT_REQUESTS}\n`);

    stats.startTime = Date.now();
    const totalBatches = Math.ceil(CONFIG.TOTAL_REQUESTS / CONFIG.CONCURRENT_REQUESTS);

    for (let batch = 0; batch < totalBatches; batch++) {
        const remaining = CONFIG.TOTAL_REQUESTS - stats.total;
        const batchSize = Math.min(CONFIG.CONCURRENT_REQUESTS, remaining);

        process.stdout.write(`\rProgress: [${stats.total}/${CONFIG.TOTAL_REQUESTS}] Batch ${batch + 1}/${totalBatches}`);

        await runBatchAttack(batchSize);

        if (stats.total < CONFIG.TOTAL_REQUESTS) {
            await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
        }
    }

    stats.endTime = Date.now();

    const results = calculateResults();
    saveResults(testName, results);
    printResults(testName, results);
}

// ================== CALCULATE RESULTS ==================
function calculateResults() {
    const duration = (stats.endTime - stats.startTime) / 1000;
    const avgResponseTime = stats.responseTimes.length > 0
        ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
        : 0;
    const minResponseTime = stats.responseTimes.length > 0 ? Math.min(...stats.responseTimes) : 0;
    const maxResponseTime = stats.responseTimes.length > 0 ? Math.max(...stats.responseTimes) : 0;

    return {
        duration,
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        rateLimited: stats.rateLimited,
        timeout: stats.timeout,
        errors: stats.errors,
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        requestsPerSecond: stats.total / duration,
        successRate: (stats.success / stats.total) * 100,
        rateLimitedRate: (stats.rateLimited / stats.total) * 100,
    };
}

// ================== SAVE RESULTS ==================
function saveResults(testName, results) {
    const filename = path.join(RESULTS_DIR, `${testName}.json`);
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n\n💾 Results saved to: ${filename}`);
}

// ================== PRINT RESULTS ==================
function printResults(testName, results) {
    console.log(`\n\n📊 ========== ${testName.toUpperCase()} RESULTS ==========`);
    console.log(`⏱️  Duration: ${results.duration.toFixed(2)}s`);
    console.log(`📈 Total Requests: ${results.total}`);
    console.log(`✅ Successful: ${results.success} (${results.successRate.toFixed(2)}%)`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`🚫 Rate Limited: ${results.rateLimited} (${results.rateLimitedRate.toFixed(2)}%)`);
    console.log(`⏳ Timeout: ${results.timeout}`);
    console.log(`\n📉 Response Times:`);
    console.log(`   Average: ${results.avgResponseTime.toFixed(2)}ms`);
    console.log(`   Min: ${results.minResponseTime}ms`);
    console.log(`   Max: ${results.maxResponseTime}ms`);
    console.log(`\n⚡ Performance:`);
    console.log(`   ${results.requestsPerSecond.toFixed(2)} requests/second`);
    console.log('================================================\n');
}

// ================== COMPARE REPORT ==================
function generateReport() {
    const beforeFile = path.join(RESULTS_DIR, 'before.json');
    const afterFile = path.join(RESULTS_DIR, 'after.json');

    if (!fs.existsSync(beforeFile) || !fs.existsSync(afterFile)) {
        console.error('❌ Missing test results. Please run "before" and "after" tests first.');
        process.exit(1);
    }

    const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
    const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));

    console.log('\n🔍 ========== COMPARISON REPORT ==========\n');

    console.log('📊 Success Rate:');
    console.log(`   BEFORE: ${before.successRate.toFixed(2)}% (${before.success}/${before.total})`);
    console.log(`   AFTER:  ${after.successRate.toFixed(2)}% (${after.success}/${after.total})`);
    console.log(`   CHANGE: ${(after.successRate - before.successRate).toFixed(2)}%\n`);

    console.log('🚫 Rate Limiting:');
    console.log(`   BEFORE: ${before.rateLimited} blocked (${before.rateLimitedRate.toFixed(2)}%)`);
    console.log(`   AFTER:  ${after.rateLimited} blocked (${after.rateLimitedRate.toFixed(2)}%)`);
    console.log(`   CHANGE: +${after.rateLimited - before.rateLimited} blocked\n`);

    console.log('📉 Average Response Time:');
    console.log(`   BEFORE: ${before.avgResponseTime.toFixed(2)}ms`);
    console.log(`   AFTER:  ${after.avgResponseTime.toFixed(2)}ms`);
    console.log(`   CHANGE: ${(after.avgResponseTime - before.avgResponseTime).toFixed(2)}ms\n`);

    console.log('⚡ Requests Per Second:');
    console.log(`   BEFORE: ${before.requestsPerSecond.toFixed(2)} req/s`);
    console.log(`   AFTER:  ${after.requestsPerSecond.toFixed(2)} req/s`);
    console.log(`   CHANGE: ${(after.requestsPerSecond - before.requestsPerSecond).toFixed(2)} req/s\n`);

    console.log('⏱️  Duration:');
    console.log(`   BEFORE: ${before.duration.toFixed(2)}s`);
    console.log(`   AFTER:  ${after.duration.toFixed(2)}s`);
    console.log(`   CHANGE: ${(after.duration - before.duration).toFixed(2)}s\n`);

    console.log('💡 Protection Effectiveness:');
    if (after.rateLimited > before.rateLimited) {
        console.log('   ✅ RATE LIMITING IS WORKING!');
        console.log(`   Protection blocked ${after.rateLimited - before.rateLimited} additional requests`);
        console.log(`   Server is ${after.rateLimitedRate.toFixed(2)}% protected from abuse`);
    } else {
        console.log('   ⚠️  NO IMPROVEMENT DETECTED');
        console.log('   Consider checking middleware configuration');
    }

    console.log('\n========================================\n');
}

// ================== CLI ==================
const mode = process.argv[2];

if (!mode || mode === 'help' || mode === '--help') {
    console.log(`
Compare Before/After DDoS Protection

Usage: node compare.js [mode]

Modes:
  before  - Test WITHOUT rate limiting protection
  after   - Test WITH rate limiting protection
  report  - Generate comparison report

Steps:
  1. Comment rate limiting middlewares in UserRoutes.js
  2. Run: node compare.js before
  3. Uncomment the middlewares
  4. Run: node compare.js after
  5. Run: node compare.js report
    `);
    process.exit(0);
}

if (mode === 'report') {
    generateReport();
} else if (mode === 'before' || mode === 'after') {
    runTest(mode).catch(err => {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    });
} else {
    console.error(`❌ Invalid mode: ${mode}`);
    console.log('Use: before, after, or report');
    process.exit(1);
}
