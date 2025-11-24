// metaRoutes.js
import express from "express";
import axios from "axios";

const router = express.Router();

// Load env variables
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

// ---------- TOKEN EXCHANGE ----------
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
      },
    });

    return res.json({
      success: true,
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in
    });
  } catch (error) {
    console.error("OAuth token exchange failed:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error: "OAuth token exchange failed",
      details: error.response?.data
    });
  }
});

// ---------- HEALTH ----------
router.get("/oauth/debug/env", (req, res) => {
  res.json({
    META_APP_ID: META_APP_ID ? "OK" : "MISSING",
    META_APP_SECRET: META_APP_SECRET ? "SET" : "MISSING",
  });
});

export default router;
