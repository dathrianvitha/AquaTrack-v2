import express from "express";
import cors from "cors";

import router from "./routes/index.routes.js";

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.CLIENT_URL
]
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ""));

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without an Origin header
            // (curl, Postman, server-to-server requests, etc.)
            if (!origin) {
                return callback(null, true);
            }

            const cleanOrigin = origin.replace(/\/$/, "");

            // Allow localhost / 127.0.0.1 / IPv6 localhost
            // on any development port.
            const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(
                cleanOrigin
            );

            if (isLocal || allowedOrigins.includes(cleanOrigin)) {
                return callback(null, true);
            }

            return callback(null, false);
        },
        credentials: true
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(
        `👉 ${req.method} ${req.url} | Origin: ${req.headers.origin || "none"}`
    );

    if (req.url.includes("/auth/login")) {
        console.log("👉 Login Body:", JSON.stringify(req.body));
    }

    next();
});

app.use("/api", router);

app.use((err, req, res, next) => {
    console.error("Global Error:", err.message || err);

    return res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

export default app;