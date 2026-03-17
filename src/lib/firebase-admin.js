import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let _adminApp;
let _adminAuth;
let _db;

function getAdminApp() {
  if (_adminApp) return _adminApp;

  if (getApps().length > 0) {
    _adminApp = getApps()[0];
    return _adminApp;
  }

  const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  };

  // Use service account key if explicitly provided
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      config.credential = cert(serviceAccount);
    } catch {
      // Fall back to Application Default Credentials
    }
  }

  _adminApp = initializeApp(config);
  return _adminApp;
}

function getAdminAuth() {
  if (!_adminAuth) {
    _adminAuth = getAuth(getAdminApp());
  }
  return _adminAuth;
}

function getDb() {
  if (!_db) {
    _db = getFirestore(getAdminApp());
  }
  return _db;
}

// Export as getters so they initialize lazily at runtime, not at build time
export const adminAuth = {
  verifyIdToken: (...args) => getAdminAuth().verifyIdToken(...args),
};

export const db = {
  collection: (...args) => getDb().collection(...args),
};
