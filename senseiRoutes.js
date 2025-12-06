// ============================================================
// Sensei API Routes - Fixed Version
// Added: Better error handling, Input validation
// ============================================================

const express = require('express');
const router = express.Router();
const {
  analyzeCreativePerformance,
  analyzeOffer,
  analyzeHooks
} = require('./sensei-api');

// ============================================================
// POST /api/sensei/analyze
// Main analysis endpoint supporting multiple modes
// ============================================================

router.post('/analyze', async (req, res, next) => {
  try {
    const { creatives, campaigns, mode } = req.body;
    
    // Validate input
    if (!mode || typeof mode !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid "mode" parameter. Expected: "creative", "offer", or "hook"'
      });
    }
    
    let result;
    
    switch (mode.toLowerCase()) {
      case 'creative':
      case 'performance':
        if (!Array.isArray(creatives)) {
          return res.status(400).json({
            ok: false,
            error: 'Mode "creative" requires "creatives" array'
          });
        }
        result = {
          performance: analyzeCreativePerformance(creatives),
          source: 'live',
          timestamp: new Date().toISOString()
        };
        break;
        
      case 'offer':
      case 'funnel':
        if (!Array.isArray(campaigns)) {
          return res.status(400).json({
            ok: false,
            error: 'Mode "offer" requires "campaigns" array'
          });
        }
        result = {
          offer: analyzeOffer(campaigns),
          source: 'live',
          timestamp: new Date().toISOString()
        };
        break;
        
      case 'hook':
      case 'hooks':
        if (!Array.isArray(creatives)) {
          return res.status(400).json({
            ok: false,
            error: 'Mode "hook" requires "creatives" array'
          });
        }
        result = {
          hook: analyzeHooks(creatives),
          source: 'live',
          timestamp: new Date().toISOString()
        };
        break;
        
      case 'full':
      case 'all':
        // Run all analyses
        result = {
          performance: Array.isArray(creatives) 
            ? analyzeCreativePerformance(creatives) 
            : null,
          offer: Array.isArray(campaigns) 
            ? analyzeOffer(campaigns) 
            : null,
          hook: Array.isArray(creatives) 
            ? analyzeHooks(creatives) 
            : null,
          source: 'live',
          timestamp: new Date().toISOString()
        };
        break;
        
      default:
        return res.status(400).json({
          ok: false,
          error: `Unknown mode: "${mode}". Valid modes: creative, offer, hook, full`
        });
    }
    
    return res.json({
      ok: true,
      data: result
    });
    
  } catch (err) {
    console.error('Error in /api/sensei/analyze:', err);
    next({
      statusCode: 500,
      message: 'Sensei analysis failed',
      details: err.message
    });
  }
});

// ============================================================
// GET /api/sensei/health
// Health check for Sensei engine
// ============================================================

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Sensei AI Engine',
    version: '2.0.0',
    modes: ['creative', 'offer', 'hook', 'full'],
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
