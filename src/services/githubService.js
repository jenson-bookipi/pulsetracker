/**
 * GitHub Service
 * Handles all GitHub API interactions
 */

/**
 * Fetches pull requests for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} token - GitHub access token
 * @param {Object} options - Additional options for filtering
 * @returns {Promise<Array>} Array of pull requests
 */
export const fetchPullRequests = async (owner, repo, token, options = {}) => {
  try {
    const { state = "all", per_page = 100, page = 1 } = options;

    const headers = {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    };

    const queryParams = new URLSearchParams({
      state,
      per_page,
      page,
      sort: "updated",
      direction: "desc",
    });

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `GitHub API error: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub pull requests:", error);
    throw error;
  }
};

/**
 * Fetches commits for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} token - GitHub access token
 * @param {Object} options - Additional options for filtering
 * @returns {Promise<Array>} Array of commits
 */
export const fetchCommits = async (owner, repo, token, options = {}) => {
  try {
    const { since, until, per_page = 100, page = 1 } = options;

    const headers = {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    };

    const queryParams = new URLSearchParams({
      per_page,
      page,
      ...(since && { since: new Date(since).toISOString() }),
      ...(until && { until: new Date(until).toISOString() }),
    });

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `GitHub API error: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub commits:", error);
    throw error;
  }
};

/**
 * Fetches user activity metrics
 * @param {string} username - GitHub username
 * @param {string} token - GitHub access token
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} User activity metrics
 */
export const fetchUserActivity = async (username, token, options = {}) => {
  try {
    const { days = 30 } = options;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch user's public events
    const response = await fetch(
      `https://api.github.com/users/${username}/events?per_page=100`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `GitHub API error: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    const events = await response.json();
    const recentEvents = events.filter(
      (event) => new Date(event.created_at) >= since
    );

    // Count different types of events
    const eventCounts = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});

    // Calculate activity score
    const activityScore = Math.min(
      100,
      Math.floor(
        (recentEvents.length / 50) * 100 // Normalize to 100 with 50 events as max
      )
    );

    return {
      username,
      totalEvents: recentEvents.length,
      eventCounts,
      activityScore,
      lastActive: recentEvents[0]?.created_at || null,
    };
  } catch (error) {
    console.error("Error fetching GitHub user activity:", error);
    throw error;
  }
};

/**
 * Calculates PR metrics
 * @param {Array} pullRequests - Array of pull requests
 * @returns {Object} PR metrics
 */
export const calculatePRMetrics = (pullRequests) => {
  if (!pullRequests || !pullRequests.length) {
    return {
      total: 0,
      open: 0,
      merged: 0,
      closed: 0,
      averageTimeToMerge: 0,
      averageTimeToFirstReview: 0,
      byAuthor: {},
    };
  }

  const now = new Date();
  const prsWithTimes = pullRequests.map((pr) => {
    const created = new Date(pr.created_at);
    const merged = pr.merged_at ? new Date(pr.merged_at) : null;
    const closed = pr.closed_at ? new Date(pr.closed_at) : null;
    const firstReview = pr.reviews?.[0]?.submitted_at
      ? new Date(pr.reviews[0].submitted_at)
      : null;

    return {
      ...pr,
      timeToMerge: merged ? (merged - created) / (1000 * 60 * 60 * 24) : null, // in days
      timeToFirstReview: firstReview
        ? (firstReview - created) / (1000 * 60 * 60)
        : null, // in hours
    };
  });

  // Fix: Check merged_at field instead of merged property
  const mergedPRs = prsWithTimes.filter((pr) => pr.merged_at !== null);
  const openPRs = prsWithTimes.filter((pr) => pr.state === "open");
  const closedPRs = prsWithTimes.filter(
    (pr) => pr.state === "closed" && pr.merged_at === null
  );

  // Group by author
  const byAuthor = prsWithTimes.reduce((acc, pr) => {
    const author = pr.user?.login || "unknown";
    if (!acc[author]) {
      acc[author] = {
        total: 0,
        open: 0,
        merged: 0,
        closed: 0,
        averageTimeToMerge: 0,
        averageTimeToFirstReview: 0,
      };
    }

    acc[author].total += 1;
    if (pr.state === "open") acc[author].open += 1;
    if (pr.merged_at !== null) acc[author].merged += 1;
    if (pr.state === "closed" && pr.merged_at === null) acc[author].closed += 1;

    return acc;
  }, {});

  // Calculate averages for each author
  Object.keys(byAuthor).forEach((author) => {
    const authorPRs = prsWithTimes.filter((pr) => pr.user?.login === author);
    const mergedPRs = authorPRs.filter((pr) => pr.merged_at !== null);
    const reviewedPRs = authorPRs.filter((pr) => pr.timeToFirstReview !== null);

    byAuthor[author].averageTimeToMerge =
      mergedPRs.length > 0
        ? mergedPRs.reduce((sum, pr) => sum + (pr.timeToMerge || 0), 0) /
          mergedPRs.length
        : 0;

    byAuthor[author].averageTimeToFirstReview =
      reviewedPRs.length > 0
        ? reviewedPRs.reduce(
            (sum, pr) => sum + (pr.timeToFirstReview || 0),
            0
          ) / reviewedPRs.length
        : 0;
  });

  return {
    total: prsWithTimes.length,
    open: openPRs.length,
    merged: mergedPRs.length,
    closed: closedPRs.length,
    averageTimeToMerge:
      mergedPRs.length > 0
        ? mergedPRs.reduce((sum, pr) => sum + (pr.timeToMerge || 0), 0) /
          mergedPRs.length
        : 0,
    averageTimeToFirstReview:
      prsWithTimes.filter((pr) => pr.timeToFirstReview !== null).length > 0
        ? prsWithTimes
            .filter((pr) => pr.timeToFirstReview !== null)
            .reduce((sum, pr) => sum + (pr.timeToFirstReview || 0), 0) /
          prsWithTimes.filter((pr) => pr.timeToFirstReview !== null).length
        : 0,
    byAuthor,
  };
};

/**
 * Calculates commit metrics
 * @param {Array} commits - Array of commits
 * @returns {Object} Commit metrics
 */
export const calculateCommitMetrics = (commits) => {
  if (!commits || !commits.length) {
    return {
      total: 0,
      byAuthor: {},
    };
  }

  return {
    total: commits.length,
    byAuthor: commits.reduce((acc, commit) => {
      const author =
        commit.author?.login || commit.commit?.author?.name || "unknown";
      acc[author] = (acc[author] || 0) + 1;
      return acc;
    }, {}),
  };
};
