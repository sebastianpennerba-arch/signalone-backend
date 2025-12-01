// sensei-api.js
// -----------------------------------------------------------------------------
// 🧠 Sensei AI Engine – Creative, Offer & Hook Analysis
// Backend-seitige "echte" Algorithmen ohne Platzhalter.
// - Keine externen Dependencies
// - Robust gegen unvollständige Daten
// - Gibt strukturierte Empfehlungen für das Sensei-Frontend zurück
// -----------------------------------------------------------------------------

// ---------- Helpers -----------------------------------------------------------

function toNumber(value, fallback = 0) {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeDivide(num, den, fallback = 0) {
  const n = toNumber(num, 0);
  const d = toNumber(den, 0);
  if (!d) return fallback;
  return n / d;
}

function percentChange(current, previous) {
  const c = toNumber(current, 0);
  const p = toNumber(previous, 0);
  if (!p) return 0;
  return ((c - p) / p) * 100;
}

function computeMeanStd(values) {
  const clean = values.map((v) => toNumber(v, 0)).filter((v) => Number.isFinite(v));
  if (!clean.length) return { mean: 0, std: 0 };
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const variance =
    clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(clean.length - 1, 1);
  return { mean, std: Math.sqrt(variance) };
}

function zScore(value, mean, std) {
  if (!std) return 0;
  return (toNumber(value, 0) - mean) / std;
}

// ---------- Canonical Metric Extraction --------------------------------------

// Wir versuchen, möglichst viele Formen von Daten abzudecken
// (Demo-Daten, Meta-Insights, eigene Normalisierung …)

function extractCreativeMetrics(creative = {}) {
  const m = creative.metrics || creative.metric || {};

  // Spend
  const spend =
    toNumber(m.spend) ||
    toNumber(m.spend_eur) ||
    toNumber(creative.spend) ||
    0;

  // Revenue
  let revenue =
    toNumber(m.revenue) ||
    toNumber(m.purchase_value) ||
    toNumber(m.value) ||
    toNumber(creative.revenue);

  // ROAS – falls nicht direkt vorhanden, aus revenue / spend
  let roas =
    toNumber(m.roas) ||
    toNumber(m.return_on_ad_spend) ||
    toNumber(m.website_purchase_roas) ||
    0;

  if (!roas && spend && revenue) {
    roas = revenue / spend;
  }

  // Meta "website_purchase_roas" als Array
  if (!roas && Array.isArray(m.website_purchase_roas) && m.website_purchase_roas[0]) {
    roas = toNumber(m.website_purchase_roas[0].value);
  }

  // CTR / CPM
  const ctr =
    toNumber(m.ctr) ||
    safeDivide(m.clicks, m.impressions, 0) * 100 ||
    0;

  const cpm =
    toNumber(m.cpm) ||
    (spend && m.impressions ? (spend / toNumber(m.impressions)) * 1000 : 0);

  const impressions = toNumber(m.impressions) || 0;
  const clicks = toNumber(m.clicks) || 0;

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

  const ctrPrev = toNumber(m.ctr_prev) || 0;

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
  const source = `${rawHook || ""} ${name || ""}`.toLowerCase();

  if (!source.trim()) return "unknown";

  if (source.includes("problem") || source.includes("solution") || source.includes("pas")) {
    return "Problem/Solution";
  }
  if (source.includes("testimonial") || source.includes("review")) {
    return "Testimonial";
  }
  if (source.includes("before") && source.includes("after")) {
    return "Before/After";
  }
  if (source.includes("ugc")) {
    return "UGC";
  }
  if (source.includes("static") || source.includes("image")) {
    return "Static";
  }
  if (source.includes("direct") && source.includes("cta")) {
    return "Direct CTA";
  }

  // fallback: erstes Token aus Hook oder Name
  const tokens = (rawHook || name || "")
    .split(/[_\-|/]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  return tokens[0] || "unknown";
}

// ---------- Creative Aggregation & Scoring -----------------------------------

function summarizeCreatives(creatives = []) {
  const canonical = creatives.map((c) => {
    const metrics = extractCreativeMetrics(c);
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
  let weightedRoasSum = 0;
  let weightedCtrSum = 0;
  let weightedCpmSum = 0;

  const roasValues = [];
  const ctrValues = [];
  const cpmValues = [];
  const spendValues = [];

  canonical.forEach((c) => {
    const { spend, revenue, roas, ctr, cpm } = c.metrics;
    totalSpend += spend;
    totalRevenue += revenue;

    if (spend > 0) {
      weightedRoasSum += roas * spend;
      weightedCtrSum += ctr * spend;
      weightedCpmSum += cpm * spend;
    }

    roasValues.push(roas);
    ctrValues.push(ctr);
    cpmValues.push(cpm);
    spendValues.push(spend);
  });

  const avgRoas = totalSpend ? weightedRoasSum / totalSpend : 0;
  const avgCtr = totalSpend ? weightedCtrSum / totalSpend : 0;
  const avgCpm = totalSpend ? weightedCpmSum / totalSpend : 0;

  const roasStats = computeMeanStd(roasValues);
  const ctrStats = computeMeanStd(ctrValues);
  const cpmStats = computeMeanStd(cpmValues);
  const spendStats = computeMeanStd(spendValues);

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
  const { metrics, hookLabel, status } = entry;
  const { roas, ctr, cpm, spend, purchases, roasPrev, ctrPrev } = metrics;
  const {
    avgRoas,
    avgCtr,
    avgCpm,
    roasStats,
    ctrStats,
    cpmStats,
    spendStats
  } = aggregates;

  // Z-Scores für relative Leistung
  const zRoas = zScore(roas, roasStats.mean, roasStats.std);
  const zCtr = zScore(ctr, ctrStats.mean, ctrStats.std);
  const zCpm = -zScore(cpm, cpmStats.mean, cpmStats.std); // niedriger CPM ist gut
  const zSpend = zScore(spend, spendStats.mean, spendStats.std);

  // Momentum
  const roasDelta = percentChange(roas, roasPrev);
  const ctrDelta = percentChange(ctr, ctrPrev);
  const momentum =
    clamp(roasDelta / 20, -2, 2) * 0.6 + clamp(ctrDelta / 20, -2, 2) * 0.4;

  // Basisscore 50, dann z-Werte + Momentum + Spend-Gewichtung
  let score =
    50 +
    zRoas * 12 +
    zCtr * 8 +
    zCpm * 6 +
    zSpend * 4 +
    momentum * 3;

  // leichte Bonus-/Malus-Logik
  if (roas > avgRoas * 1.4 && spend > aggregates.totalSpend * 0.03) {
    score += 6;
  }
  if (roas < avgRoas * 0.7 && spend > aggregates.totalSpend * 0.02) {
    score -= 8;
  }
  if (purchases === 0 && spend > aggregates.totalSpend * 0.015) {
    score -= 10;
  }

  score = clamp(Math.round(score), 0, 100);

  let label = "Neutral";
  if (score >= 80) label = "Winner";
  else if (score >= 65) label = "Strong";
  else if (score <= 40) label = "Loser";
  else if (score <= 55) label = "Under Review";

  // Testing: wenig Spend, aktiv
  const isTesting =
    spend < Math.max(aggregates.spendStats.mean * 0.6, aggregates.totalSpend * 0.01) &&
    status === "ACTIVE";

  if (isTesting && label === "Neutral") {
    label = "Testing";
  }

  // Fatigue: starke ROAS- oder CTR-Einbrüche
  const fatigue =
    roasPrev > 0 &&
    roas < roasPrev * 0.7 &&
    spend > aggregates.totalSpend * 0.02;

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

  // Sortierungen
  winners.sort((a, b) => b.score - a.score);
  losers.sort((a, b) => a.score - b.score); // schlechteste zuerst
  testing.sort((a, b) => b.metrics.spend - a.metrics.spend);
  potentials.sort((a, b) => b.score - a.score);

  return { winners, losers, testing, potentials };
}

function buildCreativeRecommendations(aggregates, segments) {
  const { winners, losers, testing } = segments;
  const recs = [];

  const totalSpend = aggregates.totalSpend || 0;
  const overallRoas = aggregates.avgRoas || 0;

  // 1) Budget Reallocation
  if (winners.length && losers.length && totalSpend > 0) {
    const topWinners = winners.slice(0, 3);
    const worstLosers = losers.slice(0, 3);

    const loserSpend = worstLosers.reduce((sum, c) => sum + c.metrics.spend, 0);
    const winnerRoasAvg =
      safeDivide(
        topWinners.reduce((sum, c) => sum + c.metrics.roas * c.metrics.spend, 0),
        topWinners.reduce((sum, c) => sum + c.metrics.spend, 0),
        overallRoas
      ) || overallRoas;

    const expectedUpliftRoas = winnerRoasAvg - overallRoas;
    const expectedExtraRevPerDay = loserSpend * expectedUpliftRoas;

    recs.push({
      type: "budget_shift",
      priority: "high",
      title: "Budget von Losern zu Gewinner-Creatives verschieben",
      message:
        "Reduziere Budget auf schlecht performenden Creatives und allokiere es auf die Top-Performer.",
      details: {
        fromCreatives: worstLosers.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          spend: c.metrics.spend
        })),
        toCreatives: topWinners.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          spend: c.metrics.spend
        })),
        loserSpend,
        estimatedDailyRevenueUplift: Math.round(expectedExtraRevPerDay),
        explanation:
          "Basierend auf dem ROAS-Unterschied zwischen deinen Top- und Bottom-Creatives."
      }
    });
  }

  // 2) Testing Opportunities
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
      title: "Testing-Creatives gezielt skalieren",
      message:
        "Mehrere Creatives haben erste gute Signale. Plane strukturierte Tests mit klaren Budgets.",
      details: {
        candidates: topTesting,
        suggestion:
          "Setze pro Creative ein fixes Testbudget (z.B. 50–150€ / Tag für 3 Tage) und entscheide nach klaren KPIs (ROAS, CPA, CTR)."
      }
    });
  }

  // 3) Fatigue / Rotation
  const fatigued = segments.winners.filter((c) => c.fatigue);
  if (fatigued.length) {
    recs.push({
      type: "fatigue",
      priority: "high",
      title: "Ad Fatigue erkannt – Varianten nachlegen",
      message:
        "Einige deiner Gewinner-Creatives verlieren deutlich an Performance. Jetzt Varianten produzieren, bevor die Performance kollabiert.",
      details: {
        creatives: fatigued.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          roasDelta: c.roasDelta,
          spend: c.metrics.spend
        })),
        suggestion:
          "Erstelle 2–3 neue Varianten mit ähnlicher Story, aber frischen Hooks/Intros. Nutze Creator & Hook, die historisch am besten performen."
      }
    });
  }

  // 4) Safety Net – generelle Empfehlung, falls sonst wenig erkannt
  if (!recs.length) {
    recs.push({
      type: "generic",
      priority: "low",
      title: "Account ist stabil – weiter beobachten",
      message:
        "Keine starken Ausreißer erkennbar. Nutze die Testing-Slots trotzdem, um neue Hooks & Creator auszuprobieren.",
      details: {}
    });
  }

  return recs;
}

