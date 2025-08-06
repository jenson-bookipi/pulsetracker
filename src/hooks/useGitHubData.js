import { useState, useEffect } from "react";

export const useGitHubData = (token, repos = []) => {
  const [data, setData] = useState({
    commits: [],
    pullRequests: [],
    loading: true,
    error: null,
  });

  const fetchGitHubData = async () => {
    if (!token || repos.length === 0) {
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      const headers = {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      };

      // Fetch commits for each repo
      const commitPromises = repos.map(async (repo) => {
        const response = await fetch(
          `https://api.github.com/repos/jenson-bookipi/${repo}/commits?per_page=100`,
          { headers }
        );
        if (!response.ok)
          throw new Error(`Failed to fetch commits for ${repo}`);
        const commits = await response.json();
        return commits.map((commit) => ({
          ...commit,
          repo,
          author: commit.author?.login || commit.commit?.author?.name,
          date: commit.commit?.author?.date,
        }));
      });

      // Fetch pull requests for each repo
      const prPromises = repos.map(async (repo) => {
        const response = await fetch(
          `https://api.github.com/repos/jenson-bookipi/${repo}/pulls?state=all&per_page=100`,
          { headers }
        );
        if (!response.ok) throw new Error(`Failed to fetch PRs for ${repo}`);
        const prs = await response.json();
        return prs.map((pr) => ({
          ...pr,
          repo,
          author: pr.user?.login,
        }));
      });

      const [commitResults, prResults] = await Promise.all([
        Promise.all(commitPromises),
        Promise.all(prPromises),
      ]);

      setData({
        commits: commitResults.flat(),
        pullRequests: prResults.flat(),
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("GitHub API Error:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
    }
  };

  useEffect(() => {
    fetchGitHubData();
  }, [token, repos.join(",")]);

  const getCommitsByAuthor = (author) => {
    return data.commits.filter(
      (commit) =>
        commit.author === author || commit.commit?.author?.name === author
    );
  };

  const getPRsByAuthor = (author) => {
    return data.pullRequests.filter((pr) => pr.author === author);
  };

  const getActivityForDateRange = (author, days = 7) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentCommits = getCommitsByAuthor(author).filter(
      (commit) => new Date(commit.date) > cutoff
    );

    const recentPRs = getPRsByAuthor(author).filter(
      (pr) => new Date(pr.created_at) > cutoff
    );

    return {
      commits: recentCommits.length,
      pullRequests: recentPRs.length,
      totalActivity: recentCommits.length + recentPRs.length,
    };
  };

  return {
    ...data,
    getCommitsByAuthor,
    getPRsByAuthor,
    getActivityForDateRange,
    refresh: fetchGitHubData,
  };
};
