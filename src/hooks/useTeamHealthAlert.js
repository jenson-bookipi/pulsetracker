import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useSlackWebhook } from "./useSlackWebhook";
import { fetchTasksFromList } from "../services/clickupService";

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
  const formatAlertMessage = (healthScore) => {
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

  // Check if we should send an alert
  // NOTIFY_HEALTH
  useEffect(() => {
    if (!enabled || !metrics?.healthScore) return;

    const currentTime = Date.now();
    const healthScore =
      typeof metrics.healthScore === "number" ? metrics.healthScore : 0;
    lastAlertTime.current = currentTime;

    // Check if health score is below threshold and cooldown has passed
    if (
      healthScore < healthThreshold &&
      currentTime - lastAlertTime.current > cooldownPeriod
    ) {
      throttledSend(healthScore, currentTime);
    }
  }, [
    metrics?.healthScore,
    healthThreshold,
    enabled,
    throttledSend,
    settings.clickup.token,
  ]);

  // Separate useEffect for fetching ticket information
  //OVERDUE
  useEffect(() => {
    // Function to fetch ticket information using clickupService
    const fetchTicketInfo = async (taskId) => {
      if (!taskId || !settings.clickup.token) {
        console.error("Missing required parameters for fetching task");
        return null;
      }

      try {
        // Fetch tasks with the specific task ID
        const tasks = await fetchTasksFromList(
          "901810346248",
          settings.clickup.token,
          {
            includeClosed: true,
            pageSize: 1,
            // Add any additional filters needed to find the specific task
          }
        );

        // Find the specific task by ID
        const task = tasks.find(
          (t) => t.id === taskId || t.custom_id === taskId
        );

        if (!task) {
          console.warn(`Task with ID ${taskId} not found`);
          return null;
        }
        const isOverdue =
          task.due_date &&
          task.status?.status === "in progress" &&
          new Date(Number(task.due_date)) < new Date();
        if (isOverdue) {
          sendMessage(
            `Hey, ${task.assignees?.[0]?.username.split(" ")[0]}, Task ${
              task.name
            } is overdue with 🚨 ${
              task.priority.priority
            } priority. Please check it out`,
            settings.slack.channel
          );
        }

        return task;
      } catch (error) {
        console.error("Error in fetchTicketInfo:", error);
        return null;
      }
    };

    fetchTicketInfo("PROD-21581")
      .then((data) => console.log("Example task data:", data))
      .catch((error) => console.error("Example fetch failed:", error));
  }, [settings.clickup?.token]);

  // Check if we should send an alert for Pull request velocity
  // PULL_REQUEST_VELOCITY
  useEffect(() => {
    if (!enabled || !metrics?.qualityScore) return;

    const currentTime = Date.now();
    const healthScore =
      typeof metrics.qualityScore === "number" ? metrics.qualityScore : 0;
      const QUALITY_THRESHOLD = 50;
      lastAlertTime.current = currentTime;

    // Check if health score is below threshold and cooldown has passed
    if (
      healthScore < QUALITY_THRESHOLD &&
      currentTime - lastAlertTime.current > cooldownPeriod
    ) {
      sendMessage(
        `🚨 *Team Pull request Alert*: Score has dropped to 📉 ${metrics.qualityScore}%\n` +
        `Please prioritize pull request reviews to unblock other developers.`,
        settings.slack.channel
      );
    }
  }, [
    metrics?.qualityScore,
    enabled,
    throttledSend,
    settings.slack.channel
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
