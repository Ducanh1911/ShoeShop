import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fileUpload from "express-fileupload";
import statusMonitor from "express-status-monitor";
import connectDatabase from "./config/MongoDB.js";
import ImportData from "./DataImport.js";
import { errorHandler, notFound } from "./Middleware/Errors.js";
import {
    globalApiLimiter,
    checkBlacklist,
    autoBlacklistAbusers,
    logSuspiciousActivity,
    getRateLimitStatus
} from "./Middleware/RateLimitMiddleware.js";
import categoryRouter from "./Routes/CategoryRoutes.js";
import orderRouter from "./Routes/OrderRoutes.js";
import productRouter from "./Routes/ProductRoutes.js";
import uploadRouter from "./Routes/UploadRoutes.js";
import userRouter from "./Routes/UserRoutes.js";

dotenv.config();
connectDatabase();
const app = express();

// ============================================
// SECURITY & MONITORING MIDDLEWARES
// ============================================
// Trust proxy - important for rate limiting by IP
app.set('trust proxy', 1);

// Server status monitoring dashboard
app.use(statusMonitor({
    title: 'ShoeShop Server Monitor',
    path: '/status',
    spans: [{
        interval: 1,
        retention: 60
    }],
    chartVisibility: {
        cpu: true,
        mem: true,
        load: true,
        responseTime: true,
        rps: true,
        statusCodes: true
    }
}));

// Apply security middlewares BEFORE other middlewares
app.use(checkBlacklist);              // Check if IP is blacklisted
app.use(logSuspiciousActivity);       // Log suspicious patterns
app.use(autoBlacklistAbusers);        // Auto-ban abusive IPs
app.use(globalApiLimiter);            // Global rate limiting

app.use(express.json());
app.use(cors());
app.use(
    fileUpload({
        useTempFiles: true,
    })
);

// API
app.use("/api/import", ImportData);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/users", userRouter);
app.use("/api/orders", orderRouter);
app.use("/api/upload", uploadRouter);
app.get("/api/config/paypal", (req, res) => {
    res.send(process.env.PAYPAL_CLIENT_ID);
});

// Rate limit status endpoint
app.get("/api/rate-limit/status", getRateLimitStatus);

// ERROR HANDLE
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 1000;

app.listen(PORT, console.log(`Server run in port ${PORT}`));
