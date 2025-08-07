import { useMemo } from "react";

export const useBlockedTickets = (clickupData, slackWebhook) => {
  const blockedTicketsWithSuggestions = useMemo(() => {
    if (!clickupData?.getBlockedTasksWithDuration) return [];

    const blockedTasks = clickupData.getBlockedTasksWithDuration();

    return blockedTasks
      .map((task) => {
        const suggestions = [];
        const assigneeName = task.assignees?.[0]?.username || "Unassigned";

        // Generate contextual suggestions based on task state
        if (task.hoursBlocked > 48) {
          suggestions.push({
            type: "urgent",
            action: "Send follow-up reminder",
            description: "Task has been blocked for over 48 hours",
            priority: "high",
          });
        }

        if (task.assignees?.length === 0) {
          suggestions.push({
            type: "assignment",
            action: "Assign to team member",
            description: "Task needs an owner to move forward",
            priority: "high",
          });
        }

        if (task.status?.status?.toLowerCase().includes("waiting")) {
          suggestions.push({
            type: "communication",
            action: "Comment asking for update",
            description: "Check with dependencies or stakeholders",
            priority: "medium",
          });
        }

        if (task.status?.status?.toLowerCase().includes("review")) {
          suggestions.push({
            type: "review",
            action: "Tag reviewer on GitHub/Slack",
            description: "Speed up the review process",
            priority: "medium",
          });
        }

        // Check if assignee has been inactive
        const lastUpdate = task.date_updated
          ? new Date(parseInt(task.date_updated))
          : null;
        const daysSinceUpdate = lastUpdate
          ? Math.floor((new Date() - lastUpdate) / (1000 * 60 * 60 * 24))
          : 0;

        if (daysSinceUpdate > 3) {
          suggestions.push({
            type: "reassignment",
            action: "Consider reassigning",
            description: `No updates for ${daysSinceUpdate} days`,
            priority: "medium",
          });
        }

        // Default suggestions
        if (suggestions.length === 0) {
          suggestions.push({
            type: "status_update",
            action: "Update task status",
            description: "Change status if work is already in progress",
            priority: "low",
          });
        }

        return {
          ...task,
          assigneeName,
          suggestions,
          daysSinceUpdate,
          priorityLevel:
            task.hoursBlocked > 48
              ? "critical"
              : task.hoursBlocked > 24
              ? "high"
              : "medium",
        };
      })
      .sort((a, b) => {
        // Sort by priority and hours blocked
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        if (priorityOrder[a.priorityLevel] !== priorityOrder[b.priorityLevel]) {
          return (
            priorityOrder[b.priorityLevel] - priorityOrder[a.priorityLevel]
          );
        }
        return b.hoursBlocked - a.hoursBlocked;
      });
  }, [clickupData]);

  const executeAction = async (task, suggestion) => {
    switch (suggestion.type) {
      case "urgent":
      case "communication":
        if (slackWebhook) {
          return await slackWebhook.sendFollowUpMessage(
            task,
            task.assigneeName
          );
        }
        break;

      case "review":
        if (slackWebhook) {
          const message =
            `🔍 Review needed for: *${task.name}*\n` +
            `Assignee: ${task.assigneeName}\n` +
            `Blocked for: ${Math.floor(task.hoursBlocked / 24)} days\n\n` +
            `Please prioritize reviewing this task! 🙏`;
          return await slackWebhook.sendMessage(message);
        }
        break;

      default:
        // For other actions, we'll just return success and let the UI handle it
        return true;
    }
    return false;
  };

  const getBlockerStats = () => {
    const stats = {
      total: blockedTicketsWithSuggestions.length,
      critical: blockedTicketsWithSuggestions.filter(
        (t) => t.priorityLevel === "critical"
      ).length,
      high: blockedTicketsWithSuggestions.filter(
        (t) => t.priorityLevel === "high"
      ).length,
      needsFollowUp: blockedTicketsWithSuggestions.filter(
        (t) => t.needsFollowUp
      ).length,
      avgBlockedHours:
        blockedTicketsWithSuggestions.length > 0
          ? Math.round(
              blockedTicketsWithSuggestions.reduce(
                (sum, t) => sum + t.hoursBlocked,
                0
              ) / blockedTicketsWithSuggestions.length
            )
          : 0,
    };
    return stats;
  };

  const getTeamBlockerSummary = () => {
    const summary = {};

    blockedTicketsWithSuggestions.forEach((task) => {
      const assignee = task.assigneeName;
      if (!summary[assignee]) {
        summary[assignee] = {
          count: 0,
          totalHours: 0,
          critical: 0,
          tasks: [],
        };
      }

      summary[assignee].count++;
      summary[assignee].totalHours += task.hoursBlocked;
      summary[assignee].tasks.push(task);

      if (task.priorityLevel === "critical") {
        summary[assignee].critical++;
      }
    });

    return Object.entries(summary)
      .map(([assignee, data]) => ({
        assignee,
        ...data,
        avgHours: Math.round(data.totalHours / data.count),
      }))
      .sort((a, b) => b.critical - a.critical || b.count - a.count);
  };

  return {
    blockedTickets: blockedTicketsWithSuggestions,
    executeAction,
    getBlockerStats,
    getTeamBlockerSummary,
  };
};
