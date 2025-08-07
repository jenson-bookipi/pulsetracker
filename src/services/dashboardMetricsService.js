/**
 * Dashboard Metrics Service
 * Combines and analyzes data from multiple sources to provide team productivity metrics
 */

import { calculateVelocity, calculateBlockerMetrics } from "./clickupService";
import { calculatePRMetrics, calculateCommitMetrics } from "./githubService";

/**
 * Calculates team productivity metrics
 * @param {Object} params - Parameters containing data from different sources
 * @param {Array} params.tasks - Array of ClickUp tasks
 * @param {Array} params.pullRequests - Array of GitHub pull requests
 * @param {Array} params.commits - Array of GitHub commits
 * @param {Object} options - Additional options
 * @returns {Object} Team productivity metrics
 */
export const calculateTeamProductivity = (params, options = {}) => {
  const { tasks = [], pullRequests = [], commits = [] } = params;
  const { days = 30 } = options;

  // Calculate ClickUp metrics
  const velocityMetrics = calculateVelocity(tasks, days);
  const blockerMetrics = calculateBlockerMetrics(tasks);

  // Calculate GitHub metrics
  const prMetrics = calculatePRMetrics(pullRequests);
  const commitMetrics = calculateCommitMetrics(commits);

  // Calculate team member metrics
  const teamMembers = calculateTeamMemberMetrics({
    tasks,
    pullRequests,
    commits,
    prMetrics,
    commitMetrics,
  });

  // Calculate overall team health score (0-100)
  const healthScore = calculateTeamHealthScore({
    velocity: velocityMetrics.averagePerWeek,
    blockerCount: blockerMetrics.totalBlocked,
    prMetrics,
    commitMetrics,
  });

  return {
    // Time period metrics
    timePeriod: {
      startDate: new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      ).toISOString(),
      endDate: new Date().toISOString(),
      days,
    },

    // Task metrics
    tasks: {
      total: tasks.length,
      completed: tasks.filter(
        (t) =>
          t.status?.status?.toLowerCase() === "complete" ||
          t.status?.status?.toLowerCase() === "done"
      ).length,
      inProgress: tasks.filter(
        (t) =>
          t.status?.status?.toLowerCase().includes("in progress") ||
          t.status?.status?.toLowerCase() === "in review"
      ).length,
      blocked: blockerMetrics.totalBlocked,
      velocity: velocityMetrics,
      blockers: blockerMetrics,
    },

    // Code metrics
    code: {
      pullRequests: prMetrics,
      commits: commitMetrics,
      averagePRSize: calculateAveragePRSize(pullRequests),
      codeReviewStats: calculateCodeReviewStats(pullRequests),
    },

    // Team member metrics
    teamMembers,

    // Overall scores
    scores: {
      health: healthScore,
      productivity: calculateProductivityScore({
        velocity: velocityMetrics.averagePerWeek,
        prMetrics,
        commitMetrics,
      }),
      quality: calculateQualityScore({
        prMetrics,
        blockerMetrics,
      }),
    },
  };
};

/**
 * Calculates metrics for each team member
 * @private
 */
