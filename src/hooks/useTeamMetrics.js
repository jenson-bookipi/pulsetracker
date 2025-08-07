import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchClickUpListTasks } from "../utils/clickupTaskFetcher";
import {
  fetchPullRequests,
  fetchCommits,
  fetchUserActivity,
} from "../services/githubService";
import { calculateTeamProductivity } from "../services/dashboardMetricsService";

/**
 * Custom hook to fetch and manage team metrics from ClickUp and GitHub
 * @param {Object} config - Configuration object
 * @param {string} config.clickUpListId - ClickUp list ID to fetch tasks from
 * @param {string} config.clickUpToken - ClickUp API token
 * @param {string} config.githubOwner - GitHub repository owner
 * @param {string} config.githubRepo - GitHub repository name
 * @param {string} config.githubToken - GitHub API token
 * @param {Array<string>} config.teamMembers - Array of team member usernames
 * @param {number} [config.days=30] - Number of days to look back for metrics
 * @returns {Object} Team metrics and loading/error states
 */
export const useTeamMetrics = ({
  clickUpListId,
  clickUpToken,
  githubOwner,
  githubRepo,
  githubToken,
  teamMembers = [],
  days = 30,
}) => {
  // State for ClickUp data
  const [clickUpTasks, setClickUpTasks] = useState([]);
  const [clickUpLoading, setClickUpLoading] = useState(true);
  const [clickUpError, setClickUpError] = useState(null);

  // State for GitHub data
  const [pullRequests, setPullRequests] = useState([]);
  const [commits, setCommits] = useState([]);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState(null);

  // State for team member activity
  const [teamMemberActivity, setTeamMemberActivity] = useState({});
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(null);

  // Fetch ClickUp tasks
  const fetchClickUpData = useCallback(async () => {
    if (!clickUpListId || !clickUpToken) {
      setClickUpError("Missing ClickUp list ID or token");
      setClickUpLoading(false);
      return;
    }

    try {
      setClickUpLoading(true);
      setClickUpError(null);

      const tasks = await fetchClickUpListTasks(clickUpListId, clickUpToken);
      setClickUpTasks(tasks);
    } catch (error) {
      console.error("Error fetching ClickUp tasks:", error);
      setClickUpError(error.message || "Failed to fetch ClickUp tasks");
    } finally {
      setClickUpLoading(false);
    }
  }, [clickUpListId, clickUpToken]);

  // Fetch GitHub data (PRs and commits)
  const fetchGitHubData = useCallback(async () => {
    if (!githubOwner || !githubRepo || !githubToken) {
      setGithubError("Missing GitHub owner, repo, or token");
      setGithubLoading(false);
      return;
    }

    try {
      setGithubLoading(true);
      setGithubError(null);

      // Calculate date range
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      // Fetch pull requests
      const prs = await fetchPullRequests(
        githubOwner,
        githubRepo,
        githubToken,
        {
          state: "all",
          since: sinceDate.toISOString(),
          per_page: 100,
        }
      );
      setPullRequests(prs);

      // Fetch commits
      const commitsData = await fetchCommits(
        githubOwner,
        githubRepo,
        githubToken,
        {
          since: sinceDate.toISOString(),
          per_page: 100,
        }
      );
      setCommits(commitsData);
    } catch (error) {
      console.error("Error fetching GitHub data:", error);
      setGithubError(error.message || "Failed to fetch GitHub data");
    } finally {
      setGithubLoading(false);
    }
  }, [githubOwner, githubRepo, githubToken, days]);

  // Fetch team member activity
  const fetchTeamMemberActivity = useCallback(async () => {
    if (!teamMembers.length || !githubToken) {
      console.log("Missing required parameters for team member activity:", {
        hasTeamMembers: teamMembers.length > 0,
        hasGithubToken: !!githubToken,
      });
      setActivityError("No team members provided or missing GitHub token");
      setActivityLoading(false);
      return;
    }

    try {
      console.log("Starting to fetch team member activity...");
      setActivityLoading(true);
      setActivityError(null);

      console.log(`Fetching activity for ${teamMembers.length} team members`);
      const activityPromises = teamMembers.map((username) =>
        fetchUserActivity(username, githubToken, { days })
          .then((activity) => {
            console.log(`Fetched activity for ${username}`);
            return { [username]: activity };
          })
          .catch((error) => {
            console.error(`Error fetching activity for ${username}:`, error);
            return {
              [username]: {
                error: error.message || "Failed to fetch activity",
              },
            };
          })
      );

      const activityResults = await Promise.all(activityPromises);
      const activityMap = Object.assign({}, ...activityResults);

      console.log("Successfully fetched activity for all team members");
      setTeamMemberActivity(activityMap);
    } catch (error) {
      console.error("Error in fetchTeamMemberActivity:", error);
      setActivityError(error.message || "Failed to fetch team member activity");
      // Ensure we don't get stuck in loading state on error
      setTeamMemberActivity({});
    } finally {
      console.log("Setting activity loading to false");
      setActivityLoading(false);
    }
  }, [teamMembers, githubToken, days]);

  // Calculate metrics when data is loaded
  const metrics = useMemo(() => {
    console.log("Calculating metrics with states:", {
      clickUpLoading,
      githubLoading,
      clickUpTasks: clickUpTasks?.length,
      pullRequests: pullRequests?.length,
      commits: commits?.length,
      teamMemberActivity: Object.keys(teamMemberActivity || {}).length,
    });

    if (clickUpLoading || githubLoading) {
      return null;
    }

    try {
      const metrics = calculateTeamProductivity(
        {
          tasks: clickUpTasks || [],
          pullRequests: pullRequests || [],
          commits: commits || [],
          teamMemberActivity: teamMemberActivity || {},
        },
        { days }
      );

      // Add detailed health metrics
      if (metrics?.scores?.health) {
        // Calculate velocity (points per week)
        const velocity = metrics.tasks?.velocity?.averagePerWeek || 0;

        // Calculate blocker impact
        const blockerCount = metrics.tasks?.blocked || 0;
        console.log("metrics-blockers11", metrics.tasks);
        const blockerImpact = Math.min(100, (blockerCount / 10) * 100); // 10+ blockers = 100% impact

        // Calculate PR metrics
        const prMetrics = metrics.code?.pullRequests || {};
        const prMergeRate =
          prMetrics.total > 0
            ? (prMetrics.merged / prMetrics.total) * 100
            : 100; // Assume healthy if no PRs

        const avgReviewTime = prMetrics.averageTimeToFirstReview || 0;
        const reviewTimeScore =
          avgReviewTime > 0
            ? Math.min(100, (48 / avgReviewTime) * 100) // 48 hours is the target
            : 100; // Assume healthy if no reviews

        // Enhanced health metrics
        metrics.healthMetrics = {
          velocity: {
            value: velocity,
            target: 20, // points per week
            score: Math.min(100, (velocity / 20) * 100),
          },
          blockers: {
            count: blockerCount,
            impact: blockerImpact,
            score: Math.max(0, 100 - blockerImpact),
          },
          prMergeRate: {
            value: prMergeRate,
            target: 70, // 70% merge rate target
            score: Math.min(100, (prMergeRate / 70) * 100),
          },
          reviewTime: {
            hours: avgReviewTime,
            target: 48, // hours
            score: reviewTimeScore,
          },
          lastUpdated: new Date().toISOString(),
        };
      }

      return metrics;
    } catch (error) {
      console.error("Error calculating metrics:", error);
      return {
        error: "Failed to calculate metrics",
        details: error.message,
        scores: {
          health: 0,
          productivity: 0,
          quality: 0,
        },
        healthMetrics: {
          error: error.message,
          lastUpdated: new Date().toISOString(),
        },
      };
    }
  }, [
    clickUpTasks,
    pullRequests,
    commits,
    teamMemberActivity,
    clickUpLoading,
    githubLoading,
    days,
  ]);

  // Initial data fetch
  useEffect(() => {
    console.log("useEffect triggered with states:", {
      clickUpListId,
      githubOwner,
      githubRepo,
      teamMembersLength: teamMembers.length,
    });

    let isMounted = true;

    const fetchData = async () => {
      try {
        console.log("Starting data fetch...");

        // Fetch ClickUp data if we have the required tokens
        if (clickUpListId && clickUpToken) {
          console.log("Fetching ClickUp data...");
          await fetchClickUpData();
          console.log("ClickUp data fetched");
        } else {
          console.log("Skipping ClickUp data fetch - missing listId or token");
          setClickUpLoading(false);
        }

        // Fetch GitHub data if we have the required tokens
        if (githubOwner && githubRepo && githubToken) {
          console.log("Fetching GitHub data...");
          await fetchGitHubData();
          console.log("GitHub data fetched");
        } else {
          console.log(
            "Skipping GitHub data fetch - missing owner, repo, or token"
          );
          setGithubLoading(false);
        }

        // Fetch team member activity if we have team members
        if (teamMembers.length > 0) {
          console.log("Fetching team member activity...");
          await fetchTeamMemberActivity();
          console.log("Team member activity fetched");
        } else {
          console.log("No team members to fetch activity for");
          setActivityLoading(false);
        }

        console.log("All data fetching completed");
      } catch (error) {
        console.error("Error in data fetching:", error);
      } finally {
        if (isMounted) {
          console.log("Final loading states:", {
            clickUpLoading,
            githubLoading,
            activityLoading,
          });
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [
    clickUpListId,
    clickUpToken,
    githubOwner,
    githubRepo,
    githubToken,
    teamMembers.length,
    fetchClickUpData,
    fetchGitHubData,
    fetchTeamMemberActivity,
  ]);

  // Refresh function to manually refetch all data
  const refreshAll = useCallback(async () => {
    console.log("=== Starting refreshAll ===");

    try {
      console.log("Refreshing ClickUp data...");
      await fetchClickUpData();
      console.log("ClickUp data refresh complete");

      console.log("Refreshing GitHub data...");
      await fetchGitHubData();
      console.log("GitHub data refresh complete");

      if (teamMembers.length > 0) {
        console.log("Refreshing team member activity...");
        await fetchTeamMemberActivity();
        console.log("Team member activity refresh complete");
      }

      console.log("=== Refresh completed successfully ===");
    } catch (error) {
      console.error("Error during refresh:", error);
    }
  }, [
    fetchClickUpData,
    fetchGitHubData,
    fetchTeamMemberActivity,
    teamMembers.length,
  ]);

  // Loading and error states
  const loading = clickUpLoading || githubLoading || activityLoading;
  const error = clickUpError || githubError || activityError;

  return {
    // Data
    tasks: clickUpTasks,
    pullRequests,
    commits,
    teamMemberActivity,
    metrics,

    // Loading states
    loading,
    clickUpLoading,
    githubLoading,
    activityLoading,

    // Error states
    error,
    clickUpError,
    githubError,
    activityError,

    // Refresh function
    refresh: refreshAll,

    // Individual refresh functions
    refreshClickUp: fetchClickUpData,
    refreshGitHub: fetchGitHubData,
    refreshActivity: fetchTeamMemberActivity,
  };
};