// ---------- Public: Creative Performance Analysis ----------------------------

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
            "Für eine Analyse müssen mindestens ein Creative mit KPIs übergeben werden.",
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
      recommendations: [
        {
          type: "no_data",
          priority: "low",
          title: "Keine Kampagnen übergeben",
          message:
            "Die Offer-Analyse benötigt mindestens eine Kampagne mit Spend/ROAS.",
          details: {}
        }
      ]
    };
  }

  const normalized = campaigns.map((c) => {
    const metrics = extractCreativeMetrics(c); // gleiche Logik reicht hier
    return {
      id: c.id || c.campaign_id || String(Math.random()),
      name: c.name || "Unnamed Campaign",
      objective: c.objective || c.campaignObjective || "UNKNOWN",
      status: c.status || "UNKNOWN",
      metrics,
      raw: c
    };
  });

  const { aggregates } = summarizeCreatives(normalized); // nutzt gleiche Aggregationslogik
  const avgRoas = aggregates.avgRoas || 0;
  const avgCtr = aggregates.avgCtr || 0;

  const withFlags = normalized.map((c) => {
    const { roas, ctr, cpm, spend } = c.metrics;
    const funnelType =
      ctr >= avgCtr * 1.1 && roas < avgRoas * 0.8
        ? "offer_issue"
        : ctr <= avgCtr * 0.8 && roas < avgRoas * 0.9
        ? "creative_issue"
        : cpm > aggregates.avgCpm * 1.2
        ? "targeting_issue"
        : "balanced";

    return {
      ...c,
      funnelType,
      roasDeltaVsAvg: percentChange(roas, avgRoas)
    };
  });

  const offerProblems = withFlags.filter((c) => c.funnelType === "offer_issue");
  const creativeProblems = withFlags.filter((c) => c.funnelType === "creative_issue");
  const targetingProblems = withFlags.filter((c) => c.funnelType === "targeting_issue");

  const recs = [];

  if (offerProblems.length) {
    recs.push({
      type: "offer",
      priority: "high",
      title: "Starke Klicks, aber schwacher ROAS – Offer / Funnel prüfen",
      message:
        "Einige Kampagnen haben gute CTR, aber schlechten ROAS. Meist liegt das an Offer, Landingpage oder Checkout.",
      details: {
        campaigns: offerProblems.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          ctr: c.metrics.ctr,
          spend: c.metrics.spend
        })),
        checklist: [
          "Landingpage-Konversion (Add-to-Cart / Purchase Rate) prüfen",
          "Offer kommunizieren (Preis, Bundle, Scarcity, Social Proof)",
          "Pixel-Events & Tracking testen",
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
        "Schwache CTR & schwacher ROAS deuten auf uninteressante Creatives oder Hooks hin.",
      details: {
        campaigns: creativeProblems.map((c) => ({
          id: c.id,
          name: c.name,
          roas: c.metrics.roas,
          ctr: c.metrics.ctr,
          spend: c.metrics.spend
        })),
        suggestion:
          "Nutze Sensei Creative Library & Hook-Analyse, um neue Hooks & Formate zu testen (z.B. UGC Testimonial statt statischer Banner)."
      }
    });
  }

  if (targetingProblems.length) {
    recs.push({
      type: "targeting",
      priority: "medium",
      title: "Hohe CPM – Targeting / Bidding optimieren",
      message:
        "Einige Kampagnen kaufen Traffic zu teuren CPMs ein. Prüfe Targeting, Placements & Bidding-Strategie.",
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
          "Breitere Audiences ausprobieren",
          "Frequency & Audience Overlap checken",
          "Bidding-Strategie (Lowest Cost vs. Cost Cap) testen"
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
        "Keine klaren Funnel-Bottlenecks erkannt. Fokus auf Creative-Testing & Skalierung der Gewinner.",
      details: {}
    });
  }

  return {
    summary: {
      totalCampaigns: normalized.length,
      avgRoas,
      avgCtr,
      avgCpm: aggregates.avgCpm,
      totalSpend: aggregates.totalSpend,
      totalRevenue: aggregates.totalRevenue
    },
    campaigns: withFlags,
    recommendations: recs
  };
}

