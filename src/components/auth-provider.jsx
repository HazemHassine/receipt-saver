"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth as getAuth, googleProvider as getGoogleProvider } from "@/lib/firebase";

const ALLOWED_EMAILS = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || "")
  .split(/[,;]/)
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isEmailAllowed(email) {
  if (ALLOWED_EMAILS.length === 0) return true; // no restriction if env not set
  return ALLOWED_EMAILS.includes(email?.toLowerCase());
}

const AuthContext = createContext({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (firebaseUser) => {
      if (firebaseUser && !isEmailAllowed(firebaseUser.email)) {
        // Unauthorized email — sign out and redirect
        await firebaseSignOut(getAuth());
        window.location.href = "https://google.com";
        return;
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const result = await signInWithPopup(getAuth(), getGoogleProvider());
      if (!isEmailAllowed(result.user.email)) {
        await firebaseSignOut(getAuth());
        window.location.href = "https://google.com";
        return;
      }
    } catch (error) {
      console.error("Sign-in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(getAuth());
    } catch (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
