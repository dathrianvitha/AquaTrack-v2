
























































































































import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

// Fast in-memory user cache (60s TTL) to prevent hammering Supabase connection pool on concurrent requests
const userCache = new Map();
const USER_CACHE_TTL = 60 * 1000;

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided."
            });
        }

        const token = authHeader.split(" ")[1];

        let decoded;
        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (jwtErr) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token."
            });
        }

        const now = Date.now();
        const cached = userCache.get(decoded.userId);
        if (cached && (now - cached.timestamp < USER_CACHE_TTL)) {
            req.user = cached.user;
            return next();
        }

        let user;
        try {
            user = await prisma.user.findUnique({
                where: {
                    id: decoded.userId
                },
                select: {
                    id: true,
                    fullName: true,
                    mobile: true,
                    email: true
                }
            });
        } catch (dbErr) {
            // If transient network error and we have stale cached user, allow request
            if (cached?.user) {
                console.warn("DB connection glitch, using cached user session for:", decoded.userId);
                req.user = cached.user;
                return next();
            }
            throw dbErr;
        }

        if (!user) {
            userCache.delete(decoded.userId);
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        userCache.set(decoded.userId, { user, timestamp: now });
        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({
            success: false,
            message: "Authentication service error: " + error.message
        });
    }
};

export default auth;