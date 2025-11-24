// server.js (CommonJS)

const express = require("express");
const cors = require("cors");

const metaRoutes = require("./metaRoutes");
const senseiRoutes = require("./senseiRoutes");

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "10mb" }));

// ---------- ROUTES ----------
app.use("/api/meta", metaRoutes);
app.use("/api/sensei", senseiRoutes);

// ---------- ROOT ----------
app.get("/", (req, res) => {
  res.send("SignalOne Backend running ✔");
});

// ---------- SERVER ----------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
