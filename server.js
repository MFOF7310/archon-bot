// ============================================================
// Archon Engine — Backend API Server
// Deployed on: Bot Hosting Panel (Pterodactyl)
// Bridge: localtunnel → public HTTPS
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();

// ============================================================
// 1. CORS — Only allow your GitHub Pages frontend
// ============================================================
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(cookieParser());

// ============================================================
// 2. LOCALTUNNEL BYPASS — Allows API calls without password page
// ============================================================
app.use((req, res, next) => {
    res.setHeader('bypass-tunnel-reminder', 'true');
    next();
});

// ============================================================
// 3. REAL-TIME BOT STATS ENDPOINT
// Pulls live data from global.client (your discord.js bot)
// ============================================================
app.get('/api/stats', async (req, res) => {
    try {
        const servers = global.client.guilds.cache.size;
        const users = global.client.guilds.cache.reduce(
            (total, guild) => total + guild.memberCount, 0
        );
        const ping = Math.round(global.client.ws.ping);

        return res.json({
            servers: servers.toLocaleString(),
            users: users.toLocaleString(),
            ping: ping
        });
    } catch (error) {
        console.error('[API] Stats endpoint error:', error);
        return res.status(500).json({ error: 'Failed to fetch bot stats' });
    }
});

// ============================================================
// 4. OAUTH2 — Login Redirect
// Sends user to Discord authorization page
// ============================================================
app.get('/api/auth/login', (req, res) => {
    try {
        const authUrl = new URL('https://discord.com/api/oauth2/authorize');
        authUrl.searchParams.append('client_id', process.env.DISCORD_CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', process.env.REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', 'identify guilds');

        // CSRF protection
        const state = Math.random().toString(36).substring(2, 15);
        authUrl.searchParams.append('state', state);

        res.cookie('oauth_state', state, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 5 * 60 * 1000
        });

        console.log('[AUTH] Redirecting user to Discord OAuth2...');
        res.redirect(authUrl.toString());
    } catch (error) {
        console.error('[AUTH] Login redirect error:', error);
        res.status(500).send('Authentication service temporarily unavailable.');
    }
});

// ============================================================
// 5. OAUTH2 — Callback Endpoint
// Discord redirects here after user authorizes
// ============================================================
app.get('/api/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;

    // CSRF validation
    if (!state || state !== storedState) {
        console.error('[AUTH] State mismatch — possible CSRF attack');
        return res.status(403).send('Invalid state parameter. Authentication rejected.');
    }

    res.clearCookie('oauth_state');

    if (!code) {
        return res.status(400).send('Authorization code not provided by Discord.');
    }

    try {
        // Exchange code for access token
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', process.env.DISCORD_CLIENT_ID);
        tokenParams.append('client_secret', process.env.DISCORD_CLIENT_SECRET);
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('code', code);
        tokenParams.append('redirect_uri', process.env.REDIRECT_URI);

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: tokenParams,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('[AUTH] Token exchange failed:', errorText);
            return res.status(500).send('Failed to authenticate with Discord. Please try again.');
        }

        const tokenData = await tokenResponse.json();
        const { access_token } = tokenData;

        // Fetch user profile
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        if (!userResponse.ok) {
            console.error('[AUTH] Failed to fetch user profile');
            return res.status(500).send('Failed to retrieve your Discord profile.');
        }

        const userData = await userResponse.json();

        // Create JWT session
        const sessionPayload = {
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar,
            authenticatedAt: Date.now()
        };

        const sessionToken = jwt.sign(
            sessionPayload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set HttpOnly secure cookie
        res.cookie('session', sessionToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        console.log(`[AUTH] User authenticated: ${userData.username}#${userData.discriminator} (${userData.id})`);

        // Redirect back to GitHub Pages
        const frontendHome = `${process.env.FRONTEND_URL}/archon-engine-web/docs/index.html`;
        res.redirect(frontendHome);

    } catch (error) {
        console.error('[AUTH] Callback processing error:', error);
        res.status(500).send('Authentication process failed. Please try again.');
    }
});

// ============================================================
// 6. AUTH CHECK — Frontend verifies login state
// ============================================================
app.get('/api/auth/me', (req, res) => {
    const sessionToken = req.cookies.session;

    if (!sessionToken) {
        return res.status(401).json({ authenticated: false });
    }

    try {
        const userData = jwt.verify(sessionToken, process.env.JWT_SECRET);
        return res.json({
            authenticated: true,
            user: {
                id: userData.id,
                username: userData.username,
                avatar: userData.avatar
            }
        });
    } catch (error) {
        return res.status(401).json({ authenticated: false });
    }
});

// ============================================================
// 7. LOGOUT
// ============================================================
app.get('/api/auth/logout', (req, res) => {
    res.clearCookie('session');
    res.redirect(process.env.FRONTEND_URL);
});

// ============================================================
// 8. HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'operational', timestamp: Date.now() });
});

module.exports = app;