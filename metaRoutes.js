// ============================================================
// Meta API Routes - Fixed Version
// Added: Input validation, Request timeouts, Better error handling
// ============================================================

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Environment Variables
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const DEFAULT_REDIRECT_URI = process.env.META_OAUTH_REDIRECT_URI;

// Constants
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_TOKEN_LENGTH = 500;
const MIN_TOKEN_LENGTH = 50;

// ============================================================
// VALIDATION HELPERS
// ============================================================

function validateAccessToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token format');
  }
  
  const trimmed = token.trim();
  
  if (trimmed.length < MIN_TOKEN_LENGTH || trimmed.length > MAX_TOKEN_LENGTH) {
    throw new Error('Token length out of valid range');
  }
  
  return trimmed;
}

function normalizeAccountId(id) {
  if (!id) return null;
  const str = String(id);
  return str.startsWith('act_') ? str : `act_${str}`;
}

function metaHeaders(accessToken) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

function ensureEnvVars() {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID or META_APP_SECRET not configured');
  }
}

// ============================================================
// 1. OAUTH TOKEN EXCHANGE
// ============================================================

router.post('/oauth/token', async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    
    // Validate input
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid code in request body'
      });
    }
    
    ensureEnvVars();
    
    const finalRedirectUri = redirectUri || DEFAULT_REDIRECT_URI;
    
    if (!finalRedirectUri) {
      return res.status(500).json({
        ok: false,
        error: 'No redirectUri provided and META_OAUTH_REDIRECT_URI not set'
      });
    }
    
    // Exchange code for token
    const url = 'https://graph.facebook.com/v21.0/oauth/access_token';
    const response = await axios.get(url, {
      params: {
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: finalRedirectUri,
        code: code
      },
      timeout: REQUEST_TIMEOUT
    });
    
    const data = response.data;
    
    return res.json({
      ok: true,
      success: true,
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      raw: data
    });
    
  } catch (err) {
    console.error('Error in /api/meta/oauth/token:', err?.response?.data || err.message);
    next({
      statusCode: 500,
      message: 'Meta token exchange failed',
      details: err?.response?.data || err.message
    });
  }
});

// ============================================================
// 2. USER PROFILE
// ============================================================

router.post('/me', async (req, res, next) => {
  try {
    const accessToken = validateAccessToken(req.body.accessToken);
    
    const url = 'https://graph.facebook.com/v21.0/me';
    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields: 'id,name,email'
      },
      timeout: REQUEST_TIMEOUT
    });
    
    res.json({
      ok: true,
      data: response.data
    });
    
  } catch (err) {
    console.error('Error in /api/meta/me:', err?.response?.data || err.message);
    next({
      statusCode: err?.response?.status || 500,
      message: 'Failed to fetch user profile',
      details: err?.response?.data || err.message
    });
  }
});

// ============================================================
// 3. AD ACCOUNTS
// ============================================================

router.post('/adaccounts', async (req, res, next) => {
  try {
    const accessToken = validateAccessToken(req.body.accessToken);
    
    const url = 'https://graph.facebook.com/v21.0/me/adaccounts';
    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields: 'id,name,account_status,currency,timezone_name',
        limit: 200
      },
      timeout: REQUEST_TIMEOUT
    });
    
    res.json({
      ok: true,
      data: response.data
    });
    
  } catch (err) {
    console.error('Error in /api/meta/adaccounts:', err?.response?.data || err.message);
    next({
      statusCode: err?.response?.status || 500,
      message: 'Failed to fetch ad accounts',
      details: err?.response?.data || err.message
    });
  }
});

// ============================================================
// 4. CAMPAIGNS BY ACCOUNT
// ============================================================

router.post('/campaigns/:accountId', async (req, res, next) => {
  try {
    const accessToken = validateAccessToken(req.body.accessToken);
    let accountId = req.params.accountId;
    
    accountId = normalizeAccountId(accountId);
    
    if (!accountId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid accountId'
      });
    }
    
    const url = `https://graph.facebook.com/v21.0/${accountId}/campaigns`;
    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields: 'id,name,status,objective,daily_budget,created_time',
        limit: 500
      },
      timeout: REQUEST_TIMEOUT
    });
    
    res.json({
      ok: true,
      data: response.data
    });
    
  } catch (err) {
    console.error('Error in /api/meta/campaigns:', err?.response?.data || err.message);
    next({
      statusCode: err?.response?.status || 500,
      message: 'Failed to fetch campaigns',
      details: err?.response?.data || err.message
    });
  }
});

// ============================================================
// 5. INSIGHTS BY CAMPAIGN
// ============================================================

router.post('/insights/:campaignId', async (req, res, next) => {
  try {
    const { accessToken, timeRangePreset } = req.body;
    const campaignId = req.params.campaignId;
    
    validateAccessToken(accessToken);
    
    if (!campaignId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing campaignId'
      });
    }
    
    // Calculate time range
    const now = new Date();
    const today = new Date(now).toISOString().split('T')[0];
    let since, until;
    
    switch (timeRangePreset) {
      case 'today':
        since = today;
        until = now;
        break;
      case 'yesterday':
        since = new Date(new Date(today).getTime() - 86400000);
        until = today;
        break;
      case 'last_7d':
        since = new Date(new Date(today).getTime() - 7 * 86400000);
        until = today;
        break;
      case 'last_14d':
        since = new Date(new Date(today).getTime() - 14 * 86400000);
        until = today;
        break;
      case 'last_30d':
      default:
        since = new Date(new Date(today).getTime() - 30 * 86400000);
        until = today;
        break;
    }
    
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    const url = `https://graph.facebook.com/v21.0/${campaignId}/insights`;
    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        time_range: JSON.stringify({
          since: formatDate(since),
          until: formatDate(until)
        }),
        fields: 'impressions,clicks,spend,ctr,cpc,cpm,actions,action_values,website_purchase_roas',
        limit: 90
      },
      timeout: REQUEST_TIMEOUT
    });
    
    res.json({
      ok: true,
      data: response.data
    });
    
  } catch (err) {
    console.error('Insights ERROR:', err?.response?.data || err.message);
    next({
      statusCode: err?.response?.status || 500,
      message: 'Failed to fetch insights',
      details: err?.response?.data || err.message
    });
  }
});

// ============================================================
// 6. ADS INCLUDING CREATIVES
// ============================================================

router.post('/ads/:accountId', async (req, res, next) => {
  try {
    const accessToken = validateAccessToken(req.body.accessToken);
    let accountId = req.params.accountId;
    
    accountId = normalizeAccountId(accountId);
    
    if (!accountId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid accountId'
      });
    }
    
    const url = `https://graph.facebook.com/v21.0/${accountId}/ads`;
    const response = await axios.get(url, {
      headers: metaHeaders(accessToken),
      params: {
        fields: 'id,name,status,creative{object_story_spec,thumbnail_url},insights{impressions,clicks,spend,ctr,cpc,cpm,website_purchase_roas,actions,action_values}',
        limit: 500
      },
      timeout: REQUEST_TIMEOUT
    });
    
    res.json({
      ok: true,
      data: response.data
    });
    
  } catch (err) {
    console.error('Error in /api/meta/ads:', err?.response?.data || err.message);
    next({
      statusCode: err?.response?.status || 500,
      message: 'Failed to fetch ads',
      details: err?.response?.data || err.message
    });
  }
});

module.exports = router;
