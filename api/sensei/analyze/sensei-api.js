// ============================================================
// Sensei AI Engine - Creative, Offer & Hook Analysis
// Fixed: Modular structure, Better error handling, Edge cases
// ============================================================

// ============================================================
// CONSTANTS & THRESHOLDS
// ============================================================

const THRESHOLDS = {
  WINNER_SCORE: 80,
  STRONG_SCORE: 65,
  UNDER_REVIEW_SCORE: 55,
  LOSER_SCORE: 40,
  HIGH_ROAS_MULTIPLIER: 1.4,
  LOW_ROAS_MULTIPLIER: 0.7,
  HIGH_SPEND_THRESHOLD: 0.03,
  LOW_SPEND_THRESHOLD: 0.02,
  TESTING_SPEND_THRESHOLD: 0.01,
  FATIGUE_ROAS_DROP: 0.7,
  MIN_CREATIVES_FOR_ANALYSIS: 1,
  WINSORIZE_PERCENTILE: 0.95 // Top 5% outliers
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeDivide(num, den, fallback = 0) {
  const n = toNumber(num, 0);
  const d = toNumber(den, 0);
  if (!d) return fallback;
  return n / d;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percentChange(current, previous) {
  const c = toNumber(current, 0);
  const p = toNumber(previous, 0);
  if (!p) return 0;
  return ((c - p) / p) * 100;
}

/**
 * Compute Mean and Standard Deviation
 * Handles edge case: single value (std = 0)
 */
function computeMeanStd(values) {
  const clean = values
    .map(v => toNumber(v, 0))
    .filter(v => Number.isFinite(v));
  
  if (!clean.length) {
    return { mean: 0, std: 0 };
  }
  
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  
  // Edge case: only one value
  if (clean.length === 1) {
    return { mean, std: 0 };
  }
  
  const variance = clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / 
                   Math.max(clean.length - 1, 1);
  
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Z-Score calculation
 * Handles edge case: std = 0
 */
function zScore(value, mean, std) {
  if (!std || std === 0) return 0; // No variance = all values equal
  return (toNumber(value, 0) - mean) / std;
}

/**
 * Winsorize values to remove extreme outliers
 * Caps values at 95th percentile
 */
function winsorize(values, percentile = THRESHOLDS.WINSORIZE_PERCENTILE) {
  if (!values.length) return values;
  
  const sorted = [...values].sort((a, b) => a - b);
  const capIndex = Math.floor(sorted.length * percentile);
  const cap = sorted[capIndex];
  
  return values.map(v => Math.min(v, cap));
}

// ============================================================
// METRIC EXTRACTION
// ============================================================

/**
 * Flexible metric extraction supporting multiple API formats
 * Handles Meta Insights, Demo data, and custom formats
 */
function extractMetrics(entity) {
  const m = entity.metrics || entity.metric || entity.insights || {};
  
  // Spend
  const spend = toNumber(m.spend || m.spend_eur || entity.spend, 0);
  
  // Revenue
  let revenue = toNumber(
    m.revenue || m.purchase_value || m.value || entity.revenue,
    0
  );
  
  // ROAS - Handle Meta's array format
  let roas = toNumber(m.roas || m.return_on_ad_spend, 0);
  
  if (!roas && Array.isArray(m.website_purchase_roas) && m.website_purchase_roas[0]) {
    roas = toNumber(m.website_purchase_roas[0].value);
  }
  
  if (!roas && spend && revenue) {
    roas = revenue / spend;
  }
  
  // Other metrics
  const impressions = toNumber(m.impressions, 0);
  const clicks = toNumber(m.clicks, 0);
  const ctr = toNumber(m.ctr, impressions ? (clicks / impressions) * 100 : 0);
  const cpm = toNumber(m.cpm, impressions ? (spend / impressions) * 1000 : 0);
  const purchases = toNumber(m.purchases || m.purchase || m.conversions, 0);
  const cpa = purchases ? spend / purchases : 0;
  
  // Previous period metrics (for trend analysis)
  const roasPrev = toNumber(m.roas_prev || m.roas_prev_7d, 0);
  const ctrPrev = toNumber(m.ctr_prev || m.ctr_prev_7d, 0);
  
  // Recalculate revenue if missing
  if (!revenue && roas && spend) {
    revenue = roas * spend;
  }
  
  return {
    spend,
    revenue,
    roas,
    roasPrev,
    ctr,
    ctrPrev,
    cpm,
    impressions,
    clicks,
    purchases,
    cpa
  };
}

// ============================================================
// HOOK NORMALIZATION
// ============================================================

/**
 * Normalize hook labels for clustering
 * Could be enhanced with NLP/LLM in future
 */
function normalizeHookLabel(rawHook = '', name = '') {
  const src = (rawHook || name || '').toLowerCase();
  
  if (!src.trim()) return 'unknown';
  
  // Pattern matching (simple heuristics)
  if (src.includes('problem') || src.includes('solution')) return 'Problem/Solution';
  if (src.includes('testimonial') || src.includes('review')) return 'Testimonial';
  if (src.includes('before') || src.includes('after')) return 'Before/After';
  if (src.includes('ugc')) return 'UGC';
  if (src.includes('static') || src.includes('image')) return 'Static';
  if (src.includes('direct') || src.includes('cta')) return 'Direct CTA';
  
  // Fallback: first token
  const tokens = (rawHook || name)
    .split(/[-_\s]+/g)
    .map(t => t.trim())
    .filter(Boolean);
  
  return tokens[0] || 'unknown';
}

// ============================================================
// CREATIVE AGGREGATION & SCORING
// ============================================================

function summarizeCreatives(creatives) {
  const canonical = creatives.map(c => {
    const metrics = extractMetrics(c);
    const hookLabel = normalizeHookLabel(c.hook, c.name);
    const creator = c.creator || c.creator_name || c.author || null;
    
    return {
      id: c.id || c.ad_id || c.creative_id || String(Math.random()),
      name: c.name || c.title || 'Unnamed Creative',
      status: c.status || (c.isActive ? 'ACTIVE' : 'UNKNOWN'),
      hookLabel,
      creator,
      metrics,
      raw: c
    };
  });
  
  let totalSpend = 0;
  let totalRevenue = 0;
  const roasValues = [];
  const ctrValues = [];
  const cpmValues = [];
  const spendValues = [];
  
  canonical.forEach(c => {
    const { spend, revenue, roas, ctr, cpm } = c.metrics;
    totalSpend += spend;
    totalRevenue += revenue;
    roasValues.push(roas);
    ctrValues.push(ctr);
    cpmValues.push(cpm);
    spendValues.push(spend);
  });
  
  // Winsorize to remove extreme outliers
  const winsorizedRoas = winsorize(roasValues);
  const winsorizedCtr = winsorize(ctrValues);
  const winsorizedCpm = winsorize(cpmValues);
  
  const roasStats = computeMeanStd(winsorizedRoas);
  const ctrStats = computeMeanStd(winsorizedCtr);
  const cpmStats = computeMeanStd(winsorizedCpm);
  const spendStats = computeMeanStd(spendValues);
  
  const avgRoas = roasStats.mean;
  const avgCtr = ctrStats.mean;
  const avgCpm = cpmStats.mean;
  
  return {
    canonical,
    aggregates: {
      totalCreatives: canonical.length,
      totalSpend,
      totalRevenue,
      avgRoas,
      avgCtr,
      avgCpm,
      roasStats,
      ctrStats,
      cpmStats,
      spendStats
    }
  };
}

function scoreCreative(entry, aggregates) {
  const { metrics, status } = entry;
  const { roas, roasPrev, ctr, ctrPrev, cpm, spend, purchases } = metrics;
  const { 
    avgRoas, avgCtr, avgCpm, 
    roasStats, ctrStats, cpmStats, spendStats, 
    totalSpend 
  } = aggregates;
  
  // Z-Scores for relative performance
  const zRoas = zScore(roas, roasStats.mean, roasStats.std);
  const zCtr = zScore(ctr, ctrStats.mean, ctrStats.std);
  const zCpm = -zScore(cpm, cpmStats.mean, cpmStats.std); // Lower CPM = better
  const zSpend = zScore(spend, spendStats.mean, spendStats.std);
  
  // Momentum based on ROAS/CTR change
  const roasDelta = percentChange(roas, roasPrev);
  const ctrDelta = percentChange(ctr, ctrPrev);
  const momentum = (clamp(roasDelta / 20, -2, 2) * 0.6) + 
                   (clamp(ctrDelta / 20, -2, 2) * 0.4);
  
  // Base score calculation (weighted)
  let score = 50 + 
              (zRoas * 12) + 
              (zCtr * 8) + 
              (zCpm * 6) + 
              (zSpend * 4) + 
              (momentum * 3);
  
  // Bonuses & Penalties
  if (roas > avgRoas * THRESHOLDS.HIGH_ROAS_MULTIPLIER && 
      spend > totalSpend * THRESHOLDS.HIGH_SPEND_THRESHOLD) {
    score += 6; // Clear winner bonus
  }
  
  if (roas < avgRoas * THRESHOLDS.LOW_ROAS_MULTIPLIER && 
      spend > totalSpend * THRESHOLDS.LOW_SPEND_THRESHOLD) {
    score -= 8; // Underperformer penalty
  }
  
  if (purchases === 0 && spend > totalSpend * THRESHOLDS.TESTING_SPEND_THRESHOLD) {
    score -= 10; // No conversions penalty
  }
  
  // Clamp final score
  score = clamp(Math.round(score), 0, 100);
  
  // Label assignment
  let label = 'Neutral';
  if (score >= THRESHOLDS.WINNER_SCORE) label = 'Winner';
  else if (score >= THRESHOLDS.STRONG_SCORE) label = 'Strong';
  else if (score <= THRESHOLDS.LOSER_SCORE) label = 'Loser';
  else if (score <= THRESHOLDS.UNDER_REVIEW_SCORE) label = 'Under Review';
  
  // Testing flag
  const isTesting = spend < Math.max(spendStats.mean * 0.6, totalSpend * THRESHOLDS.TESTING_SPEND_THRESHOLD) && 
                    status === 'ACTIVE';
  
  if (isTesting) {
    label = `${label} (Testing)`;
  }
  
  // Fatigue detection
  const fatigue = roasPrev > 0 && 
                  roas < roasPrev * THRESHOLDS.FATIGUE_ROAS_DROP && 
                  spend > totalSpend * THRESHOLDS.LOW_SPEND_THRESHOLD;
  
  // Reasoning
  const reasoning = [];
  
  if (roasPrev && Math.abs(roasDelta) > 10) {
    reasoning.push(
      roasDelta < 0 
        ? `ROAS -${Math.abs(roasDelta).toFixed(1)}% vs. previous period`
        : `ROAS +${roasDelta.toFixed(1)}% vs. previous period`
    );
  }
  
  if (ctrPrev && Math.abs(ctrDelta) > 8) {
    reasoning.push(
      ctrDelta < 0
        ? `CTR -${Math.abs(ctrDelta).toFixed(1)}% (Hook losing effectiveness)`
        : `CTR +${ctrDelta.toFixed(1)}% (Hook gaining traction)`
    );
  }
  
  if (fatigue) {
    reasoning.push('Ad Fatigue suspected: ROAS dropping despite spend');
  }
  
  if (!reasoning.length) {
    if (roas > avgRoas * 1.2) {
      reasoning.push('Above-average ROAS');
    } else if (roas < avgRoas * 0.8) {
      reasoning.push('Below-average ROAS');
    }
  }
  
  return {
    ...entry,
    score,
    label,
    isTesting,
    fatigue,
    roasDelta,
    ctrDelta,
    reasoning
  };
}

function segmentCreatives(scored, aggregates) {
  const winners = [];
  const losers = [];
  const testing = [];
  const potentials = [];
  
  scored.forEach(c => {
    const { score, label, isTesting } = c;
    
    if (label.includes('Winner') && score >= THRESHOLDS.WINNER_SCORE && !isTesting) {
      winners.push(c);
    } else if (label.includes('Loser') && score <= THRESHOLDS.LOSER_SCORE) {
      losers.push(c);
    } else if (isTesting || label.includes('Testing')) {
      testing.push(c);
    } else {
      potentials.push(c);
    }
  });
  
  winners.sort((a, b) => b.score - a.score);
  losers.sort((a, b) => a.score - b.score);
  testing.sort((a, b) => b.metrics.spend - a.metrics.spend);
  potentials.sort((a, b) => b.score - a.score);
  
  return { winners, losers, testing, potentials };
}

function buildCreativeRecommendations(aggregates, segments) {
  const { winners, losers, testing } = segments;
  const recs = [];
  const totalSpend = aggregates.totalSpend || 0;
  const accountRoas = aggregates.avgRoas || 0;
  
  // Budget Shift Recommendation
  if (winners.length && losers.length && totalSpend > 0) {
    const top = winners.slice(0, 3);
    const worst = losers.slice(0, 3);
    const loserSpend = worst.reduce((sum, c) => sum + c.metrics.spend, 0);
    const topSpend = top.reduce((sum, c) => sum + c.metrics.spend, 0) + 1;
    const weightedWinnerRoas = top.reduce((sum, c) => sum + (c.metrics.roas * c.metrics.spend), 0) / topSpend;
    const upliftRoas = Math.max(weightedWinnerRoas - accountRoas, 0);
    const estExtraRevenue = loserSpend * upliftRoas;
    
    recs.push({
      type: 'budget_shift',
      priority: 'high',
      title: 'Shift budget from losers to winners',
      message: 'Reduce spend on underperforming creatives and reallocate to top performers.',
      details: {
        fromCreatives: worst.map(c => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          spend: c.metrics.spend
        })),
        toCreatives: top.map(c => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          spend: c.metrics.spend
        })),
        loserSpend,
        estimatedDailyRevenueUplift: Math.round(estExtraRevenue)
      }
    });
  }
  
  // Testing Opportunities
  if (testing.length) {
    const topTesting = testing.slice(0, 5).map(c => ({
      id: c.id,
      name: c.name,
      roas: c.metrics.roas,
      spend: c.metrics.spend
    }));
    
    recs.push({
      type: 'testing',
      priority: 'medium',
      title: 'Evaluate testing creatives',
      message: 'Some creatives show early signals. Give them structured budget and timeline.',
      details: {
        candidates: topTesting,
        suggestion: 'Test for 2-3 days with fixed daily budget, then decide based on ROAS/CPA.'
      }
    });
  }
  
  // Fatigue Alert
  const fatigued = winners.filter(c => c.fatigue);
  if (fatigued.length) {
    recs.push({
      type: 'fatigue',
      priority: 'high',
      title: 'Ad fatigue detected - build variants',
      message: 'Winner creatives losing performance. Replace before account crashes.',
      details: {
        creatives: fatigued.map(c => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          roasDelta: c.roasDelta,
          spend: c.metrics.spend
        })),
        suggestion: 'Create 2-3 variants with same angle/hook but new visuals, music, or text overlay.'
      }
    });
  }
  
  // Generic fallback
  if (!recs.length) {
    recs.push({
      type: 'generic',
      priority: 'low',
      title: 'Account stable - focus on new tests',
      message: 'No major issues detected. Use testing budget to find new hooks and creators.',
      details: {}
    });
  }
  
  return recs;
}

