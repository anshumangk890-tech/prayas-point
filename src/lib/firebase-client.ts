"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const FIREBASE_APP_NAME = "prayas-point-web";

export function getPhoneAuth() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error("Firebase phone sign-in has not been configured for this deployment.");
  }

  const app = getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME) ??
    initializeApp({
      apiKey,
      authDomain,
      projectId,
      appId,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    }, FIREBASE_APP_NAME);

  return getAuth(app);
}
