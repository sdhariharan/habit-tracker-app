/**
 * firebase.js — Firebase Admin SDK (Server-side)
 *
 * Use this for server-side operations like:
 * - Verifying user tokens
 * - Running bulk aggregations
 * - Scheduled cleanup jobs
 *
 * Setup:
 * 1. Go to Firebase Console → Project Settings → Service accounts
 * 2. Click "Generate new private key" → download JSON
 * 3. Save as serviceAccountKey.json in /backend/
 * 4. NEVER commit this file to Git — add to .gitignore!
 */

const admin = require("firebase-admin");

let initialized = false;

function getAdminApp() {
  if (initialized) return admin;

  try {
    // Option A: Use downloaded service account key file
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId:  serviceAccount.project_id,
    });
  } catch (e) {
    // Option B: Use environment variable (for production/deployment)
    // Set GOOGLE_APPLICATION_CREDENTIALS env var to path of service account key
    // Or FIREBASE_SERVICE_ACCOUNT env var with JSON string
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId:  serviceAccount.project_id,
      });
    } else {
      console.warn("⚠  No Firebase service account found. Admin features disabled.");
      return null;
    }
  }

  initialized = true;
  return admin;
}

// Export Firestore db (admin)
function getAdminDb() {
  const a = getAdminApp();
  if (!a) return null;
  return a.firestore();
}

module.exports = { getAdminApp, getAdminDb };