const calculateTeamMemberMetrics = ({
  tasks,
  pullRequests,
  commits,
  prMetrics,
  commitMetrics,
}) => {
  // Get all unique team members across all data sources
  const memberUsernames = new Set([
    ...tasks
      .flatMap((t) => t.assignees?.map((a) => a.username))
      .filter(Boolean),
    ...Object.keys(prMetrics.byAuthor || {}),
    ...Object.keys(commitMetrics.byAuthor || {}),
  ]);

  return Array.from(memberUsernames).map((username) => {
    // Task metrics for this member
    const memberTasks = tasks.filter((t) =>
      t.assignees?.some((a) => a.username === username)
    );
    const completedTasks = memberTasks.filter(
      (t) =>
        t.status?.status?.toLowerCase() === "complete" ||
        t.status?.status?.toLowerCase() === "done"
    );
    const inProgressTasks = memberTasks.filter(
      (t) =>
        t.status?.status?.toLowerCase().includes("in progress") ||
        t.status?.status?.toLowerCase() === "in review"
    );
    const blockedTasks = memberTasks.filter(
      (t) =>
        t.status?.status?.toLowerCase().includes("blocked") ||
        t.status?.status?.toLowerCase().includes("waiting")
    );

    // PR metrics for this member
    const prsByMember = pullRequests.filter(
      (pr) => pr.user?.login === username
    );
    const memberPrMetrics = calculatePRMetrics(prsByMember);

    // Commit metrics for this member
    const memberCommits = commits.filter(
      (commit) =>
        commit.author?.login === username ||
        commit.commit?.author?.name === username
    );
    const memberCommitMetrics = calculateCommitMetrics(memberCommits);

    // Calculate individual productivity score (0-100)
    const productivityScore = calculateMemberProductivityScore({
      tasks: {
        total: memberTasks.length,
        completed: completedTasks.length,
        inProgress: inProgressTasks.length,
        blocked: blockedTasks.length,
      },
      prMetrics: memberPrMetrics,
      commitMetrics: memberCommitMetrics,
    });

    // Calculate individual health score (0-100)
    const healthScore = calculateMemberHealthScore({
      tasks: {
        completed: completedTasks.length,
        blocked: blockedTasks.length,
      },
      prMetrics: memberPrMetrics,
    });

    return {
      username,
      tasks: {
        total: memberTasks.length,
        completed: completedTasks.length,
        inProgress: inProgressTasks.length,
        blocked: blockedTasks.length,
        completionRate:
          memberTasks.length > 0
            ? Math.round((completedTasks.length / memberTasks.length) * 100)
            : 0,
      },
      pullRequests: memberPrMetrics,
      commits: memberCommitMetrics,
      scores: {
        productivity: productivityScore,
        health: healthScore,
      },
      lastActive:
        [
          ...prsByMember.map((pr) => pr.updated_at),
          ...memberCommits.map((c) => c.commit?.author?.date),
        ]
          .filter(Boolean)
          .sort()
          .pop() || null,
    };
  });
};

/**
 * Calculates the average size of pull requests in lines changed
 * @private
 */
const calculateAveragePRSize = (pullRequests) => {
  if (!pullRequests?.length) return 0;

  const prsWithSize = pullRequests.filter((pr) => pr.additions && pr.deletions);
  if (prsWithSize.length === 0) return 0;

  const totalChanges = prsWithSize.reduce(
    (sum, pr) => sum + pr.additions + pr.deletions,
    0
  );

  return Math.round(totalChanges / prsWithSize.length);
};

/**
 * Calculates code review statistics
 * @private
 */
const calculateCodeReviewStats = (pullRequests) => {
  const stats = {
    totalReviews: 0,
    averageReviewTimeHours: 0,
    averageCommentsPerPR: 0,
    reviewCoverage: 0, // % of PRs with at least one review
  };

  if (!pullRequests?.length) return stats;

  const prsWithReviews = pullRequests.filter((pr) => pr.reviews?.length > 0);
  const totalComments = pullRequests.reduce(
    (sum, pr) => sum + (pr.review_comments || 0) + (pr.comments || 0),
    0
  );

  // Calculate average time to first review in hours
  let totalReviewTime = 0;
  let reviewedPRs = 0;

  pullRequests.forEach((pr) => {
    if (pr.reviews?.length > 0) {
      const firstReview = pr.reviews.sort(
        (a, b) => new Date(a.submitted_at) - new Date(b.submitted_at)
      )[0];

      if (firstReview && pr.created_at) {
        const reviewTime =
          (new Date(firstReview.submitted_at) - new Date(pr.created_at)) /
          (1000 * 60 * 60);
        totalReviewTime += reviewTime;
        reviewedPRs++;
      }
    }
  });

  return {
    totalReviews: pullRequests.reduce(
      (sum, pr) => sum + (pr.reviews?.length || 0),
      0
    ),
    averageReviewTimeHours: reviewedPRs > 0 ? totalReviewTime / reviewedPRs : 0,
    averageCommentsPerPR:
      pullRequests.length > 0 ? totalComments / pullRequests.length : 0,
    reviewCoverage:
      pullRequests.length > 0
        ? (prsWithReviews.length / pullRequests.length) * 100
        : 0,
  };
};

/**
 * Calculates a team health score (0-100)
 * @private
 */
