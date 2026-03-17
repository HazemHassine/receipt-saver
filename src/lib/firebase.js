import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app;
let _auth;
let _googleProvider;

function getApp() {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

function getFirebaseAuth() {
  if (!_auth) {
    _auth = getAuth(getApp());
  }
  return _auth;
}

function getGoogleProvider() {
  if (!_googleProvider) {
    _googleProvider = new GoogleAuthProvider();
  }
  return _googleProvider;
}

export { getApp as app, getFirebaseAuth as auth, getGoogleProvider as googleProvider };
