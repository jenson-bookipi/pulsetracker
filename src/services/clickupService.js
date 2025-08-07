/**
 * ClickUp Service
 * Handles all ClickUp API interactions
 */

/**
 * Fetches tasks from a specific ClickUp list with pagination support
 * @param {string} listId - The ClickUp list ID
 * @param {string} token - ClickUp API token
 * @param {Object} options - Additional options for filtering and pagination
 * @returns {Promise<Array>} Array of formatted task objects
 */
export const fetchTasksFromList = async (listId, token, options = {}) => {
  try {
    const {
      archived = false,
      includeClosed = true,
      page = 0,
      pageSize = 100,
      statuses = [],
      assignees = [],
      dueDateGt = null,
      dueDateLt = null,
    } = options;

    const headers = {
      Authorization: token,
      "Content-Type": "application/json",
    };

    const queryParams = new URLSearchParams({
      archived: String(archived),
      include_closed: String(includeClosed),
      page: String(page),
      page_size: String(pageSize),
      statuses: statuses.join(","),
      assignees: assignees.join(","),
      ...(dueDateGt && { due_date_gt: String(dueDateGt) }),
      ...(dueDateLt && { due_date_lt: String(dueDateLt) }),
    });

    const response = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `ClickUp API error: ${response.status} - ${
          errorData.err || response.statusText
        }`
      );
    }

    const data = await response.json();
    return data.tasks || [];
  } catch (error) {
    console.error("Error in fetchTasksFromList:", error);
    throw error;
  }
};

/**
 * Fetches team members from ClickUp
 * @param {string} teamId - The ClickUp team ID
 * @param {string} token - ClickUp API token
 * @returns {Promise<Array>} Array of team members
 */
export const fetchTeamMembers = async (teamId, token) => {
  try {
    const response = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/member`,
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch team members: ${response.statusText}`);
    }

    const data = await response.json();
    return data.members || [];
  } catch (error) {
    console.error("Error in fetchTeamMembers:", error);
    throw error;
  }
};

/**
 * Calculates velocity metrics for a team
 * @param {Array} tasks - Array of task objects
 * @param {number} days - Number of days to look back
 * @returns {Object} Velocity metrics
 */
export const calculateVelocity = (tasks, days = 14) => {
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - days));

  // Debug: Log all unique statuses in the tasks
  const allStatuses = [...new Set(tasks.map((t) => t.status?.status))];
  console.log("All task statuses:", allStatuses);

  const completedTasks = tasks.filter((task) => {
    if (!task.status?.status) return false;

    const status = task.status.status.toLowerCase();
    const isCompleted = [
      "completed",
      "done",
      "closed",
      "deployed",
      "finished",
      "accepted",
    ].includes(status);

    const taskDate = task.date_closed || task.date_updated;
    const isWithinTimeframe =
      taskDate && new Date(parseInt(taskDate)) >= cutoffDate;
    if (isCompleted) {
      console.log("Completed task:", {
        name: task.name,
        status: task.status.status,
        date: taskDate ? new Date(parseInt(taskDate)) : "No date",
        points: task.points || 0,
        isWithinTimeframe,
      });
    }
    // && isWithinTimeframe
    return isCompleted;
  });

  console.log("completedTaskscompletedTasks", completedTasks);

  console.log(
    `Found ${completedTasks.length} completed tasks in the last ${days} days`
  );
  console.log("Sample completed task:", completedTasks[0]);

  const totalPoints = completedTasks.reduce((sum, task) => {
    const points = parseInt(task.points) || 1; // Default to 1 point if not specified
    return sum + points;
  }, 0);

  console.log("Total points:", totalPoints);

  return {
    totalTasks: completedTasks.length,
    totalPoints,
    averagePerDay: totalPoints / days,
    averagePerWeek: (totalPoints / days) * 7,
  };
};

/**
 * Calculates blocker metrics
 * @param {Array} tasks - Array of task objects
 * @returns {Object} Blocker metrics
 */
export const calculateBlockerMetrics = (tasks) => {
  const blockedTasks = tasks.filter((task) => {
    const status = task.status?.status?.toLowerCase() || "";
    return status.includes("blocked") || status.includes("waiting");
  });

  return {
    totalBlocked: blockedTasks.length,
    byStatus: blockedTasks.reduce((acc, task) => {
      const status = task.status?.status || "No Status";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    byAssignee: blockedTasks.reduce((acc, task) => {
      const assignee = task.assignees?.[0]?.username || "Unassigned";
      acc[assignee] = (acc[assignee] || 0) + 1;
      return acc;
    }, {}),
  };
};