const calculateTeamHealthScore = ({
  velocity,
  blockerCount,
  prMetrics,
  commitMetrics,
}) => {
  // Normalize metrics to 0-1 range
  const velocityScore = Math.min(velocity / 20, 1); // Cap at 20 points per week for 100% score
  const blockerScore = Math.max(0, 1 - blockerCount / 10); // Up to 10 blockers allowed before 0 score

  const prMergedScore =
    prMetrics.total > 0 ? prMetrics.merged / prMetrics.total : 1; // Assume healthy if no PRs

  const prReviewScore =
    prMetrics.total > 0 && prMetrics.averageTimeToFirstReview > 0
      ? Math.min(1, 48 / prMetrics.averageTimeToFirstReview) // 48 hours as target for first review
      : 1; // Assume healthy if no PRs or no reviews

  // Weighted average of all scores
  const healthScore =
    (velocityScore * 0.3 +
      blockerScore * 0.3 +
      prMergedScore * 0.2 +
      prReviewScore * 0.2) *
    100;

  return Math.min(100, Math.max(0, Math.round(healthScore)));
};

/**
 * Calculates a productivity score (0-100)
 * @private
 */
const calculateProductivityScore = ({ velocity, prMetrics, commitMetrics }) => {
  // Normalize metrics to 0-1 range
  const velocityScore = Math.min(velocity / 30, 1); // Cap at 30 points per week for 100% score
  const prThroughputScore = Math.min(prMetrics.merged / 10, 1); // Cap at 10 PRs per period
  const commitScore = Math.min(commitMetrics.total / 50, 1); // Cap at 50 commits per period
  console.log("prThroughputScore", { prThroughputScore, commitScore });
  // Weighted average of all scores
  const productivityScore =
    (velocityScore * 0.5 + prThroughputScore * 0.3 + commitScore * 0.2) * 100;
  return Math.min(100, Math.max(0, Math.round(productivityScore)));
};

/**
 * Calculates a quality score (0-100)
 * @private
 */
const calculateQualityScore = ({ prMetrics, blockerMetrics }) => {
  // Normalize metrics to 0-1 range
  const prMergeRate =
    prMetrics.total > 0 ? prMetrics.merged / prMetrics.total : 1; // Assume good quality if no PRs

  const prReviewTimeScore =
    prMetrics.averageTimeToFirstReview > 0
      ? Math.min(1, 24 / prMetrics.averageTimeToFirstReview) // 24 hours as target for first review
      : 1; // Assume good quality if no reviews

  const blockerScore = Math.max(0, 1 - blockerMetrics.totalBlocked / 5); // Up to 5 blockers allowed

  // Weighted average of all scores
  const qualityScore =
    (prMergeRate * 0.4 + prReviewTimeScore * 0.4 + blockerScore * 0.2) * 100;

  return Math.min(100, Math.max(0, Math.round(qualityScore)));
};

/**
 * Calculates an individual team member's productivity score (0-100)
 * @private
 */
const calculateMemberProductivityScore = ({
  tasks,
  prMetrics,
  commitMetrics,
}) => {
  // Normalize metrics to 0-1 range
  const taskCompletionScore =
    tasks.total > 0
      ? tasks.completed / Math.max(5, tasks.total) // Cap at 5 tasks for 100% score
      : 0;

  const prThroughputScore = Math.min(prMetrics.merged / 5, 1); // Cap at 5 PRs for 100% score
  const commitScore = Math.min(commitMetrics.total / 20, 1); // Cap at 20 commits for 100% score

  // Weighted average of all scores
  const productivityScore =
    (taskCompletionScore * 0.5 + prThroughputScore * 0.3 + commitScore * 0.2) *
    100;

  return Math.min(100, Math.max(0, Math.round(productivityScore)));
};

/**
 * Calculates an individual team member's health score (0-100)
 * @private
 */
const calculateMemberHealthScore = ({ tasks, prMetrics }) => {
  // Normalize metrics to 0-1 range
  const taskBlockedScore =
    tasks.completed > 0 ? Math.max(0, 1 - tasks.blocked / tasks.completed) : 1; // Assume healthy if no tasks

  const prMergeRate =
    prMetrics.total > 0 ? prMetrics.merged / prMetrics.total : 1; // Assume healthy if no PRs

  // Weighted average of all scores
  const healthScore = (taskBlockedScore * 0.6 + prMergeRate * 0.4) * 100;

  return Math.min(100, Math.max(0, Math.round(healthScore)));
};
