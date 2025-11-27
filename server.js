require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Case-sensitiver FIX
const metaRoutes = require("./metaRoutes.js");
const senseiRoutes = require("./senseiRoutes.js");

const app = express();

app.use(cors());
app.use(express.json());

// HEALTHCHECK
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "SignalOne Backend",
    timestamp: new Date().toISOString(),
  });
});

// ROUTES
app.use("/api/meta", metaRoutes);
app.use("/api/sensei", senseiRoutes);

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend läuft auf Port ${PORT}`);
});
