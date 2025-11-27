const express = require("express");
const {
  analyzeCreativePerformance,
  analyzeOffer,
  analyzeHooks,
} = require("./sensei-api.js");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, status: "sensei-active" });
});

// MAIN SENSEI API
router.post("/analyze", async (req, res) => {
  try {
    const { creatives, campaigns } = req.body;

    if (!Array.isArray(creatives)) {
      return res.status(400).json({
        success: false,
        error: "Invalid creatives array",
      });
    }

    const performance = analyzeCreativePerformance(creatives);
    const offer = analyzeOffer(campaigns || []);
    const hook = analyzeHooks(creatives);

    res.json({
      success: true,
      performance,
      offer,
      hook,
      recommendations: [
        ...performance.recommendations,
        ...offer.recommendations,
        ...hook.recommendations,
      ],
    });
  } catch (err) {
    console.error("Sensei error:", err);
    res.status(500).json({
      success: false,
      error: "Sensei failed",
      details: err.message,
    });
  }
});

module.exports = router;
