const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const Database = require('better-sqlite3');

// Connexion à la base de données (même que ton bot)
const db = new Database(path.join(__dirname, '..', 'database.sqlite'));

const app = express();

// ================= CONFIGURATION =================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= SESSION =================
app.use(session({
    secret: process.env.SESSION_SECRET || 'architect-cg223-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 heures
}));

// ================= PASSPORT OAUTH2 =================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DASHBOARD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    // Vérifier si l'utilisateur est le OWNER
    profile.isOwner = profile.id === process.env.OWNER_ID;
    return done(null, profile);
}));

app.use(passport.initialize());
app.use(passport.session());

// ================= VARIABLES GLOBALES POUR LES VUES =================
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.isOwner = req.user?.isOwner || false;
    next();
});

// ================= MIDDLEWARE D'AUTHENTIFICATION =================
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

function isOwner(req, res, next) {
    if (req.isAuthenticated() && req.user.isOwner) return next();
    res.status(403).render('error', { 
        message: 'Access Denied', 
        error: 'You must be the bot owner to access this page.' 
    });
}

// ================= ROUTES PAGES =================
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.render('login');
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
    passport.authenticate('discord', { 
        failureRedirect: '/login',
        successRedirect: '/dashboard'
    })
);

app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Récupérer les stats depuis ta vraie base de données
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalCredits = db.prepare('SELECT SUM(credits) as total FROM users').get().total || 0;
        const totalXP = db.prepare('SELECT SUM(xp) as total FROM users').get().total || 0;
        const topUsers = db.prepare('SELECT username, level, xp FROM users ORDER BY xp DESC LIMIT 5').all();
        
        // Stats système
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const stats = {
            totalUsers,
            totalCredits: totalCredits.toLocaleString(),
            totalXP: totalXP.toLocaleString(),
            topUsers,
            memory: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
            uptime: Math.floor(uptime / 3600) + 'h ' + Math.floor((uptime % 3600) / 60) + 'm',
            ping: 'Calculating...'
        };
        
        res.render('dashboard', { stats });
    } catch (err) {
        console.error('[DASHBOARD] Error:', err);
        res.render('dashboard', { 
            stats: { totalUsers: 0, totalCredits: 0, totalXP: 0, topUsers: [], memory: 0, uptime: '0h 0m', ping: 0 }
        });
    }
});

app.get('/dashboard/admin', isOwner, (req, res) => {
    res.render('admin', {
        version: require('../package.json').version || '1.6.1',
        nodeVersion: process.version,
        platform: process.platform
    });
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// ================= API REST =================
app.get('/api/stats', isAuthenticated, (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE last_seen > datetime("now", "-1 day")').get().count;
        
        res.json({
            success: true,
            data: {
                users: totalUsers,
                activeUsers,
                timestamp: Date.now()
            }
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ================= DÉMARRAGE =================
function startDashboard(client) {
    const PORT = process.env.DASHBOARD_PORT || 3000;
    
    // Rendre le client Discord accessible dans les routes
    app.locals.client = client;
    app.locals.db = db;
    
    app.listen(PORT, () => {
        console.log(`\x1b[32m[DASHBOARD]\x1b[0m 🌐 Running on http://localhost:${PORT}`);
        console.log(`\x1b[36m[DASHBOARD]\x1b[0m 📱 Access via: http://your-server:${PORT}`);
    });
    
    return app;
}

module.exports = { startDashboard };