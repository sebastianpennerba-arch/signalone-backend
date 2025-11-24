// sensei-api.js (CommonJS)

function analyzeCreativePerformance(creatives) {
  return {
    summary: "Demo creative performance OK",
    recommendations: [
      "Erhöhe Budget für Top 10% Creatives",
      "Stoppe Creatives mit ROAS < 1.0"
    ]
  };
}

function analyzeOffer(campaigns) {
  return {
    summary: "Offer strength stable",
    recommendations: [
      "Test new offer variation for retargeting"
    ]
  };
}

function analyzeHooks(creatives) {
  return {
    summary: "Hooks have above-average CTR",
    recommendations: [
      "Generate new hook variations",
      "Test 3 faster openings for video creatives"
    ]
  };
}

module.exports = {
  analyzeCreativePerformance,
  analyzeOffer,
  analyzeHooks
};
