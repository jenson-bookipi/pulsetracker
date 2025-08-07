import { useState, useEffect } from "react";

export const useClickUpData = (token, teamId) => {
  const [data, setData] = useState({
    tasks: [],
    spaces: [],
    loading: true,
    error: null,
  });

  const fetchClickUpData = async () => {
    const timestamp = new Date().toISOString();
    console.log(`🚀 [${timestamp}] fetchClickUpData called with:`, { token: !!token, teamId });
    console.log('🔥 CACHE BUST: useClickUpData.js loaded at', timestamp);
    
    if (!token || !teamId) {
      console.log("⚠️ Missing ClickUp credentials:", { hasToken: !!token, teamId });
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      console.log('🔄 Starting ClickUp data fetch...');
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

      console.log('📋 Fetching tasks from', spacesData.spaces.length, 'spaces');
      
      // Fetch tasks from all spaces
      const taskPromises = spacesData.spaces.map(async (space) => {
        try {
          console.log('🔍 Fetching tasks from space:', space.name);
          const tasksResponse = await fetch(
            `https://api.clickup.com/api/v2/space/${space.id}/task`,
            { headers }
          );
          if (!tasksResponse.ok) {
            console.warn(`Failed to fetch tasks for space ${space.name}:`, tasksResponse.status);
            return [];
          }
          const tasksData = await tasksResponse.json();
          console.log(`✅ Found ${tasksData.tasks?.length || 0} tasks in space ${space.name}`);
          return tasksData.tasks?.map((task) => ({
            ...task,
            space_name: space.name,
            space_id: space.id,
          })) || [];
        } catch (error) {
          console.error(`❌ Error fetching tasks for space ${space.name}:`, error);
          return [];
        }
      });

      const taskResults = await Promise.all(taskPromises);
      const allTasks = taskResults.flat();
      
      console.log('🎉 Total tasks loaded:', allTasks.length);

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

    return getTasksByAssignee(userId).filter((task) => {
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
        taskDate && new Date(parseInt(taskDate)) >= cutoff;

      // Debug log for completed tasks
      if (isCompleted) {
        console.log("Completed task in getCompletedTasks:", {
          name: task.name,
          status: task.status.status,
          date: taskDate ? new Date(parseInt(taskDate)) : "No date",
          isWithinTimeframe,
        });
      }

      return isCompleted && isWithinTimeframe;
    });
  };

  const getOpenTasks = (userId) => {
    return getTasksByAssignee(userId).filter((task) => {
      if (!task.status?.status) return true; // Treat tasks with no status as open

      const status = task.status.status.toLowerCase();
      return ![
        "completed",
        "done",
        "closed",
        "deployed",
        "finished",
        "accepted",
      ].includes(status);
    });
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

  const fetchListTasksAndTeamMembers = async (listId) => {
    if (!token) {
      throw new Error("ClickUp token is required");
    }

    try {
      const headers = {
        Authorization: token,
        "Content-Type": "application/json",
      };

      // Fetch tasks from the specified list
      const tasksResponse = await fetch(
        `https://api.clickup.com/api/v2/list/${listId}/task`,
        {
          headers,
          params: {
            include_closed: true,
            subtasks: true,
            assignees: ["all"],
          },
        }
      );

      if (!tasksResponse.ok) {
        throw new Error(`Failed to fetch tasks from list ${listId}`);
      }

      const tasksData = await tasksResponse.json();

      // Extract unique team members from assignees
      const teamMembersMap = new Map();

      tasksData.tasks.forEach((task) => {
        task.assignees?.forEach((assignee) => {
          if (!teamMembersMap.has(assignee.id)) {
            teamMembersMap.set(assignee.id, {
              id: assignee.id,
              name: assignee.username || assignee.name || "Unknown User",
              email: assignee.email,
              color: assignee.color,
              profilePicture:
                assignee.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  assignee.username || assignee.name || "U"
                )}&background=random`,
              role: "Team Member",
              githubUsername: assignee.username,
              source: "clickup",
              sourceId: assignee.id,
            });
          }
        });
      });

      const teamMembers = Array.from(teamMembersMap.values());

      return {
        tasks: tasksData.tasks,
        teamMembers,
        totalTasks: tasksData.tasks?.length || 0,
        listId,
      };
    } catch (error) {
      console.error(`Error fetching tasks from list ${listId}:`, error);
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
    fetchListTasksAndTeamMembers,
    refresh: fetchClickUpData,
  };
};
