// 1) Environment Variablen laden (.env auf Render)
require("dotenv").config();

// 2) Dependencies
const express = require("express");
const cors = require("cors");

// 3) Routen einbinden
const metaRoutes = require("./metaRoutes");
const senseiRoutes = require("./senseiRoutes");

// 4) Express App
const app = express();

// 5) Middleware
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json());

// 6) Health Check
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        service: "SignalOne Meta Backend",
        version: "3.0.0",
        message: "Backend läuft und akzeptiert Meta & Sensei Module.",
        timestamp: new Date().toISOString(),
    });
});

// 7) API-Routen
app.use("/api/meta", metaRoutes);
app.use("/api/sensei", senseiRoutes);

// 8) Serverstart
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 SignalOne Backend gestartet auf Port ${PORT}`);
});
