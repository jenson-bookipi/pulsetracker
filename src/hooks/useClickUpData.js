import { useState, useEffect } from "react";

export const useClickUpData = (token, teamId) => {
  const [data, setData] = useState({
    tasks: [],
    spaces: [],
    loading: true,
    error: null,
  });

  const fetchClickUpData = async () => {
    if (!token || !teamId) {
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      const headers = {
        Authorization: token,
        "Content-Type": "application/json",
      };

      // Fetch spaces
      const spacesResponse = await fetch(
        `https://api.clickup.com/api/v2/team/${teamId}/space`,
        { headers }
      );
      if (!spacesResponse.ok) throw new Error("Failed to fetch ClickUp spaces");
      const spacesData = await spacesResponse.json();

      // Fetch tasks from all spaces
      const taskPromises = spacesData.spaces.map(async (space) => {
        try {
          const tasksResponse = await fetch(
            `https://api.clickup.com/api/v2/space/${space.id}/task`,
            { headers }
          );
          if (!tasksResponse.ok) return [];
          const tasksData = await tasksResponse.json();
          return tasksData.tasks.map((task) => ({
            ...task,
            space_name: space.name,
            space_id: space.id,
          }));
        } catch (error) {
          console.error(`Error fetching tasks for space ${space.name}:`, error);
          return [];
        }
      });

      const taskResults = await Promise.all(taskPromises);
      const allTasks = taskResults.flat();

      setData({
        tasks: allTasks,
        spaces: spacesData.spaces,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("ClickUp API Error:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
    }
  };

  useEffect(() => {
    fetchClickUpData();
  }, [token, teamId]);

  const getTasksByAssignee = (userId) => {
    return data.tasks.filter((task) =>
      task.assignees?.some(
        (assignee) => assignee.id === userId || assignee.username === userId
      )
    );
  };

  const getCompletedTasks = (userId, days = 7) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return getTasksByAssignee(userId)
      .filter(
        (task) =>
          task.status?.status === "complete" || task.status?.status === "closed"
      )
      .filter((task) => {
        const completedDate = task.date_closed
          ? new Date(parseInt(task.date_closed))
          : null;
        return completedDate && completedDate > cutoff;
      });
  };

  const getOpenTasks = (userId) => {
    return getTasksByAssignee(userId).filter(
      (task) =>
        task.status?.status !== "complete" && task.status?.status !== "closed"
    );
  };

  const getBlockedTasks = (userId = null) => {
    const tasks = userId ? getTasksByAssignee(userId) : data.tasks;

    return tasks.filter((task) => {
      // Check status for blocked indicators
      const statusName = task.status?.status?.toLowerCase() || "";
      const isBlockedStatus =
        statusName.includes("blocked") ||
        statusName.includes("waiting") ||
        statusName.includes("pending");

      // Check comments for blocked keywords
      const hasBlockedComments = task.comments?.some((comment) => {
        const text = comment.comment_text?.toLowerCase() || "";
        return (
          text.includes("blocked") ||
          text.includes("waiting") ||
          text.includes("pending") ||
          text.includes("stuck")
        );
      });

      return isBlockedStatus || hasBlockedComments;
    });
  };

  const getTaskMetrics = (userId) => {
    const userTasks = getTasksByAssignee(userId);
    const completedTasks = getCompletedTasks(userId);
    const openTasks = getOpenTasks(userId);
    const blockedTasks = getBlockedTasks(userId);

    return {
      total: userTasks.length,
      completed: completedTasks.length,
      open: openTasks.length,
      blocked: blockedTasks.length,
      completionRate:
        userTasks.length > 0
          ? (completedTasks.length / userTasks.length) * 100
          : 0,
    };
  };

  const getBlockedTasksWithDuration = () => {
    return getBlockedTasks().map((task) => {
      // Calculate how long task has been blocked
      const blockedSince = task.date_updated
        ? new Date(parseInt(task.date_updated))
        : new Date(parseInt(task.date_created));
      const now = new Date();
      const hoursBlocked = Math.floor((now - blockedSince) / (1000 * 60 * 60));

      return {
        ...task,
        blockedSince,
        hoursBlocked,
        needsFollowUp: hoursBlocked >= 48,
      };
    });
  };

  const getSprint55Tasks = async () => {
    if (!token || !teamId) {
      throw new Error("ClickUp token and team ID are required");
    }

    try {
      const headers = {
        Authorization: token,
        "Content-Type": "application/json",
      };

      // Step 1: Find the 🧠 Product space
      const spacesResponse = await fetch(
        `https://api.clickup.com/api/v2/team/${teamId}/space`,
        { headers }
      );
      if (!spacesResponse.ok) throw new Error("Failed to fetch ClickUp spaces");
      const spacesData = await spacesResponse.json();

      const productSpace = spacesData.spaces.find(
        (space) =>
          space.name.includes("🧠 Product") ||
          space.name.includes("Product") ||
          space.name.toLowerCase().includes("product")
      );

      if (!productSpace) {
        throw new Error("🧠 Product space not found");
      }

      console.log("Found Product space:", productSpace.name);

      // Step 2: Get folders from the Product space to find Payroller-1-n
      const foldersResponse = await fetch(
        `https://api.clickup.com/api/v2/space/${productSpace.id}/folder`,
        { headers }
      );
      if (!foldersResponse.ok)
        throw new Error("Failed to fetch folders from Product space");
      const foldersData = await foldersResponse.json();

      const payrollerFolder = foldersData.folders.find(
        (folder) =>
          folder.name.includes("Payroller-1-n") ||
          folder.name.toLowerCase().includes("payroller")
      );

      if (!payrollerFolder) {
        throw new Error("Payroller-1-n folder not found in Product space");
      }

      console.log("Found Payroller folder:", payrollerFolder.name);

      // Step 3: Get lists from Payroller-1-n folder to find Sprint 55
      const listsResponse = await fetch(
        `https://api.clickup.com/api/v2/folder/${payrollerFolder.id}/list`,
        { headers }
      );
      if (!listsResponse.ok)
        throw new Error("Failed to fetch lists from Payroller folder");
      const listsData = await listsResponse.json();

      const sprint55List = listsData.lists.find(
        (list) =>
          list.name.includes("Sprint 55") ||
          list.name.toLowerCase().includes("sprint 55")
      );

      if (!sprint55List) {
        throw new Error("Sprint 55 list not found in Payroller-1-n folder");
      }

      console.log("Found Sprint 55 list:", sprint55List.name);

      // Step 4: Get tasks from Sprint 55 list
      const tasksResponse = await fetch(
        `https://api.clickup.com/api/v2/list/${sprint55List.id}/task`,
        { headers }
      );
      if (!tasksResponse.ok)
        throw new Error("Failed to fetch tasks from Sprint 55");
      const tasksData = await tasksResponse.json();

      // Enrich tasks with additional metadata
      const enrichedTasks = tasksData.tasks.map((task) => ({
        ...task,
        space_name: productSpace.name,
        folder_name: payrollerFolder.name,
        list_name: sprint55List.name,
        priority_text: task.priority?.priority || "No Priority",
        status_text: task.status?.status || "No Status",
        assignee_names:
          task.assignees?.map((a) => a.username).join(", ") || "Unassigned",
        due_date_formatted: task.due_date
          ? new Date(parseInt(task.due_date)).toLocaleDateString()
          : "No Due Date",
        created_date_formatted: new Date(
          parseInt(task.date_created)
        ).toLocaleDateString(),
        url: task.url,
      }));

      return {
        productSpace,
        payrollerFolder,
        sprint55List,
        tasks: enrichedTasks,
        totalTasks: enrichedTasks.length,
        tasksByStatus: enrichedTasks.reduce((acc, task) => {
          const status = task.status_text;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
        tasksByPriority: enrichedTasks.reduce((acc, task) => {
          const priority = task.priority_text;
          acc[priority] = (acc[priority] || 0) + 1;
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error("Error fetching Sprint 55 tasks:", error);
      throw error;
    }
  };

  return {
    ...data,
    getTasksByAssignee,
    getCompletedTasks,
    getOpenTasks,
    getBlockedTasks,
    getTaskMetrics,
    getBlockedTasksWithDuration,
    getSprint55Tasks,
    refresh: fetchClickUpData,
  };
};
