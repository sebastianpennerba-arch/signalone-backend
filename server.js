require("dotenv").config();

const express = require("express");
const cors = require("cors");
const metaRoutes = require("./metaRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "SignalOne Meta Backend",
    version: "2.0.0",
    message: "Backend läuft und akzeptiert neue metaRoutes.js!"
  });
});

app.use("/api/meta", metaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Backend gestartet auf Port " + PORT);
});
