// simple placeholder logic – no crash risk

function analyzeCreativePerformance(creatives) {
  return {
    score: 70,
    recommendations: [
      { msg: "Add more hooks", priority: "medium" },
      { msg: "Optimize CPC", priority: "high" },
    ],
  };
}

function analyzeOffer(campaigns) {
  return {
    recommendations: [{ msg: "Your offer is fine.", priority: "low" }],
  };
}

function analyzeHooks(creatives) {
  return {
    recommendations: [{ msg: "Try more variations.", priority: "medium" }],
  };
}

module.exports = {
  analyzeCreativePerformance,
  analyzeOffer,
  analyzeHooks,
};
