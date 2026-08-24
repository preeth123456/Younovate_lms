// src/utils/tokenUtils.js
'use strict';
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const generateSessionToken = () => crypto.randomBytes(32).toString('hex');

const generateAccessToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role, sessionToken: user.sessionToken },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    { userId: user._id, sessionToken: user.sessionToken },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

/** Cookie options for Vercel frontend → Render API (cross-site). */
function refreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure:   isProduction,
  // strict blocks cookies on cross-origin requests (Vercel ≠ Render)
    sameSite: isProduction ? 'none' : 'lax',
    path:     '/',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  };
}

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, refreshCookieOptions());
};

const clearAuthCookies = (res) => {
  const opts = refreshCookieOptions();
  res.clearCookie('refreshToken', {
    httpOnly: opts.httpOnly,
    secure:   opts.secure,
    sameSite: opts.sameSite,
    path:     opts.path,
  });
  res.clearCookie('accessToken', { path: '/' });
};

module.exports = {
  generateSessionToken,
  generateAccessToken,
  generateRefreshToken,
  setRefreshCookie,
  clearAuthCookies,
  refreshCookieOptions,
};
