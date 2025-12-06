// ============================================================
// senseiRoutes.js - FIXED
// ============================================================

const express = require('express');

// ✅ KORRIGIERTER PFAD!
const { 
  analyzeCreativePerformance, 
  analyzeOffer, 
  analyzeHooks 
} = require('./api/sensei/analyze/sensei-api');

const router = express.Router();

// HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    status: 'sensei-module-active' 
  });
});

// MAIN ANALYSIS ENDPOINT
// POST /api/sensei/analyze
// Body: { creatives: [...], campaigns?: [...] }
router.post('/analyze', async (req, res) => {
  try {
    const { creatives, campaigns } = req.body;
    
    if (!Array.isArray(creatives) || !creatives.length) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid creatives array'
      });
    }
    
    const performance = analyzeCreativePerformance(creatives);
    const offer = analyzeOffer(campaigns);
    const hook = analyzeHooks(creatives);
    
    res.json({
      success: true,
      performance,
      offer,
      hook,
      recommendations: [
        ...performance.recommendations,
        ...hook.recommendations,
        ...offer.recommendations
      ]
    });
    
  } catch (err) {
    console.error('Sensei error:', err);
    res.status(500).json({
      success: false,
      error: 'Sensei processing failed',
      details: err.message || String(err)
    });
  }
});

module.exports = router;
