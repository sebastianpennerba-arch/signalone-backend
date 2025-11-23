// metaRoutes.js – FULL VERSION (CommonJS + Native Fetch)
const express = require("express");
const router = express.Router();

const META_API = "https://graph.facebook.com/v21.0";

// ----------------------------------------------
// 0) TOKEN EXCHANGE (DER WICHTIGSTE ENDPOINT)
// ----------------------------------------------
router.post("/oauth/token", async (req, res) => {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
        return res.json({ success: false, error: "Missing code or redirectUri" });
    }

    try {
        const tokenUrl =
            `https://graph.facebook.com/v21.0/oauth/access_token?` +
            new URLSearchParams({
                client_id: process.env.META_APP_ID,
                client_secret: process.env.META_APP_SECRET,
                redirect_uri: redirectUri,
                code: code
            });

        const response = await fetch(tokenUrl);
        const data = await response.json();

        if (data.error) {
            console.error("META TOKEN ERROR:", data.error);
            return res.json({ success: false, error: data.error });
        }

        return res.json({
            success: true,
            accessToken: data.access_token,
            expiresIn: data.expires_in,
            raw: data
        });

    } catch (err) {
        console.error("TOKEN EXCHANGE FAILED:", err);
        return res.json({ success: false, error: err.toString() });
    }
});

// ---------------------------------------------------
// Tools: Meta GET Wrapper
// ---------------------------------------------------
async function metaGet(path, accessToken, params = {}) {
    const url = new URL(`${META_API}/${path}`);
    url.searchParams.append("access_token", accessToken);

    Object.entries(params).forEach(([key, val]) => {
        url.searchParams.append(key, val);
    });

    try {
        const res = await fetch(url);
        const data = await res.json();

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

// ---------------------------------------------------
// 1) Ad Accounts
// ---------------------------------------------------
router.post("/adaccounts", async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet("me/adaccounts", accessToken, {
        fields: "id,name,account_status,currency,timezone_name"
    });

    res.json(result);
});

// ---------------------------------------------------
// 2) Campaigns
// ---------------------------------------------------
router.post("/campaigns/:accountId", async (req, res) => {
    const { accountId } = req.params;
    const { accessToken } = req.body;

    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(`${accountId}/campaigns`, accessToken, {
        fields: "id,name,status,objective,daily_budget"
    });

    res.json(result);
});

// ---------------------------------------------------
// 3) Campaign Insights
// ---------------------------------------------------
router.post("/insights/:campaignId", async (req, res) => {
    const { campaignId } = req.params;
    const { accessToken } = req.body;

    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet(`${campaignId}/insights`, accessToken, {
        fields: "spend,impressions,clicks,ctr,cpm,cpp,actions,website_purchase_roas",
        date_preset: "last_30d"
    });

    res.json(result);
});

// ---------------------------------------------------
// 4) User Info
// ---------------------------------------------------
router.post("/me", async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) return res.json({ success: false, error: "accessToken missing" });

    const result = await metaGet("me", accessToken, {
        fields: "id,name"
    });

    res.json(result);
});

module.exports = router;
