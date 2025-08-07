import { createClient } from "@supabase/supabase-js";

// These will be your actual Supabase project URL and anon key
// Note: Vite uses import.meta.env instead of process.env
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://prchfhtstqtuqezwalhm.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByY2hmaHRzdHF0dXFlendhbGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODY5NDcsImV4cCI6MjA2OTk2Mjk0N30.ojGQGpvAKqqLCzcGwgZ-dEaL95Dh23ajCa0nmGiMN6g";

// Debug: Log what credentials are being used
console.log("🔧 Supabase Config:", {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey.substring(0, 20) + "...",
  hasEnvUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasEnvKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to call our Slack webhook Edge Function
export const callSlackWebhook = async (text, webhookUrl, options = {}) => {
  console.log("🔄 Calling Supabase Edge Function:", {
    url: supabaseUrl,
    text:
      text && typeof text === "string"
        ? text.substring(0, 50) + "..."
        : "[No text or invalid format]",
    webhookUrl: webhookUrl
      ? webhookUrl.substring(0, 50) + "..."
      : "[No webhook URL]",
  });

  try {
    // Ensure text is a string
    const messageText =
      text && typeof text === "string" ? text : JSON.stringify(text);

    // Try the Supabase client method first
    const { data, error } = await supabase.functions.invoke("slack-webhook", {
      body: {
        text: messageText,
        webhookUrl,
        channel: options.channel,
        username: options.username || "PulseTracker",
        icon_emoji: options.icon_emoji || "📊",
      },
    });

    if (error) {
      console.error("❌ Supabase function error:", error);

      // If the client method fails, try direct HTTP request
      console.log("🔄 Trying direct HTTP request to Edge Function...");
      return await callEdgeFunctionDirectly(text, webhookUrl, options);
    }

    console.log("✅ Supabase function success:", data);
    return (
      data || { success: true, message: "Slack message sent successfully" }
    );
  } catch (error) {
    console.error("❌ Supabase client failed, trying direct HTTP:", error);

    // Fallback to direct HTTP request
    return await callEdgeFunctionDirectly(text, webhookUrl, options);
  }
};

// Direct HTTP call to Edge Function as fallback
const callEdgeFunctionDirectly = async (text, webhookUrl, options = {}) => {
  try {
    const functionUrl = `${supabaseUrl}/functions/v1/slack-webhook`;

    console.log("🔄 Making direct HTTP request to:", functionUrl);

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        text,
        webhookUrl,
        channel: options.channel,
        username: options.username || "PulseTracker",
        icon_emoji: options.icon_emoji || "📊",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ Direct HTTP request failed:",
        response.status,
        errorText
      );
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Direct HTTP request success:", result);
    return result;
  } catch (error) {
    console.error("❌ Direct HTTP request failed:", error);
    return {
      success: false,
      error: "EDGE_FUNCTION_ERROR",
      message: `Edge Function error: ${error.message}`,
    };
  }
};