// ============================================================
// PUBLIC API: CREATIVE PERFORMANCE
// ============================================================

function analyzeCreativePerformance(creatives) {
  const { canonical, aggregates } = summarizeCreatives(creatives);
  
  if (!canonical.length) {
    return {
      summary: {
        totalCreatives: 0,
        totalSpend: 0,
        totalRevenue: 0,
        avgRoas: 0
      },
      scoring: [],
      winners: [],
      losers: [],
      testing: [],
      recommendations: [{
        type: 'no_data',
        priority: 'low',
        title: 'No creatives provided',
        message: 'Analysis requires at least one creative with metrics.',
        details: {}
      }]
    };
  }
  
  const scored = canonical.map(entry => scoreCreative(entry, aggregates));
  const segments = segmentCreatives(scored, aggregates);
  const recommendations = buildCreativeRecommendations(aggregates, segments);
  
  return {
    summary: {
      totalCreatives: aggregates.totalCreatives,
      totalSpend: aggregates.totalSpend,
      totalRevenue: aggregates.totalRevenue,
      avgRoas: aggregates.avgRoas,
      avgCtr: aggregates.avgCtr,
      avgCpm: aggregates.avgCpm
    },
    scoring: scored,
    winners: segments.winners,
    losers: segments.losers,
    testing: segments.testing,
    recommendations
  };
}

