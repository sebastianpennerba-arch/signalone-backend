// metaRoutes.js (CommonJS)

const express = require("express");
const axios = require("axios");

const router = express.Router();

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

// ---------------- TOKEN EXCHANGE ----------------
router.post("/oauth/token", async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: "Missing code or redirectUri"
      });
    }

    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token`;

    const response = await axios.get(tokenUrl, {
      params: {
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: redirectUri,
        code
      }
    });

    res.json({
      success: true,
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in
    });

  } catch (err) {
    console.error("Token exchange failed:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: "OAuth token exchange failed",
      details: err.response?.data
    });
  }
});

// ---------------- DEBUG ----------------
router.get("/oauth/debug/env", (req, res) => {
  res.json({
    META_APP_ID: META_APP_ID ? "OK" : "MISSING",
    META_APP_SECRET: META_APP_SECRET ? "SET" : "MISSING"
  });
});

module.exports = router;