// ---------- Public: Hook & Story Analysis ------------------------------------

function analyzeHooks(creatives = []) {
  if (!Array.isArray(creatives) || !creatives.length) {
    return {
      summary: {
        hookCount: 0
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
    const metrics = extractCreativeMetrics(c.raw);

    if (!hookMap.has(label)) {
      hookMap.set(label, {
        label,
        creatives: [],
        totalSpend: 0,
        totalRevenue: 0,
        weightedRoasSum: 0,
        totalImpressions: 0,
        totalPurchases: 0
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
    bucket.totalImpressions += metrics.impressions;
    bucket.totalPurchases += metrics.purchases;
  });

  const hooks = Array.from(hookMap.values()).map((h) => {
    const avgRoas = h.totalSpend ? h.weightedRoasSum / h.totalSpend : 0;
    const ctr = safeDivide(h.totalPurchases, h.totalImpressions, 0) * 100; // grober Proxy

    return {
      label: h.label,
      creatives: h.creatives,
      totalSpend: h.totalSpend,
      totalRevenue: h.totalRevenue,
      avgRoas,
      proxyConversionRate: ctr,
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
        "Diese Hook-Formate schlagen deinen Account-Durchschnitt deutlich. Produziere bewusst mehr davon.",
      details: {
        hooks: top.map((h) => ({
          label: h.label,
          avgRoas: h.avgRoas,
          shareOfSpend: h.shareOfSpend,
          totalSpend: h.totalSpend
        })),
        suggestion:
          "Richte deine Creative-Produktion so aus, dass 70–80 % der neuen Creatives auf den Top-Hook-Formaten basieren."
      }
    });
  }

  if (bottom.length && hooks.length > 2) {
    recs.push({
      type: "hook_losers",
      priority: "medium",
      title: "Schwache Hook-Formate reduzieren",
      message:
        "Einige Hook-Cluster liegen deutlich unter dem Account-ROAS. Hier solltest du spend reduzieren oder komplett pausieren.",
      details: {
        hooks: bottom.map((h) => ({
          label: h.label,
          avgRoas: h.avgRoas,
          shareOfSpend: h.shareOfSpend,
          totalSpend: h.totalSpend
        })),
        suggestion:
          "Pausiere schwache Hook-Formate schrittweise und verschiebe Budget auf deine Gewinner-Hooks."
      }
    });
  }

  if (!recs.length) {
    recs.push({
      type: "hook_balanced",
      priority: "low",
      title: "Hook-Performance ohne starke Ausreißer",
      message:
        "Die Hook-Cluster liegen relativ nahe beieinander. Nutze kreative Experimente (z.B. neue Storylines, Creator) um neue Gewinner zu finden.",
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
