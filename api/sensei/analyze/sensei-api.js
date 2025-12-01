// api/sensei/analyze/sensei-api.js
// -----------------------------------------------------------------------------
// 🧠 Sensei AI Engine – Creative, Offer & Hook Analysis
// Echte Logik, keine Platzhalter. Läuft komplett ohne externe KI-Services.
// Nutzt nur numerische Heuristiken + Z-Scores.
// -----------------------------------------------------------------------------

// ---------- Helper -----------------------------------------------------------

function toNumber(value, fallback = 0) {
  if (value == null) return fallback;
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

function computeMeanStd(values) {
  const clean = values
    .map((v) => toNumber(v, 0))
    .filter((v) => Number.isFinite(v));

  if (!clean.length) return { mean: 0, std: 0 };

  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const variance =
    clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    Math.max(clean.length - 1, 1);

  return { mean, std: Math.sqrt(variance) };
}

function zScore(value, mean, std) {
  if (!std) return 0;
  return (toNumber(value, 0) - mean) / std;
}

// ---------- Canonical Metric Extraction --------------------------------------

// Flexible Mapping für Demo- und Live-Daten (Meta-Insights etc.)

function extractMetrics(entity) {
  const m = entity.metrics || entity.metric || entity.insights || {};

  const spend =
    toNumber(m.spend) ||
    toNumber(m.spend_eur) ||
    toNumber(entity.spend) ||
    0;

  let revenue =
    toNumber(m.revenue) ||
    toNumber(m.purchase_value) ||
    toNumber(m.value) ||
    toNumber(entity.revenue) ||
    0;

  let roas =
    toNumber(m.roas) ||
    toNumber(m.return_on_ad_spend) ||
    0;

  // Meta: website_purchase_roas oft als Array von {value}
  if (!roas && Array.isArray(m.website_purchase_roas) && m.website_purchase_roas[0]) {
    roas = toNumber(m.website_purchase_roas[0].value);
  }

  if (!roas && spend && revenue) {
    roas = revenue / spend;
  }

  const impressions = toNumber(m.impressions) || 0;
  const clicks = toNumber(m.clicks) || 0;

  const ctr =
    toNumber(m.ctr) ||
    (impressions ? (clicks / impressions) * 100 : 0);

  const cpm =
    toNumber(m.cpm) ||
    (impressions ? (spend / impressions) * 1000 : 0);

  const purchases =
    toNumber(m.purchases) ||
    toNumber(m.purchase) ||
    toNumber(m.conversions) ||
    0;

  const cpa = purchases ? spend / purchases : 0;

  const roasPrev =
    toNumber(m.roas_prev) ||
    toNumber(m.roas_prev_7d) ||
    0;

  const ctrPrev =
    toNumber(m.ctr_prev) ||
    toNumber(m.ctr_prev_7d) ||
    0;

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

function normalizeHookLabel(rawHook = "", name = "") {
  const src = `${rawHook || ""} ${name || ""}`.toLowerCase();

  if (!src.trim()) return "unknown";

  if (src.includes("problem") || src.includes("solution")) {
    return "Problem/Solution";
  }
  if (src.includes("testimonial") || src.includes("review")) {
    return "Testimonial";
  }
  if (src.includes("before") && src.includes("after")) {
    return "Before/After";
  }
  if (src.includes("ugc")) {
    return "UGC";
  }
  if (src.includes("static") || src.includes("image")) {
    return "Static";
  }
  if (src.includes("direct") && src.includes("cta")) {
    return "Direct CTA";
  }

  const tokens = (rawHook || name || "")
    .split(/[_\-\|\s/]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  return tokens[0] || "unknown";
}

// ---------- Creative Aggregation & Scoring -----------------------------------

function summarizeCreatives(creatives) {
  const canonical = (creatives || []).map((c) => {
    const metrics = extractMetrics(c);
    const hookLabel = normalizeHookLabel(c.hook, c.name);
    const creator = c.creator || c.creator_name || c.author || null;

    return {
      id: c.id || c.ad_id || c.creative_id || String(Math.random()),
      name: c.name || c.title || "Unnamed Creative",
      status: c.status || (c.isActive ? "ACTIVE" : "UNKNOWN"),
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

  canonical.forEach((c) => {
    const { spend, revenue, roas, ctr, cpm } = c.metrics;
    totalSpend += spend;
    totalRevenue += revenue;

    roasValues.push(roas);
    ctrValues.push(ctr);
    cpmValues.push(cpm);
    spendValues.push(spend);
  });

  const roasStats = computeMeanStd(roasValues);
  const ctrStats = computeMeanStd(ctrValues);
  const cpmStats = computeMeanStd(cpmValues);
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
  const {
    roas,
    roasPrev,
    ctr,
    ctrPrev,
    cpm,
    spend,
    purchases
  } = metrics;

  const {
    avgRoas,
    avgCtr,
    avgCpm,
    roasStats,
    ctrStats,
    cpmStats,
    spendStats,
    totalSpend
  } = aggregates;

  // Z-Werte für relative Leistung
  const zRoas = zScore(roas, roasStats.mean, roasStats.std);
  const zCtr = zScore(ctr, ctrStats.mean, ctrStats.std);
  const zCpm = -zScore(cpm, cpmStats.mean, cpmStats.std); // niedriger CPM = besser
  const zSpend = zScore(spend, spendStats.mean, spendStats.std);

  // Momentum anhand von ROAS/CTR-Veränderung
  const roasDelta = percentChange(roas, roasPrev);
  const ctrDelta = percentChange(ctr, ctrPrev);
  const momentum =
    clamp(roasDelta / 20, -2, 2) * 0.6 +
    clamp(ctrDelta / 20, -2, 2) * 0.4;

  let score =
    50 +
    zRoas * 12 +
    zCtr * 8 +
    zCpm * 6 +
    zSpend * 4 +
    momentum * 3;

  // Bonus/Malus
  if (roas > avgRoas * 1.4 && spend > totalSpend * 0.03) {
    score += 6;
  }
  if (roas < avgRoas * 0.7 && spend > totalSpend * 0.02) {
    score -= 8;
  }
  if (purchases === 0 && spend > totalSpend * 0.015) {
    score -= 10;
  }

  score = clamp(Math.round(score), 0, 100);

  let label = "Neutral";
  if (score >= 80) label = "Winner";
  else if (score >= 65) label = "Strong";
  else if (score <= 40) label = "Loser";
  else if (score <= 55) label = "Under Review";

  const isTesting =
    spend < Math.max(spendStats.mean * 0.6, totalSpend * 0.01) &&
    status === "ACTIVE";

  if (isTesting && label === "Neutral") {
    label = "Testing";
  }

  const fatigue =
    roasPrev > 0 &&
    roas < roasPrev * 0.7 &&
    spend > totalSpend * 0.02;

  const reasoning = [];

  if (roasPrev && Math.abs(roasDelta) > 10) {
    reasoning.push(
      roasDelta < 0
        ? `ROAS -${Math.abs(roasDelta).toFixed(1)}% vs. Vergleichszeitraum`
        : `ROAS +${roasDelta.toFixed(1)}% vs. Vergleichszeitraum`
    );
  }

  if (ctrPrev && Math.abs(ctrDelta) > 8) {
    reasoning.push(
      ctrDelta < 0
        ? `CTR -${Math.abs(ctrDelta).toFixed(1)}% – Hook verliert an Kraft`
        : `CTR +${ctrDelta.toFixed(1)}% – Hook gewinnt`
    );
  }

  if (fatigue) {
    reasoning.push("Ad Fatigue Verdacht (ROAS bricht bei relevantem Spend ein)");
  }

  if (!reasoning.length) {
    if (roas > avgRoas * 1.2) {
      reasoning.push("Überdurchschnittlicher ROAS");
    } else if (roas < avgRoas * 0.8) {
      reasoning.push("Unterdurchschnittlicher ROAS");
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

  scored.forEach((c) => {
    const { score, label, isTesting } = c;

    if (label === "Winner" || (score >= 80 && !isTesting)) {
      winners.push(c);
    } else if (label === "Loser" || score <= 40) {
      losers.push(c);
    } else if (isTesting || label === "Testing") {
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

  // Budget Shift
  if (winners.length && losers.length && totalSpend > 0) {
    const top = winners.slice(0, 3);
    const worst = losers.slice(0, 3);

    const loserSpend = worst.reduce((sum, c) => sum + c.metrics.spend, 0);
    const topSpend = top.reduce((sum, c) => sum + c.metrics.spend, 0) || 1;

    const weightedWinnerRoas =
      top.reduce((sum, c) => sum + c.metrics.roas * c.metrics.spend, 0) /
      topSpend;

    const upliftRoas = Math.max(weightedWinnerRoas - accountRoas, 0);
    const estExtraRevenue = loserSpend * upliftRoas;

    recs.push({
      type: "budget_shift",
      priority: "high",
      title: "Budget von Losern auf Gewinner-Creatives verschieben",
      message:
        "Reduziere Budget auf schwache Creatives und schiebe es auf deine Top-Performer.",
      details: {
        fromCreatives: worst.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          spend: c.metrics.spend
        })),
        toCreatives: top.map((c) => ({
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
    const topTesting = testing.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      roas: c.metrics.roas,
      spend: c.metrics.spend
    }));

    recs.push({
      type: "testing",
      priority: "medium",
      title: "Testing-Creatives strukturiert bewerten",
      message:
        "Einige Creatives haben erste Signale. Gib ihnen ein klares Testbudget und Deadline.",
      details: {
        candidates: topTesting,
        suggestion:
          "Teste diese Creatives 2–3 Tage mit fixem Tagesbudget und entscheide dann anhand ROAS/CPA."
      }
    });
  }

  // Fatigue
  const fatigued = winners.filter((c) => c.fatigue);
  if (fatigued.length) {
    recs.push({
      type: "fatigue",
      priority: "high",
      title: "Ad Fatigue erkannt – Varianten bauen",
      message:
        "Winner-Creatives verlieren an Performance. Ersetze sie bevor der Account einbricht.",
      details: {
        creatives: fatigued.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          roasDelta: c.roasDelta,
          spend: c.metrics.spend
        })),
        suggestion:
          "Erstelle 2–3 Varianten mit gleichem Angle/Hook, aber neuem Visual, Musik oder Text-Overlay."
      }
    });
  }

  if (!recs.length) {
    recs.push({
      type: "generic",
      priority: "low",
      title: "Account stabil – Fokus auf neue Tests",
      message:
        "Keine starken Ausreißer erkannt. Nutze dein Testing-Budget, um neue Hooks & Creator zu finden.",
      details: {}
    });
  }

  return recs;
}

// ---------- Public: Creative Performance -------------------------------------

function analyzeCreativePerformance(creatives = []) {
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
      recommendations: [
        {
          type: "no_data",
          priority: "low",
          title: "Keine Creatives übergeben",
          message:
            "Für die Analyse müssen mindestens ein Creative inkl. KPIs übergeben werden.",
          details: {}
        }
      ]
    };
  }

  const scored = canonical.map((entry) => scoreCreative(entry, aggregates));
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

// ---------- Public: Offer / Funnel Analysis ----------------------------------

function analyzeOffer(campaigns = []) {
  if (!Array.isArray(campaigns) || !campaigns.length) {
    return {
      summary: {
        totalCampaigns: 0,
        avgRoas: 0
      },
      campaigns: [],
      recommendations: [
        {
          type: "no_data",
          priority: "low",
          title: "Keine Kampagnen übergeben",
          message:
            "Die Offer/Funnel-Analyse benötigt mindestens eine Kampagne mit Spend/ROAS.",
          details: {}
        }
      ]
    };
  }

  const normalized = campaigns.map((c) => {
    const metrics = extractMetrics(c);
    return {
      id: c.id || c.campaign_id || String(Math.random()),
      name: c.name || "Unnamed Campaign",
      objective: c.objective || c.campaignObjective || "UNKNOWN",
      status: c.status || "UNKNOWN",
      metrics,
      raw: c
    };
  });

  const { aggregates } = summarizeCreatives(normalized);
  const avgRoas = aggregates.avgRoas || 0;
  const avgCtr = aggregates.avgCtr || 0;
  const avgCpm = aggregates.avgCpm || 0;

  const enriched = normalized.map((c) => {
    const { roas, ctr, cpm, spend } = c.metrics;

    let funnelType = "balanced";

    if (ctr >= avgCtr * 1.1 && roas < avgRoas * 0.8) {
      funnelType = "offer_issue"; // Viele Klicks, wenig Sales
    } else if (ctr <= avgCtr * 0.8 && roas < avgRoas * 0.9) {
      funnelType = "creative_issue"; // Weder Klicks noch Sales
    } else if (cpm > avgCpm * 1.2) {
      funnelType = "targeting_issue"; // Traffic zu teuer
    }

    return {
      ...c,
      funnelType,
      roasDeltaVsAvg: percentChange(roas, avgRoas),
      spendShare: aggregates.totalSpend
        ? (spend / aggregates.totalSpend) * 100
        : 0
    };
  });

  const offerProblems = enriched.filter((c) => c.funnelType === "offer_issue");
  const creativeProblems = enriched.filter((c) => c.funnelType === "creative_issue");
  const targetingProblems = enriched.filter((c) => c.funnelType === "targeting_issue");

  const recs = [];

  if (offerProblems.length) {
    recs.push({
      type: "offer",
      priority: "high",
      title: "Starke Klicks, aber schwacher ROAS – Offer / Funnel prüfen",
      message:
        "Kampagnen mit guter CTR aber schwachem ROAS deuten auf Probleme in Offer, Landingpage oder Checkout hin.",
      details: {
        campaigns: offerProblems.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          ctr: c.metrics.ctr,
          spend: c.metrics.spend
        })),
        checklist: [
          "Landingpage-Konversion (Add-to-Cart / Purchase) prüfen",
          "Offer-Kommunikation (Preis, Bundles, Scarcity, Social Proof)",
          "Pixel-Events und Tracking sauber testen",
          "Mobile Page Speed checken"
        ]
      }
    });
  }

  if (creativeProblems.length) {
    recs.push({
      type: "creative",
      priority: "medium",
      title: "Kampagnen mit Kreativ-Problem identifiziert",
      message:
        "Schwache CTR & schwacher ROAS deuten auf uninteressante Creatives/Angles hin.",
      details: {
        campaigns: creativeProblems.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          ctr: c.metrics.ctr,
          spend: c.metrics.spend
        })),
        suggestion:
          "Nutze Sensei, um bessere Hooks zu finden (z.B. UGC Problem/Solution statt statischer Banner)."
      }
    });
  }

  if (targetingProblems.length) {
    recs.push({
      type: "targeting",
      priority: "medium",
      title: "Hohe CPM – Targeting / Placements optimieren",
      message:
        "Einige Kampagnen kaufen Reichweite zu hohen CPMs ein. Prüfe Zielgruppen, Placements und Bidding-Strategien.",
      details: {
        campaigns: targetingProblems.map((c) => ({
          id: c.id,
          name: c.name,
          cpm: c.metrics.cpm,
          roas: c.metrics.roas,
          spend: c.metrics.spend
        })),
        checklist: [
          "Placements testen (z.B. Reels vs. Feed)",
          "Broad vs. Interessentargeting vergleichen",
          "Frequency & Audience Overlap prüfen",
          "Bidding-Strategie testen (Lowest Cost vs. Cost Cap)"
        ]
      }
    });
  }

  if (!recs.length) {
    recs.push({
      type: "funnel_ok",
      priority: "low",
      title: "Funnel wirkt insgesamt gesund",
      message:
        "Keine starken Funnel-Bottlenecks erkannt. Fokus auf Creative-Testing & Scaling.",
      details: {}
    });
  }

  return {
    summary: {
      totalCampaigns: enriched.length,
      avgRoas,
      avgCtr,
      avgCpm,
      totalSpend: aggregates.totalSpend,
      totalRevenue: aggregates.totalRevenue
    },
    campaigns: enriched,
    recommendations: recs
  };
}

// ---------- Public: Hook & Story Analysis ------------------------------------

function analyzeHooks(creatives = []) {
  if (!Array.isArray(creatives) || !creatives.length) {
    return {
      summary: {
        hookCount: 0,
        totalCreatives: 0
      },
      hooks: [],
      recommendations: [
        {
          type: "no_data",
          priority: "low",
          title: "Keine Creatives für Hook-Analyse übergeben",
          message:
            "Für die Hook-Analyse müssen Creatives mit Namen oder Hook-Labels übergeben werden.",
          details: {}
        }
      ]
    };
  }

  const { canonical, aggregates } = summarizeCreatives(creatives);
  const hookMap = new Map();

  canonical.forEach((c) => {
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

  const hooks = Array.from(hookMap.values()).map((h) => {
    const avgRoas = h.totalSpend
      ? h.weightedRoasSum / h.totalSpend
      : 0;

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
      type: "hook_winners",
      priority: "high",
      title: "Top-Hooks identifiziert",
      message:
        "Diese Hook-Formate schlagen deinen Account-Durchschnitt deutlich. Produziere mehr Creatives in diesem Stil.",
      details: {
        hooks: top.map((h) => ({
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
      type: "hook_losers",
      priority: "medium",
      title: "Schwache Hook-Formate reduzieren",
      message:
        "Einige Hook-Cluster liegen klar unter dem Account-ROAS. Hier solltest du Budget reduzieren oder pausieren.",
      details: {
        hooks: bottom.map((h) => ({
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
      type: "hook_balanced",
      priority: "low",
      title: "Hook-Performance stabil",
      message:
        "Die Hook-Cluster liegen relativ nah beieinander. Nutze kreative Experimente, um neue Gewinner zu finden.",
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

// ---------- Exports ----------------------------------------------------------

module.exports = {
  analyzeCreativePerformance,
  analyzeOffer,
  analyzeHooks
};
