const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors")

const app = express();

app.set("trust proxy", 1);

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: ["https://ai-prep-ten.vercel.app", "http://localhost:5173"],
    credentials: true
}))

// Debug middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log("Origin:", req.headers.origin);
    console.log("Cookies received:", req.cookies ? Object.keys(req.cookies) : "none");
    next();
})

const authRouter = require("./routes/auth.routes");
const interviewRouter = require("./routes/interview.routes")

app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

module.exports = app; 