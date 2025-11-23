// server.js
// Minimaler Express-Server für Meta OAuth Token-Exchange

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const metaRoutes = require("./metaRoutes");

const app = express();

// --- Middleware ---
app.use(cors());              // erstmal offen lassen
app.use(express.json());      // JSON-Body parsen

// --- Healthcheck ---
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "SignalOne Meta Backend",
    version: "1.0.0"
  });
});

// --- Meta API Routen ---
// Ergebnis: https://DEIN-BACKEND.onrender.com/api/meta/oauth/token
app.use("/api/meta", metaRoutes);

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SignalOne Meta Backend läuft auf Port ${PORT}`);
});
