/**
 * FLUX — Backend Server
 * server.js — Express static server + optional API layer
 *
 * This server:
 * 1. Serves the frontend (index.html, style.css, app.js)
 * 2. Provides optional REST endpoints (useful for server-side logic later)
 * 3. Acts as a proxy-safe layer for Firebase Admin SDK if needed
 *
 * Run: node server.js
 */

const express = require("express");
const path    = require("path");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── MIDDLEWARE ── */
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

/* ── HEALTH CHECK ── */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * Optional: Server-side stats aggregation endpoint
 * Could be used to pre-aggregate data using Firebase Admin SDK
 * Currently returns a placeholder — extend as needed
 */
app.get("/api/stats/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    // TODO: Use Firebase Admin SDK here for server-side queries
    // const admin = require("./firebase");
    // const stats = await computeStats(uid);
    res.json({ uid, message: "Use Firebase Admin SDK to compute server-side stats." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── CATCH-ALL → Serve index.html (SPA fallback) ── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

/* ── START ── */
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════╗
  ║   FLUX Task Tracker — Running     ║
  ║   http://localhost:${PORT}           ║
  ╚═══════════════════════════════════╝
  `);
});
