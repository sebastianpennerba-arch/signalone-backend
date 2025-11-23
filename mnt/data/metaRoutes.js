// metaRoutes.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

// DEBUG ENDPOINT – prüft ENV Variablen unterwegs
router.get("/oauth/debug/env", (req, res) => {
  return res.json({
    META_APP_ID: process.env.META_APP_ID || null,
    META_APP_SECRET_PRESENT: !!process.env.META_APP_SECRET,
    META_OAUTH_REDIRECT_URI: process.env.META_OAUTH_REDIRECT_URI || null
  });
});

// ------------------
// TOKEN-Austausch
// ------------------
router.post("/oauth/token", async (req, res) => {
  const { code, redirectUri } = req.body;

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const configuredRedirect = process.env.META_OAUTH_REDIRECT_URI;

  if (!appId || !appSecret || !configuredRedirect) {
    return res.status(500).json({
      error: "Server misconfigured",
      details: {
        META_APP_ID: !!appId,
        META_APP_SECRET: !!appSecret,
        META_OAUTH_REDIRECT_URI: !!configuredRedirect
      }
    });
  }

  if (redirectUri !== configuredRedirect) {
    return res.status(400).json({
      error: "redirectUri mismatch",
      received: redirectUri,
      expected: configuredRedirect
    });
  }

  try {
    const tokenUrl = "https://graph.facebook.com/v21.0/oauth/access_token";

    const response = await axios.get(tokenUrl, {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: configuredRedirect,
        code: code
      },
    });

    return res.json({
      success: true,
      accessToken: response.data.access_token,
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in,
      raw: response.data
    });

  } catch (err) {
    return res.status(500).json({
      error: "token_exchange_failed",
      message: err.response?.data || err.message
    });
  }
});

module.exports = router;
