import express from "express";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import User from "../Models/UserModel.js";
import generateToken from "../utils/generateToken.js";

const userRouter = express.Router();

// ===============================
// ✅ Redis client
// ===============================
const redisClient = createClient({
    url: "redis://localhost:6379",
});

redisClient.on("error", (err) => console.log("Redis Error:", err));
await redisClient.connect();

const blacklistToken = async (token, expiresInSec) => {
    await redisClient.set(`bl_${token}`, "1", { EX: expiresInSec });
};

const isTokenBlacklisted = async (token) => {
    const result = await redisClient.get(`bl_${token}`);
    return result === "1";
};

// ===============================
// ✅ Middleware protect
// ===============================
const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        token = req.headers.authorization.split(" ")[1];

        // ✅ Check Redis blacklist
        if (await isTokenBlacklisted(token)) {
            res.status(401);
            throw new Error("Token revoked. Please login again.");
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            return next();
        } catch (error) {
            res.status(401);
            throw new Error("Not authorized, token failed");
        }
    }

    if (!token) {
        res.status(401);
        throw new Error("Not authorized, no token");
    }
});

// ===============================
// ✅ Middleware admin
// ===============================
const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) next();
    else {
        res.status(401);
        throw new Error("Not authorized as admin");
    }
};

// ===============================
// ✅ Login
// ===============================
userRouter.post(
    "/login",
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                token: generateToken(user._id),
                createdAt: user.createdAt,
            });
        } else {
            res.status(401);
            throw new Error("Invalid Email or Password");
        }
    })
);

// ===============================
// ✅ Register
// ===============================
userRouter.post(
    "/",
    asyncHandler(async (req, res) => {
        const { name, email, password } = req.body;
        const userExists = await User.findOne({ email });

        if (userExists) {
            res.status(400);
            throw new Error("User already exists");
        }

        const user = await User.create({ name, email, password });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                token: generateToken(user._id),
            });
        } else {
            res.status(400);
            throw new Error("Invalid User Data");
        }
    })
);

// ===============================
// ✅ Profile
// ===============================
userRouter.get(
    "/profile",
    protect,
    asyncHandler(async (req, res) => {
        const user = await User.findById(req.user._id);
        if (user) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt,
            });
        } else {
            res.status(404);
            throw new Error("User not found");
        }
    })
);

// ===============================
// ✅ Update profile
// ===============================
userRouter.put(
    "/profile",
    protect,
    asyncHandler(async (req, res) => {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            if (req.body.password) user.password = req.body.password;

            const updateUser = await user.save();
            res.json({
                _id: updateUser._id,
                name: updateUser.name,
                email: updateUser.email,
                isAdmin: updateUser.isAdmin,
                createdAt: updateUser.createdAt,
                token: generateToken(updateUser._id),
            });
        } else {
            res.status(404);
            throw new Error("User not found");
        }
    })
);

// ===============================
// ✅ Admin: Get all users
// ===============================
userRouter.get(
    "/",
    protect,
    admin,
    asyncHandler(async (req, res) => {
        const users = await User.find({});
        res.json(users);
    })
);

// ===============================
// ✅ LOGOUT — lưu token vào Redis Blacklist
// ===============================
userRouter.post(
    "/logout",
    protect,
    asyncHandler(async (req, res) => {
        const token = req.headers.authorization.split(" ")[1];

        // Decode token để lấy thời gian hết hạn
        const decoded = jwt.decode(token);
        const expireAt = decoded.exp * 1000;
        const now = Date.now();
        const ttlSeconds = Math.floor((expireAt - now) / 1000);

        if (ttlSeconds > 0) {
            await blacklistToken(token, ttlSeconds);
        }
        res.json({ message: "Logout successful" });
    })
);

export default userRouter;