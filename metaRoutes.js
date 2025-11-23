// metaRoutes.js – FINAL LIVE META API (CommonJS, native fetch)
const express = require("express");
const router = express.Router();

const META_API = "https://graph.facebook.com/v21.0";

/**
 * Native Fetch Wrapper
 */
async function metaGet(path, accessToken, params = {}) {
    const url = new URL(`${META_API}/${path}`);

    url.searchParams.append("access_token", accessToken);

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("Meta API ERROR:", data.error);
            return { success: false, error: data.error };
        }

        return { success: true, data };
    } catch (err) {
        console.error("Fetch ERROR:", err);
        return { success: false, error: err.toString() };
    }
}

/**
 * 1) Ad Accounts
 */
router.post("/adaccounts", async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet("me/adaccounts", accessToken, {
        fields: "id,name,account_status,currency,timezone_name"
    });

    res.json(result);
});

/**
 * 2) Campaigns of Account
 */
router.post("/campaigns/:accountId", async (req, res) => {
    const { accessToken } = req.body;
    const { accountId } = req.params;
    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(`${accountId}/campaigns`, accessToken, {
        fields: "id,name,status,objective,daily_budget"
    });

    res.json(result);
});

/**
 * 3) Campaign Insights
 */
router.post("/insights/:campaignId", async (req, res) => {
    const { accessToken } = req.body;
    const { campaignId } = req.params;

    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(`${campaignId}/insights`, accessToken, {
        fields: "spend,impressions,clicks,ctr,cpm,cpp,actions,website_purchase_roas",
        date_preset: "last_30d"
    });

    res.json(result);
});

/**
 * 4) User Info
 */
router.post("/me", async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet("me", accessToken, {
        fields: "id,name"
    });

    res.json(result);
});

module.exports = router;
