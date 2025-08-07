import { useEffect, useRef, useState } from "react";
import { useSlackWebhook } from "./useSlackWebhook";

/**
 * Hook to monitor team health and send alerts when it drops below a threshold
 * @param {Object} metrics - Team metrics object containing health score and other metrics
 * @param {number} [healthThreshold=50] - Threshold percentage to trigger alerts (default: 50%)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.enabled=true] - Whether the alerting is enabled
 * @param {string} [options.channel='#team-alerts'] - Slack channel to send alerts to
 * @returns {Object} Hook state and controls
 */
export const useTeamHealthAlert = (
  metrics,
  healthThreshold = 50,
  options = {}
) => {
  const [settings, setSettings] = useState({
    github: {
      token: "",
      repos: [],
    },
    clickup: {
      token: "",
      teamId: "",
      boardIds: [],
      listIds: [],
    },
    slack: {
      webhookUrl: "",
    },
    team: {
      members: [],
    },
  });
  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("pulsetracker-settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }
  }, []);
  const { enabled = true, channel = "#hackathon-pulsetracker" } = options;
  const WEBHOOK_URL =
    "https://hooks.slack.com/services/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";
  const { sendMessage } = useSlackWebhook(WEBHOOK_URL);
  const lastAlertTime = useRef(0);
  const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours cooldown between alerts

  // Throttle function
  const throttle = (func, limit) => {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  };

  // Format the alert message with rich formatting for Slack
  const formatAlertMessage = (healthScore, metrics) => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Create a simple text version for the main message
    const text =
      `🚨 *Team Health Alert*: Score has dropped to ${healthScore}%\n` +
      `This requires immediate attention to prevent impact on productivity and team morale.`;

    // Return both text and blocks for compatibility
    return {
      text,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 Team Health Alert: Immediate Attention Required",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `*Team health has dropped to ${healthScore.toFixed(
                0
              )}%* - _${currentDate}_\n\n` +
              `This significant drop in team health requires immediate attention to prevent further impact on productivity and team morale.`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "*Key Concerns:*\n" +
              "• Team morale and engagement are at risk\n" +
              "• Potential burnout indicators are present\n" +
              "• Productivity and quality may be impacted\n" +
              "• Risk of increased turnover if unaddressed",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "*Recommended Actions:*\n" +
              "• Schedule a team check-in meeting\n" +
              "• Review workload distribution\n" +
              "• Identify and remove blockers\n" +
              "• Consider team wellness activities",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_Alert triggered at: ${new Date().toLocaleTimeString()}_`,
            },
          ],
        },
      ],
    };
  };

  // Throttled send function
  const throttledSend = useRef(
    throttle((healthScore, currentTime) => {
      const alertMessage = formatAlertMessage(healthScore, metrics);

      sendMessage(alertMessage.text, channel)
        .then(() => {
          console.log("Alert sent successfully - Score:", healthScore);
          lastAlertTime.current = currentTime;
        })
        .catch((error) => {
          console.error("Failed to send alert:", error);
        });
    }, 1000) // 1000ms throttle
  ).current;

  // Separate useEffect for setting up the fetchTicketInfo function
  useEffect(() => {
    // Function to fetch ticket information from ClickUp API
    const fetchTicketInfo = async (taskId) => {
      if (!taskId) {
        console.error("No task ID provided");
        return null;
      }

      // Ensure we have both token and team ID
      if (!settings.clickup?.token || !settings.clickup?.teamId) {
        console.error("Missing ClickUp token or team ID in settings");
        return null;
      }

      try {
        const response = await fetch(
          `https://api.clickup.com/api/v2/team/${settings.clickup.teamId}/task/${taskId}`,
          {
            headers: {
              Authorization: settings.clickup.token,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("ClickUp API Error:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData.err || "Unknown error",
            url: response.url,
            teamId: settings.clickup.teamId,
          });
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Fetched ticket info:", data);
        return data;
      } catch (error) {
        console.error("Error in fetchTicketInfo:", {
          message: error.message,
          taskId,
          teamId: settings.clickup?.teamId,
          timestamp: new Date().toISOString(),
        });
        return null;
      }
    };

    // Example usage - you can remove this in production
    if (process.env.NODE_ENV === "development") {
      fetchTicketInfo("PROD-21581")
        .then((data) => console.log("Example ticket data:", data))
        .catch((error) => console.error("Example fetch failed:", error));
    }
  }, [settings.clickup?.token, settings.clickup?.teamId]);

  // Check if we should send an alert
  useEffect(() => {
    if (!enabled || !metrics?.healthScore) return;

    const currentTime = Date.now();
    const healthScore =
      typeof metrics.healthScore === "number" ? metrics.healthScore : 0;

    // Check if health score is below threshold and cooldown has passed
    if (
      healthScore < healthThreshold &&
      currentTime - lastAlertTime.current > cooldownPeriod
    ) {
      // throttledSend(healthScore, currentTime);
    }
  }, [
    metrics?.healthScore,
    healthThreshold,
    enabled,
    throttledSend,
    settings.clickup.token,
  ]);

  return {
    lastAlertTime: lastAlertTime.current
      ? new Date(lastAlertTime.current)
      : null,
    isAlertActive:
      lastAlertTime.current > 0 &&
      Date.now() - lastAlertTime.current < cooldownPeriod,
  };
};

export default useTeamHealthAlert;
