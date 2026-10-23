export const dynamic = "force-dynamic";
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  };
  const source = config.apiKey && config.messagingSenderId ? `importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');\nimportScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');\nfirebase.initializeApp(${JSON.stringify(config)});\nfirebase.messaging();\n` : "// Firebase Messaging is not configured for this deployment.\n";
  return new Response(source, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store", "Service-Worker-Allowed": "/", "X-Content-Type-Options": "nosniff" } });
}
