import { useState } from "react";
import { callSlackWebhook } from "../lib/supabase";
import { sendSlackMessageWithFallbacks } from "../utils/slackProxy";

export const useSlackWebhook = (webhookUrl) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatMessage = (message, type) => {
    switch (type) {
      case "blocker":
        return `🚧 *Blocker Alert* 🚧\n\n` + message;
      case "kudos":
        return `🎉 *Kudos* 🎉\n\n` + message;
      case "burnout":
        return `🔥 *Burnout Alert* 🔥\n\n` + message;
      case "follow-up":
        return `🔄 *Follow-up Reminder* 🔄\n\n` + message;
      default:
        return message;
    }
  };

  const getEmojiForType = (type) => {
    switch (type) {
      case "blocker":
        return ":construction:";
      case "kudos":
        return ":tada:";
      case "burnout":
        return ":fire:";
      case "follow-up":
        return ":clock10:";
      default:
        return ":chart_with_upwards_trend:";
    }
  };

  const sendMessage = async (message, type = "info") => {
    if (!webhookUrl) {
      console.warn("No Slack webhook URL configured");
      setError("No webhook URL configured");
      return false;
    }

    setLoading(true);
    setError(null);

    console.log("🔄 Sending Slack message via Supabase:", {
      message,
      type,
      webhookUrl: webhookUrl.substring(0, 50) + "...",
    });

    try {
      // Try Supabase Edge Function ONLY (remove fallbacks for debugging)
      const result = await callSlackWebhook(
        formatMessage(message, type),
        webhookUrl,
        {
          username: "PulseTracker",
          icon_emoji: getEmojiForType(type),
        }
      );

      console.log("📤 Slack message result:", result);

      if (result.success) {
        console.log(
          "✅ Slack message sent successfully via Supabase Edge Function"
        );
        setLoading(false);
        return true;
      } else {
        console.error("❌ Supabase Edge Function failed:", result);
        setError(result);
        setLoading(false);
        return false;
      }
    } catch (err) {
      console.error("🚨 Slack webhook error:", err);
      setError({
        error: "SUPABASE_ERROR",
        message: `Supabase error: ${err.message}`,
      });
      setLoading(false);
      return false;
    }
  };

  const sendBlockerAlert = async (task, assignee) => {
    const message =
      `🚧 *Blocker Alert* 🚧\n\n` +
      `Task: *${task.name}*\n` +
      `Assignee: ${assignee}\n` +
      `Status: ${task.status?.status || "Unknown"}\n` +
      `Blocked for: ${task.hoursBlocked || 0} hours\n\n` +
      `Please check on this task and help unblock it! 🙏`;

    return await sendMessage(message);
  };

  const sendKudosMessage = async (teammate, achievements) => {
    const { commits, pullRequests, completedTasks } = achievements;

    let message = `🎉 *Kudos to ${teammate}!* 🎉\n\n`;

    if (commits > 0) message += `📝 ${commits} commits\n`;
    if (pullRequests > 0) message += `🔄 ${pullRequests} pull requests\n`;
    if (completedTasks > 0) message += `✅ ${completedTasks} tasks completed\n`;

    message += `\nKeep up the great work! 🚀`;

    return await sendMessage(message);
  };

  const sendBurnoutAlert = async (teammate, metrics) => {
    const message =
      `⚠️ *Burnout Alert* ⚠️\n\n` +
      `${teammate} might be experiencing high workload:\n\n` +
      `• Open tasks: ${metrics.openTasks}\n` +
      `• Recent activity: ${metrics.recentActivity}\n` +
      `• Ongoing PRs: ${metrics.ongoingPRs}\n\n` +
      `Consider checking in with them or redistributing some work. 💙`;

    return await sendMessage(message);
  };

  const sendFollowUpMessage = async (task, assignee) => {
    const message =
      `🔄 *Follow-up Reminder* 🔄\n\n` +
      `Task: *${task.name}* has been blocked for ${Math.floor(
        task.hoursBlocked / 24
      )} days\n` +
      `Assignee: ${assignee}\n\n` +
      `This task needs attention! Please:\n` +
      `• Check if it can be unblocked\n` +
      `• Reassign if needed\n` +
      `• Update status if work is in progress\n\n` +
      `Let's keep things moving! 🏃‍♂️`;

    return await sendMessage(message);
  };

  return {
    sendMessage,
    sendBlockerAlert,
    sendKudosMessage,
    sendBurnoutAlert,
    sendFollowUpMessage,
    loading,
    error,
  };
};
