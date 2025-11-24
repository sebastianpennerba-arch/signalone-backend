// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Import metaRoutes (CommonJS)
const metaRoutes = require("./metaRoutes");
const senseiRoutes = require("./senseiRoutes");
const app = express();

// =======================
// Middleware
// =======================
app.use("/api/sensei", senseiRoutes);
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// =======================
// Health Check Route
// =======================

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "SignalOne Meta Backend",
    version: "3.0.0",
    message: "Backend läuft und akzeptiert alle Live Meta Routes.",
    timestamp: new Date().toISOString()
  });
});

// =======================
// API Routes
// =======================

app.use("/api/meta", metaRoutes);

// =======================
// Server Start
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 SignalOne Backend gestartet auf Port ${PORT}`);
});
