// metaRoutes.js
// Stellt den Endpoint /api/meta/oauth/token bereit

const express = require("express");
const axios = require("axios");

const router = express.Router();

/**
 * POST /api/meta/oauth/token
 * Body: { code: string, redirectUri: string }
 *
 * Tauscht den OAuth-Code gegen ein Access Token bei Meta.
 */
router.post("/oauth/token", async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};

    if (!code || !redirectUri) {
      return res.status(400).json({
        error: "Missing 'code' or 'redirectUri' in request body."
      });
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const configuredRedirect = process.env.META_OAUTH_REDIRECT_URI;

    if (!appId || !appSecret || !configuredRedirect) {
      return res.status(500).json({
        error:
          "Server misconfigured. META_APP_ID, META_APP_SECRET oder META_OAUTH_REDIRECT_URI fehlen."
      });
    }

    // Sicherheits-Check: redirectUri aus Frontend muss mit ENV übereinstimmen
    if (redirectUri !== configuredRedirect) {
      return res.status(400).json({
        error: "redirectUri mismatch",
        details: {
          fromClient: redirectUri,
          configured: configuredRedirect
        }
      });
    }

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code
    });

    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`;

    const metaResponse = await axios.get(tokenUrl);
    const data = metaResponse.data;

    // data enthält: access_token, token_type, expires_in
    return res.json({
      success: true,
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      raw: data
    });
  } catch (err) {
    console.error("Meta token exchange error:", err.response?.data || err.message);

    return res.status(400).json({
      error: "Meta token exchange failed",
      meta: err.response?.data || err.message
    });
  }
});

// Kleiner Debug-Endpoint zum Testen, ob ENV geladen sind
router.get("/debug/env", (req, res) => {
  res.json({
    META_APP_ID: process.env.META_APP_ID || null,
    META_APP_SECRET_PRESENT: !!process.env.META_APP_SECRET,
    META_OAUTH_REDIRECT_URI: process.env.META_OAUTH_REDIRECT_URI || null
  });
});

module.exports = router;