// ============================================================
// PUBLIC API: OFFER/FUNNEL ANALYSIS
// ============================================================

function analyzeOffer(campaigns) {
  if (!Array.isArray(campaigns) || !campaigns.length) {
    return {
      summary: {
        totalCampaigns: 0,
        avgRoas: 0
      },
      campaigns: [],
      recommendations: [{
        type: 'no_data',
        priority: 'low',
        title: 'No campaigns provided',
        message: 'Offer/Funnel analysis requires at least one campaign with spend/ROAS.',
        details: {}
      }]
    };
  }
  
  const normalized = campaigns.map(c => {
    const metrics = extractMetrics(c);
    return {
      id: c.id || c.campaign_id || String(Math.random()),
      name: c.name || 'Unnamed Campaign',
      objective: c.objective || c.campaign_objective || 'UNKNOWN',
      status: c.status || 'UNKNOWN',
      metrics,
      raw: c
    };
  });
  
  const aggregates = summarizeCreatives(normalized);
  const avgRoas = aggregates.aggregates.avgRoas || 0;
  const avgCtr = aggregates.aggregates.avgCtr || 0;
  const avgCpm = aggregates.aggregates.avgCpm || 0;
  
  const enriched = normalized.map(c => {
    const { roas, ctr, cpm, spend } = c.metrics;
    let funnelType = 'balanced';
    
    if (ctr > avgCtr * 1.1 && roas < avgRoas * 0.8) {
      funnelType = 'offer_issue'; // Good clicks, bad sales
    } else if (ctr < avgCtr * 0.8 && roas < avgRoas * 0.9) {
      funnelType = 'creative_issue'; // Bad clicks, bad sales
    } else if (cpm > avgCpm * 1.2) {
      funnelType = 'targeting_issue'; // Expensive traffic
    }
    
    return {
      ...c,
      funnelType,
      roasDeltaVsAvg: percentChange(roas, avgRoas),
      spendShare: aggregates.aggregates.totalSpend 
        ? (spend / aggregates.aggregates.totalSpend) * 100 
        : 0
    };
  });
  
  const offerProblems = enriched.filter(c => c.funnelType === 'offer_issue');
  const creativeProblems = enriched.filter(c => c.funnelType === 'creative_issue');
  const targetingProblems = enriched.filter(c => c.funnelType === 'targeting_issue');
  
  const recs = [];
  
  if (offerProblems.length) {
    recs.push({
      type: 'offer',
      priority: 'high',
      title: 'High CTR, low ROAS - Check offer/funnel',
      message: 'Campaigns with good CTR but weak ROAS indicate issues in offer, landing page, or checkout.',
      details: {
        campaigns: offerProblems.map(c => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          ctr: c.metrics.ctr,
          spend: c.metrics.spend
        })),
        checklist: [
          'Landing page conversion (Add-to-Cart → Purchase)',
          'Offer communication (Price, bundles, scarcity, social proof)',
          'Pixel events and tracking setup',
          'Mobile page speed'
        ]
      }
    });
  }
  
  if (creativeProblems.length) {
    recs.push({
      type: 'creative',
      priority: 'medium',
      title: 'Campaigns with creative issues identified',
      message: 'Low CTR and low ROAS suggest uninteresting creatives/angles.',
      details: {
        campaigns: creativeProblems.map(c => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          ctr: c.metrics.ctr,
          spend: c.metrics.spend
        })),
        suggestion: 'Use Sensei to find better hooks (UGC, Problem/Solution vs static banners).'
      }
    });
  }
  
  if (targetingProblems.length) {
    recs.push({
      type: 'targeting',
      priority: 'medium',
      title: 'High CPM - Optimize targeting/placements',
      message: 'Some campaigns buying reach at high CPMs. Review audiences, placements, and bidding.',
      details: {
        campaigns: targetingProblems.map(c => ({
          id: c.id,
          name: c.name,
          cpm: c.metrics.cpm,
          roas: c.metrics.roas,
          spend: c.metrics.spend
        })),
        checklist: [
          'Test placements (Reels vs Feed)',
          'Compare Broad vs Interest targeting',
          'Check Frequency & Audience Overlap',
          'Test bidding strategy (Lowest Cost vs Cost Cap)'
        ]
      }
    });
  }
  
  if (!recs.length) {
    recs.push({
      type: 'funnel_ok',
      priority: 'low',
      title: 'Funnel looks healthy overall',
      message: 'No major funnel bottlenecks detected. Focus on creative testing and scaling.',
      details: {}
    });
  }
  
  return {
    summary: {
      totalCampaigns: enriched.length,
      avgRoas,
      avgCtr,
      avgCpm,
      totalSpend: aggregates.aggregates.totalSpend,
      totalRevenue: aggregates.aggregates.totalRevenue
    },
    campaigns: enriched,
    recommendations: recs
  };
}

