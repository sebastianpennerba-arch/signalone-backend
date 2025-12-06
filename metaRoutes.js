// metaRoutes.js – Meta OAuth + Proxy Routen

const express = require("express");
const axios = require("axios");

const router = express.Router();

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const DEFAULT_REDIRECT_URI = process.env.META_OAUTH_REDIRECT_URI || "";

// --- Helper ------------------------------------------------------------------

function ensureAccessToken(token, res) {
  if (!token) {
    res.status(401).json({ ok: false, error: "Missing Meta access token" });
    return false;
  }
  return true;
}

function normalizeAccountId(id) {
  if (!id) return null;
  return String(id).startsWith("act_") ? String(id) : `act_${id}`;
}

function metaHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

// ------------------------
// 1) OAuth Code → Token
// ------------------------
// POST /api/meta/oauth/token
// Body: { code, redirectUri? }
// Antwort: { ok, success, accessToken, tokenType, expiresIn, raw }
router.post("/oauth/token", async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};

    if (!code) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing 'code' in request body" });
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "META_APP_ID or META_APP_SECRET not configured"
      });
    }

    const finalRedirectUri = redirectUri || DEFAULT_REDIRECT_URI;
    if (!finalRedirectUri) {
      return res.status(500).json({
        ok: false,
        error:
          "No redirectUri provided and META_OAUTH_REDIRECT_URI not set on server"
      });
    }

    const url = "https://graph.facebook.com/v21.0/oauth/access_token";

    const response = await axios.get(url, {
      params: {
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: finalRedirectUri,
        code
      }
    });

    const data = response.data || {};

    return res.json({
      ok: true,
      success: true,
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      raw: data
    });
  } catch (err) {
    console.error("Error in /api/meta/oauth/token:", err?.response?.data || err);
    return res.status(500).json({
      ok: false,
      success: false,
      error: "Meta token exchange failed",
      details: err?.response?.data || err.message
    });
  }
});

// ------------------------
// 2) User Profil
// ------------------------
// POST /api/meta/me
// Body: { accessToken }
router.post("/me", async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!ensureAccessToken(accessToken, res)) return;

    const url = "https://graph.facebook.com/v21.0/me";

    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields: "id,name,email"
      }
    });

    res.json({ ok: true, data: response.data });
  } catch (err) {
    console.error("Error in /api/meta/me:", err?.response?.data || err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch user profile",
      details: err?.response?.data || err.message
    });
  }
});

// ------------------------
// 3) Ad Accounts
// ------------------------
// POST /api/meta/adaccounts
// Body: { accessToken }
router.post("/adaccounts", async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!ensureAccessToken(accessToken, res)) return;

    const url = "https://graph.facebook.com/v21.0/me/adaccounts";

    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields: "id,name,account_status,currency,timezone_name",
        limit: 200
      }
    });

    res.json({ ok: true, data: response.data });
  } catch (err) {
    console.error("Error in /api/meta/adaccounts:", err?.response?.data || err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch adaccounts",
      details: err?.response?.data || err.message
    });
  }
});

// ------------------------
// 4) Campaigns by Account
// ------------------------
// POST /api/meta/campaigns/:accountId
// Body: { accessToken }
router.post("/campaigns/:accountId", async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    let { accountId } = req.params;

    if (!ensureAccessToken(accessToken, res)) return;

    accountId = normalizeAccountId(accountId);
    if (!accountId) {
      return res.status(400).json({ ok: false, error: "Missing accountId" });
    }

    const url = `https://graph.facebook.com/v21.0/${accountId}/campaigns`;

    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields:
          "id,name,status,objective,daily_budget,created_time",
        limit: 500
      }
    });

    res.json({ ok: true, data: response.data });
  } catch (err) {
    console.error("Error in /api/meta/campaigns:", err?.response?.data || err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch campaigns",
      details: err?.response?.data || err.message
    });
  }
});

// ------------------------
// 5) Insights by Campaign
// ------------------------
// POST /api/meta/insights/:campaignId
// Body: { accessToken, timeRangePreset }
router.post("/insights/:campaignId", async (req, res) => {
  try {
    const { accessToken, timeRangePreset } = req.body || {};
    const { campaignId } = req.params;

    if (!ensureAccessToken(accessToken, res)) return;
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "Missing campaignId" });
    }

    // Zeitfenster bestimmen
    const now = new Date();
    const today = new Date(now.toISOString().split("T")[0]);

    let since;
    let until;

    switch (timeRangePreset) {
      case "today":
        since = today;
        until = now;
        break;
      case "yesterday":
        since = new Date(today.getTime() - 86400000);
        until = today;
        break;
      case "last_7d":
        since = new Date(today.getTime() - 7 * 86400000);
        until = today;
        break;
      case "last_14d":
        since = new Date(today.getTime() - 14 * 86400000);
        until = today;
        break;
      case "last_30d":
      default:
        since = new Date(today.getTime() - 30 * 86400000);
        until = today;
        break;
    }

    const formatDate = (d) => d.toISOString().split("T")[0];

    const url = `https://graph.facebook.com/v21.0/${campaignId}/insights`;

    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        time_range: JSON.stringify({
          since: formatDate(since),
          until: formatDate(until)
        }),
        fields:
          "impressions,clicks,spend,ctr,cpc,cpm,actions,action_values,website_purchase_roas",
        limit: 90
      }
    });

    res.json({ ok: true, data: response.data });
  } catch (err) {
    console.error("Insights ERROR:", err?.response?.data || err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch insights",
      details: err?.response?.data || err.message
    });
  }
});

// ------------------------
// 6) Ads inkl. Creatives
// ------------------------
// POST /api/meta/ads/:accountId
// Body: { accessToken }
router.post("/ads/:accountId", async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    let { accountId } = req.params;

    if (!ensureAccessToken(accessToken, res)) return;

    accountId = normalizeAccountId(accountId);
    if (!accountId) {
      return res.status(400).json({ ok: false, error: "Missing accountId" });
    }

    const url = `https://graph.facebook.com/v21.0/${accountId}/ads`;

    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields:
          "id,name,status,creative{object_story_spec,thumbnail_url},insights{impressions,clicks,spend,ctr,cpc,cpm,website_purchase_roas,actions,action_values}",
        limit: 500
      }
    });

    res.json({ ok: true, data: response.data });
  } catch (err) {
    console.error("Error in /api/meta/ads:", err?.response?.data || err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch ads",
      details: err?.response?.data || err.message
    });
  }
});

module.exports = router;
