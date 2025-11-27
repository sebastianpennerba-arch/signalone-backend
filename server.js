// server.js – SignalOne Backend (Render)

const express = require("express");
const cors = require("cors");
const metaRoutes = require("./metaRoutes");
const senseiRoutes = require("./senseiRoutes");

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Healthcheck Root ---
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "SignalOne Backend",
    timestamp: new Date().toISOString(),
  });
});

// --- API Routen ---
app.use("/api/meta", metaRoutes);
app.use("/api/sensei", senseiRoutes);

// --- Fallback 404 für unbekannte Routen ---
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    path: req.originalUrl,
  });
});

// --- Start ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`SignalOne Backend läuft auf Port ${port}`);
});
