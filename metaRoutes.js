// metaRoutes.js – FINAL LIVE VERSION

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const META_API_BASE = "https://graph.facebook.com/v21.0";

/**
 * HELPER – API CALL WRAPPER
 */
async function metaApiGet(endpoint, accessToken, params = {}) {
    const url = new URL(`${META_API_BASE}/${endpoint}`);
    
    // Add query parameters
    url.searchParams.append("access_token", accessToken);
    Object.entries(params).forEach(([key, val]) => {
        url.searchParams.append(key, val);
    });

    const response = await fetch(url);
    const data = await response.json();

    // Handle errors
    if (data.error) {
        console.error("Meta API Error:", data.error);
        return { success: false, error: data.error };
    }

    return { success: true, data };
}

/**
 * ENDPOINT 1:
 * Hol alle AdAccounts des Users
 */
router.post("/adaccounts", async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.json({ success: false, error: "Missing accessToken" });
    }

    const result = await metaApiGet("me/adaccounts", accessToken, {
        fields: "id,name,account_status,currency,timezone_name"
    });

    return res.json(result);
});

/**
 * ENDPOINT 2:
 * Hol Kampagnen für einen Account
 */
router.post("/campaigns/:accountId", async (req, res) => {
    const { accessToken } = req.body;
    const { accountId } = req.params;

    if (!accessToken) {
        return res.json({ success: false, error: "Missing accessToken" });
    }

    const result = await metaApiGet(`${accountId}/campaigns`, accessToken, {
        fields: "id,name,status,objective,daily_budget"
    });

    return res.json(result);
});

/**
 * ENDPOINT 3:
 * Hol Campaign Insights (KPI Daten)
 */
router.post("/stats/:campaignId", async (req, res) => {
    const { accessToken } = req.body;
    const { campaignId } = req.params;

    if (!accessToken) {
        return res.json({ success: false, error: "Missing accessToken" });
    }

    const result = await metaApiGet(`${campaignId}/insights`, accessToken, {
        fields: "spend,impressions,clicks,actions,ctr,cpp,cpm,roas,website_purchase_roas",
        date_preset: "last_30d"
    });

    return res.json(result);
});

/**
 * ENDPOINT 4:
 * Hol Informationen über den User
 */
router.post("/me", async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.json({ success: false, error: "Missing accessToken" });
    }

    const result = await metaApiGet("me", accessToken, {
        fields: "id,name"
    });

    return res.json(result);
});

export default router;
