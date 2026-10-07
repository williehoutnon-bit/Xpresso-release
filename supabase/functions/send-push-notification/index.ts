// Supabase Edge Function: send-push-notification
// Dispatches Firebase Cloud Messaging (FCM) v1 payloads to recipient device tokens.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";

interface PushRequest {
  record?: any; // For database webhooks
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  content?: string;
  type?: string;
}

// Generate Google OAuth2 Access Token for FCM HTTP v1 using Service Account JSON
async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodeBase64Url = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(claimSet)}`;

  // Import Private Key (PKCS8 formatted PEM)
  const pem = serviceAccount.private_key;
  const binaryDer = Uint8Array.from(
    atob(
      pem
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s+/g, "")
    ),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureBase64Url = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signatureBase64Url}`;

  // Exchange JWT for OAuth2 token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Google Auth token exchange failed: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const payload: PushRequest = await req.json();

    // Support both direct API invocation and Database Webhooks
    const record = payload.record || {};
    const conversationId = payload.conversationId || record.conversation_id || record.conversationId;
    const senderId = payload.senderId || record.sender_id || record.senderId;
    const content = payload.content || record.content || "New message";

    if (!conversationId || !senderId) {
      return new Response(JSON.stringify({ error: "Missing conversationId or senderId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Find participants in this conversation (excluding sender)
    const { data: participants, error: partError } = await supabase
      .from("participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", senderId);

    if (partError || !participants || participants.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const recipientUserIds = participants.map((p) => p.user_id);

    // 2. Fetch sender profile for display name
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name, name")
      .eq("user_id", senderId)
      .single();

    const senderDisplayName =
      payload.senderName || senderProfile?.full_name || senderProfile?.name || "Xpresso Contact";

    // 3. Fetch active push tokens for all recipients
    const { data: tokenRows, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("id, token, user_id")
      .in("user_id", recipientUserIds);

    if (tokenError || !tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ message: "No registered device tokens found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Authenticate with FCM v1 if service account secret is present
    if (!FIREBASE_SERVICE_ACCOUNT) {
      console.warn("FIREBASE_SERVICE_ACCOUNT secret not configured. Skipping remote push.");
      return new Response(
        JSON.stringify({
          message: "Tokens found, but FIREBASE_SERVICE_ACCOUNT secret not configured in Supabase.",
          recipientCount: tokenRows.length,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // 5. Send FCM message to each token
    const results = await Promise.all(
      tokenRows.map(async (row) => {
        const fcmPayload = {
          message: {
            token: row.token,
            notification: {
              title: senderDisplayName,
              body: content.length > 120 ? content.slice(0, 117) + "..." : content,
            },
            data: {
              conversationId,
              senderId,
              senderName: senderDisplayName,
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "xpresso_messages",
                icon: "ic_launcher_foreground",
                color: "#0050D8",
                sound: "default",
                default_vibrate_timings: true,
                notification_count: 1, // Increments native app badge
              },
            },
          },
        };

        const fcmRes = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fcmPayload),
        });

        if (!fcmRes.ok) {
          const errData = await fcmRes.json().catch(() => ({}));
          // Auto-prune uninstalled or expired tokens
          if (errData?.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED")) {
            await supabase.from("user_push_tokens").delete().eq("id", row.id);
            console.info(`Pruned expired token: ${row.token}`);
          }
          return { token: row.token, success: false, error: errData };
        }

        return { token: row.token, success: true };
      })
    );

    return new Response(JSON.stringify({ delivered: results.filter((r) => r.success).length, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Push dispatcher error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
