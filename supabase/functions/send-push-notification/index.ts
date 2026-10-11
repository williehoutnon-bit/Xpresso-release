// Supabase Edge Function: send-push-notification
// Dispatches Firebase Cloud Messaging (FCM) v1 payloads to recipient device tokens.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushRequest {
  record?: any; // For database webhooks
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  content?: string;
  type?: string;
  recipientId?: string;
  recipientIds?: string[];
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

  // Robust PEM cleaning: strips delimiters, literal \n, raw newlines, carriage returns, and spaces
  const pem = serviceAccount.private_key || "";
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/[\r\n\s]/g, "");

  const binaryDer = Uint8Array.from(
    atob(cleanPem),
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
    throw new Error(`Google Auth token exchange failed: ${data.error_description || data.error || JSON.stringify(data)}`);
  }

  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PushRequest = await req.json();

    // Support both direct API invocation and Database Webhooks
    const record = payload.record || {};
    const conversationId = payload.conversationId || record.conversation_id || record.conversationId;
    const senderId = payload.senderId || record.sender_id || record.senderId;
    const content = payload.content ?? record.content ?? "";
    const msgType = payload.type || record.type || "text";

    if (!conversationId && !payload.recipientId && (!payload.recipientIds || payload.recipientIds.length === 0)) {
      return new Response(JSON.stringify({ error: "Missing conversationId or recipient target" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Determine target recipient user IDs
    let recipientUserIds: string[] = [];
    const directRecipients = payload.recipientIds || (payload.recipientId ? [payload.recipientId] : []);

    if (directRecipients.length > 0) {
      recipientUserIds = directRecipients.filter((id) => id && id !== senderId);
    } else if (conversationId) {
      // Find participants in this conversation (excluding sender)
      const { data: participants, error: partError } = await supabase
        .from("participants")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", senderId || "");

      if (participants && participants.length > 0) {
        recipientUserIds = participants.map((p) => p.user_id).filter(Boolean);
      } else if (partError) {
        console.warn("Error fetching participants:", partError);
      }
    }

    if (recipientUserIds.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients to notify", conversationId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch sender profile for display name
    let senderDisplayName = payload.senderName || "Xpresso Contact";
    if (senderId) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name, name, surname, last_name")
        .eq("user_id", senderId)
        .maybeSingle();

      if (senderProfile) {
        senderDisplayName =
          payload.senderName ||
          senderProfile.full_name ||
          senderProfile.name ||
          `${senderProfile.surname || ""} ${senderProfile.last_name || ""}`.trim() ||
          "Xpresso Contact";
      }
    }

    // 3. Fetch active push tokens for all recipients
    const { data: tokenRows, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("id, token, user_id")
      .in("user_id", recipientUserIds);

    if (tokenError || !tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No registered device push tokens found for recipients",
          recipients: recipientUserIds,
          tokenError: tokenError?.message || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Authenticate with FCM v1 if service account secret is present
    if (!FIREBASE_SERVICE_ACCOUNT) {
      console.warn("FIREBASE_SERVICE_ACCOUNT secret not configured in Supabase. Skipping remote push.");
      return new Response(
        JSON.stringify({
          message: "Tokens found, but FIREBASE_SERVICE_ACCOUNT secret not configured in Supabase.",
          recipientTokensCount: tokenRows.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Safely parse service account JSON (supports raw JSON or base64)
    let serviceAccount: any;
    try {
      const trimmed = FIREBASE_SERVICE_ACCOUNT.trim();
      if (trimmed.startsWith("{")) {
        serviceAccount = JSON.parse(trimmed);
      } else {
        serviceAccount = JSON.parse(atob(trimmed));
      }
    } catch (parseErr: any) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT secret:", parseErr);
      return new Response(
        JSON.stringify({ error: `Invalid FIREBASE_SERVICE_ACCOUNT format: ${parseErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // 5. Construct notification body based on message type
    let preview = content.trim();
    if (!preview) {
      if (msgType === "image") preview = "📷 Photo";
      else if (msgType === "audio") preview = "🎤 Voice message";
      else if (msgType === "file") preview = "📎 Attachment";
      else preview = "New message";
    } else if (preview.length > 120) {
      preview = preview.slice(0, 117) + "...";
    }

    // 6. Send high-priority FCM message to each token
    const results = await Promise.all(
      tokenRows.map(async (row) => {
        const fcmPayload = {
          message: {
            token: row.token,
            notification: {
              title: senderDisplayName,
              body: preview,
            },
            data: {
              conversationId: String(conversationId || ""),
              senderId: String(senderId || ""),
              senderName: String(senderDisplayName || ""),
              type: String(msgType || "text"),
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "xpresso_messages",
                icon: "ic_launcher_foreground",
                color: "#0050D8",
                sound: "default",
                default_vibrate_timings: true,
                notification_count: 1, // Updates launcher badge counter
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
          console.warn(`FCM delivery failed for token ${row.token.substring(0, 15)}...:`, errData);
          // Auto-prune uninstalled or expired tokens
          if (
            errData?.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED") ||
            errData?.error?.message?.includes("not a valid FCM registration token")
          ) {
            await supabase.from("user_push_tokens").delete().eq("id", row.id);
            console.info(`Pruned expired token: ${row.token}`);
          }
          return { token: row.token, success: false, error: errData };
        }

        return { token: row.token, success: true };
      })
    );

    const deliveredCount = results.filter((r) => r.success).length;
    return new Response(
      JSON.stringify({ delivered: deliveredCount, total: results.length, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Push dispatcher error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
