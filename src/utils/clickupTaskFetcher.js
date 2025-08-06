/**
 * Utility function to fetch tasks from a specific ClickUp list
 * and format them according to specified requirements
 */

/**
 * Fetches tasks from a ClickUp list and formats them as requested
 * @param {string} listId - The ClickUp list ID (e.g., "901810346214")
 * @param {string} token - ClickUp API token (should not include "Bearer " prefix)
 * @returns {Promise<Array>} Array of formatted task objects
 */
export const fetchClickUpListTasks = async (listId, token) => {
  try {
    if (!token) {
      throw new Error("No ClickUp token provided");
    }
    if (!listId) {
      throw new Error("No list ID provided");
    }

    const headers = {
      Authorization: token, // Token is passed without 'Bearer ' prefix
      "Content-Type": "application/json",
    };

    // Include additional query parameters to get more task details
    const queryParams = new URLSearchParams({
      archived: "false",
      include_closed: "true",
      page: "0",
      order_by: "created",
      reverse: "true",
      subtasks: "true",
      statuses: "",
      include_markdown_description: "false",
      custom_fields: "",
      list_id: listId,
    });

    const response = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("ClickUp API Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(
        `ClickUp API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Format tasks according to requirements with enhanced details
    const formattedTasks = data.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status?.status || "No Status",
      assignees:
        task.assignees
          ?.map((assignee) => assignee.username || assignee.email)
          .filter(Boolean) || [],
      due_date: task.due_date
        ? new Date(parseInt(task.due_date)).toISOString().split("T")[0] // Format as YYYY-MM-DD
        : null,
      url: task.url,

      // Enhanced details
      description: task.description || task.text_content || "",
      priority: task.priority?.priority || null,
      points: task.points || null, // Story points
      tags: task.tags?.map((tag) => tag.name) || [],

      // Time tracking
      time_estimate: task.time_estimate || null,
      time_spent: task.time_spent || null,

      // Dates
      date_created: task.date_created
        ? new Date(parseInt(task.date_created)).toISOString()
        : null,
      date_updated: task.date_updated
        ? new Date(parseInt(task.date_updated)).toISOString()
        : null,
      date_closed: task.date_closed
        ? new Date(parseInt(task.date_closed)).toISOString()
        : null,

      // Additional metadata
      creator: task.creator?.username || task.creator?.email || "Unknown",
      list_id: task.list?.id || listId,
      list_name: task.list?.name || "Unknown List",
      folder_id: task.folder?.id || null,
      folder_name: task.folder?.name || null,
      space_id: task.space?.id || null,
      space_name: task.space?.name || null,

      // Comments and watchers
      comment_count: task.comment_count || 0,
      watchers:
        task.watchers
          ?.map((watcher) => watcher.username || watcher.email)
          .filter(Boolean) || [],

      // Custom fields (if any)
      custom_fields:
        task.custom_fields?.map((field) => ({
          id: field.id,
          name: field.name,
          value: field.value,
          type: field.type,
        })) || [],

      // Subtasks
      subtask_count: task.subtasks?.length || 0,
      subtasks:
        task.subtasks?.map((subtask) => ({
          id: subtask.id,
          name: subtask.name,
          status: subtask.status?.status || "No Status",
        })) || [],

      // Dependencies
      dependencies: task.dependencies || [],

      // Archive status
      archived: task.archived || false,
    }));

    return formattedTasks;
  } catch (error) {
    console.error("Error fetching ClickUp tasks:", error);
    throw error;
  }
};

/**
 * Extracts list ID from a ClickUp list URL
 * @param {string} url - ClickUp list URL
 * @returns {string|null} Extracted list ID or null if not found
 */
export const extractListIdFromUrl = (url) => {
  // Pattern: https://app.clickup.com/{team_id}/v/l/li/{list_id}
  const match = url.match(/\/li\/(\d+)/);
  return match ? match[1] : null;
};

/**
 * Main function to fetch and format tasks from a ClickUp list URL
 * @param {string} listUrl - Full ClickUp list URL
 * @param {string} token - ClickUp API token
 * @returns {Promise<Array>} Array of formatted task objects
 */
export const fetchTasksFromListUrl = async (listUrl, token) => {
  const listId = extractListIdFromUrl(listUrl);

  if (!listId) {
    throw new Error("Could not extract list ID from URL");
  }

  return await fetchClickUpListTasks(listId, token);
};

/**
 * Fetch tasks with additional filtering and sorting options
 * @param {string} listId - The ClickUp list ID
 * @param {string} token - ClickUp API token
 * @param {Object} options - Additional options for filtering and sorting
 * @returns {Promise<Array>} Array of formatted task objects
 */
export const fetchClickUpListTasksWithOptions = async (
  listId,
  token,
  options = {}
) => {
  const {
    archived = false,
    includeClosed = true,
    orderBy = "created",
    reverse = true,
    assignees = [],
    statuses = [],
    tags = [],
    dueDateGt = null,
    dueDateLt = null,
    dateCreatedGt = null,
    dateCreatedLt = null,
  } = options;

  try {
    const headers = {
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const queryParams = new URLSearchParams({
      archived: archived.toString(),
      include_closed: includeClosed.toString(),
      page: "0",
      order_by: orderBy,
      reverse: reverse.toString(),
      subtasks: "true",
      include_markdown_description: "false",
    });

    // Add filters if provided
    if (assignees.length > 0) {
      queryParams.append("assignees[]", assignees.join(","));
    }
    if (statuses.length > 0) {
      queryParams.append("statuses[]", statuses.join(","));
    }
    if (tags.length > 0) {
      queryParams.append("tags[]", tags.join(","));
    }
    if (dueDateGt) {
      queryParams.append("due_date_gt", dueDateGt);
    }
    if (dueDateLt) {
      queryParams.append("due_date_lt", dueDateLt);
    }
    if (dateCreatedGt) {
      queryParams.append("date_created_gt", dateCreatedGt);
    }
    if (dateCreatedLt) {
      queryParams.append("date_created_lt", dateCreatedLt);
    }

    const response = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch tasks: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status?.status || "No Status",
      assignees:
        task.assignees
          ?.map((assignee) => assignee.username || assignee.email)
          .filter(Boolean) || [],
      due_date: task.due_date
        ? new Date(parseInt(task.due_date)).toISOString().split("T")[0]
        : null,
      url: task.url,
      description: task.description || task.text_content || "",
      priority: task.priority?.priority || null,
      points: task.points || null,
      tags: task.tags?.map((tag) => tag.name) || [],
      time_estimate: task.time_estimate || null,
      time_spent: task.time_spent || null,
      date_created: task.date_created
        ? new Date(parseInt(task.date_created)).toISOString()
        : null,
      date_updated: task.date_updated
        ? new Date(parseInt(task.date_updated)).toISOString()
        : null,
      creator: task.creator?.username || task.creator?.email || "Unknown",
      comment_count: task.comment_count || 0,
      archived: task.archived || false,
    }));
  } catch (error) {
    console.error("Error fetching ClickUp tasks with options:", error);
    throw error;
  }
};

// Example usage function for the specific URL provided
export const fetchSprintTasks = async (token) => {
  const listUrl =
    "https://app.clickup.com/6912544/v/l/li/901810346214?pr=90030340817";
  return await fetchTasksFromListUrl(listUrl, token);
};