// ============================================================
// PUBLIC API: HOOK/STORY ANALYSIS
// ============================================================

function analyzeHooks(creatives) {
  if (!Array.isArray(creatives) || !creatives.length) {
    return {
      summary: {
        hookCount: 0,
        totalCreatives: 0
      },
      hooks: [],
      recommendations: [{
        type: 'no_data',
        priority: 'low',
        title: 'No creatives for hook analysis',
        message: 'Hook analysis requires creatives with names or hook labels.',
        details: {}
      }]
    };
  }
  
  const { canonical, aggregates } = summarizeCreatives(creatives);
  
  const hookMap = new Map();
  
  canonical.forEach(c => {
    const label = normalizeHookLabel(c.raw.hook, c.name);
    const metrics = extractMetrics(c.raw);
    
    if (!hookMap.has(label)) {
      hookMap.set(label, {
        label,
        creatives: [],
        totalSpend: 0,
        totalRevenue: 0,
        weightedRoasSum: 0
      });
    }
    
    const bucket = hookMap.get(label);
    bucket.creatives.push({
      id: c.id,
      name: c.name,
      metrics
    });
    bucket.totalSpend += metrics.spend;
    bucket.totalRevenue += metrics.revenue;
    bucket.weightedRoasSum += metrics.roas * metrics.spend;
  });
  
  const hooks = Array.from(hookMap.values()).map(h => {
    const avgRoas = h.totalSpend ? h.weightedRoasSum / h.totalSpend : 0;
    return {
      label: h.label,
      creatives: h.creatives,
      totalSpend: h.totalSpend,
      totalRevenue: h.totalRevenue,
      avgRoas,
      shareOfSpend: aggregates.totalSpend 
        ? (h.totalSpend / aggregates.totalSpend) * 100 
        : 0
    };
  });
  
  hooks.sort((a, b) => b.avgRoas - a.avgRoas);
  
  const top = hooks.slice(0, 3);
  const bottom = hooks.slice(-3);
  
  const recs = [];
  
  if (top.length) {
    recs.push({
      type: 'hook_winners',
      priority: 'high',
      title: 'Top hooks identified',
      message: 'These hook formats beat your account average significantly. Produce more creatives in this style.',
      details: {
        hooks: top.map(h => ({
          label: h.label,
          avgRoas: h.avgRoas,
          shareOfSpend: h.shareOfSpend,
          totalSpend: h.totalSpend
        }))
      }
    });
  }
  
  if (bottom.length && hooks.length > 3) {
    recs.push({
      type: 'hook_losers',
      priority: 'medium',
      title: 'Weak hook formats - reduce spend',
      message: 'Some hook clusters clearly below account ROAS. Consider reducing budget or pausing.',
      details: {
        hooks: bottom.map(h => ({
          label: h.label,
          avgRoas: h.avgRoas,
          shareOfSpend: h.shareOfSpend,
          totalSpend: h.totalSpend
        }))
      }
    });
  }
  
  if (!recs.length) {
    recs.push({
      type: 'hook_balanced',
      priority: 'low',
      title: 'Hook performance stable',
      message: 'Hook clusters relatively close together. Use creative experiments to find new winners.',
      details: {}
    });
  }
  
  return {
    summary: {
      hookCount: hooks.length,
      totalCreatives: canonical.length
    },
    hooks,
    recommendations: recs
  };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  analyzeCreativePerformance,
  analyzeOffer,
  analyzeHooks
};
