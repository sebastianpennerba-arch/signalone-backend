// metaRoutes.js – FINAL LIVE META API (CommonJS)
const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();
const META_API = "https://graph.facebook.com/v21.0";

/* Helper: Facebook Graph GET */
async function metaGet(path, accessToken, params = {}) {
    const url = new URL(`${META_API}/${path}`);
    url.searchParams.append("access_token", accessToken);

    Object.entries(params).forEach(([k, v]) =>
        url.searchParams.append(k, v)
    );

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        console.error("Meta API ERROR:", data.error);
        return { success: false, error: data.error };
    }
    return { success: true, data };
}

/* ================================
   1. Ad Accounts
================================ */
router.post("/adaccounts", async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken)
        return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(
        "me/adaccounts",
        accessToken,
        { fields: "id,name,account_status,currency,timezone_name" }
    );

    res.json(result);
});

/* ================================
   2. Campaigns for Account
================================ */
router.post("/campaigns/:accountId", async (req, res) => {
    const { accessToken } = req.body;
    const { accountId } = req.params;

    if (!accessToken)
        return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(
        `${accountId}/campaigns`,
        accessToken,
        { fields: "id,name,status,objective,daily_budget" }
    );

    res.json(result);
});

/* ================================
   3. Insights for Campaign
================================ */
router.post("/insights/:campaignId", async (req, res) => {
    const { accessToken } = req.body;
    const { campaignId } = req.params;

    if (!accessToken)
        return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(
        `${campaignId}/insights`,
        accessToken,
        {
            fields: "spend,impressions,clicks,ctr,cpm,cpp,actions,website_purchase_roas",
            date_preset: "last_30d"
        }
    );

    res.json(result);
});

/* ================================
   4. User Info
================================ */
router.post("/me", async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken)
        return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(
        "me",
        accessToken,
        { fields: "id,name" }
    );

    res.json(result);
});


module.exports = router;
