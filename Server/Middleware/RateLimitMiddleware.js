import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createClient } from 'redis';

// ============================================
// REDIS CLIENT FOR DISTRIBUTED RATE LIMITING
// ============================================
const redisClient = createClient({
    url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Error:', err));

// Connect Redis
try {
    await redisClient.connect();
    console.log('✅ Redis connected for rate limiting');
} catch (error) {
    console.log('⚠️  Redis not available, using memory store for rate limiting');
}

// ============================================
// 1. LOGIN RATE LIMITER - EXTREMELY STRICT
// ============================================
export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // Maximum 5 login attempts per 15 minutes
    skipSuccessfulRequests: true, // Don't count successful logins

    handler: (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        console.log(`🛡️  Rate limit exceeded for IP: ${ip} on ${req.path}`);

        res.status(429).json({
            error: 'Too many login attempts',
            message: 'You have exceeded the maximum number of login attempts. Please try again in 15 minutes.',
            retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            remainingAttempts: 0
        });
    },

    standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false     // Disable `X-RateLimit-*` headers
});

// ============================================
// 2. LOGIN SPEED LIMITER - GRADUAL SLOWDOWN
// ============================================
export const loginSpeedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    delayAfter: 3,              // Allow 3 requests per window without delay
    delayMs: () => 1000,        // Add 1 second delay per request after delayAfter
    maxDelayMs: 10000,          // Maximum delay of 10 seconds
    validate: { delayMs: false } // Disable warning
});

// ============================================
// 3. GLOBAL API RATE LIMITER
// ============================================
export const globalApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,   // 1 minute window
    max: 100,                   // Maximum 100 requests per minute per IP
    message: {
        error: 'Too many requests',
        message: 'You have exceeded the maximum number of requests. Please try again later.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================
// 4. STRICT API RATE LIMITER (for sensitive endpoints)
// ============================================
export const strictApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,                    // Only 30 requests per minute
    message: {
        error: 'Rate limit exceeded',
        message: 'This endpoint has strict rate limiting. Please slow down your requests.'
    }
});

// ============================================
// 5. IP BLACKLIST CHECKER
// ============================================
export const checkBlacklist = async (req, res, next) => {
    if (!redisClient.isOpen) {
        return next();
    }

    const ip = req.ip || req.connection.remoteAddress;

    try {
        const isBlacklisted = await redisClient.get(`blacklist:${ip}`);

        if (isBlacklisted) {
            console.log(`🚫 Blocked blacklisted IP: ${ip}`);
            return res.status(403).json({
                error: 'Access Denied',
                message: 'Your IP has been temporarily blocked due to suspicious activity',
                contact: 'support@shoeshop.com'
            });
        }
    } catch (error) {
        console.error('Error checking blacklist:', error);
    }

    next();
};

// ============================================
// 6. AUTO BLACKLIST ON REPEATED VIOLATIONS
// ============================================
export const autoBlacklistAbusers = async (req, res, next) => {
    if (!redisClient.isOpen) {
        return next();
    }

    const originalJson = res.json;

    res.json = function (data) {
        // If response is 429 (Too Many Requests), track violations
        if (res.statusCode === 429) {
            const ip = req.ip || req.connection.remoteAddress;

            redisClient.incr(`violations:${ip}`).then(async (violations) => {
                console.log(`⚠️  IP ${ip} has ${violations} rate limit violations`);

                // After 10 violations, ban IP for 1 hour
                if (violations >= 10) {
                    await redisClient.setEx(`blacklist:${ip}`, 3600, 'auto-banned');
                    console.log(`🚫 Auto-banned IP: ${ip} for 1 hour due to repeated violations`);
                }

                // Reset violation counter after 1 hour
                await redisClient.expire(`violations:${ip}`, 3600);
            }).catch(err => {
                console.error('Error tracking violations:', err);
            });
        }

        return originalJson.call(this, data);
    };

    next();
};

// ============================================
// 7. SUSPICIOUS ACTIVITY LOGGER
// ============================================
export const logSuspiciousActivity = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Detect suspicious patterns
    const suspiciousPatterns = [
        !userAgent,
        userAgent.toLowerCase().includes('bot'),
        userAgent.toLowerCase().includes('attack'),
        userAgent.toLowerCase().includes('scan'),
        userAgent.toLowerCase().includes('curl') && req.path.includes('login')
    ];

    if (suspiciousPatterns.some(pattern => pattern)) {
        console.log(`⚠️  Suspicious request from ${ip}:`);
        console.log(`   User-Agent: ${userAgent}`);
        console.log(`   Path: ${req.path}`);
        console.log(`   Method: ${req.method}`);

        // Log to Redis if available
        if (redisClient.isOpen) {
            const logEntry = JSON.stringify({
                ip,
                userAgent,
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString()
            });

            redisClient.lPush('suspicious_activity', logEntry).catch(err => {
                console.error('Error logging suspicious activity:', err);
            });

            // Keep only last 1000 entries
            redisClient.lTrim('suspicious_activity', 0, 999).catch(() => { });
        }
    }

    next();
};

// ============================================
// 8. RATE LIMIT STATUS ENDPOINT
// ============================================
export const getRateLimitStatus = async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    if (!redisClient.isOpen) {
        return res.json({
            ip,
            message: 'Rate limiting active (memory store)',
            redis: 'disconnected'
        });
    }

    try {
        const isBlacklisted = await redisClient.get(`blacklist:${ip}`);
        const violations = await redisClient.get(`violations:${ip}`) || 0;

        res.json({
            ip,
            blacklisted: !!isBlacklisted,
            violations: parseInt(violations),
            message: isBlacklisted
                ? 'Your IP is currently blacklisted'
                : 'Your IP is in good standing',
            redis: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error checking rate limit status',
            message: error.message
        });
    }
};

// Export Redis client for use in other modules
export { redisClient };

export default {
    loginRateLimiter,
    loginSpeedLimiter,
    globalApiLimiter,
    strictApiLimiter,
    checkBlacklist,
    autoBlacklistAbusers,
    logSuspiciousActivity,
    getRateLimitStatus,
    redisClient
};
