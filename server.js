// server.js
import express from "express";
import cors from "cors";
import metaRoutes from "./metaRoutes.js";
import senseiRoutes from "./senseiRoutes.js";

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
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
  console.log(`SignalOne Backend running on port ${PORT}`);
});
