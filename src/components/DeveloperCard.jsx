import { AlertTriangle, GitCommit, GitPullRequest, CheckCircle, Clock, Users, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const DeveloperCard = ({
  developer,
  githubData,
  clickupData
}) => {
  if (!developer) return null

  // Map display names to actual GitHub usernames
  const githubUsernameMap = {
    'Heejai Kim': 'heejai-bookipi',
    'Jenson Miralles': 'jenson-bookipi'
  };

  // ClickUp user ID mapping for task filtering
  const clickUpUserIdMap = {
    'Heejai Kim': 66811314,
    'Jenson Miralles': 54741331
  };

  // Parse GitHub activity data
  const parseGitHubActivity = () => {
    if (!githubData || !githubData.pullRequests || !githubData.commits) {
      return { commits: 0, pullRequests: 0, reviews: 0 };
    }

    const memberName = githubUsernameMap[developer.name] || developer.githubUsername || developer.name;
    const prs = githubData.pullRequests || [];
    const commits = githubData.commits || [];
    
    // Count PRs by this member in the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPRs = prs.filter(pr => {
      const prDate = new Date(pr.created_at);
      const matches = pr.user?.login === memberName;
      return matches && prDate >= weekAgo;
    });

    // Count commits by this member in the last 7 days
    const recentCommits = commits.filter(commit => {
      const commitDate = new Date(commit.commit?.author?.date || commit.commit?.committer?.date);
      const authorMatches = commit.author?.login === memberName;
      const nameMatches = commit.commit?.author?.name === memberName;
      const matches = authorMatches || nameMatches;
      return matches && commitDate >= weekAgo;
    });

    return {
      commits: recentCommits.length,
      pullRequests: recentPRs.length
    };
  };

  // Parse ClickUp task data
  const parseClickUpTasks = () => {
    if (!clickupData || !clickupData.tasks) {
      return { completed: 0, open: 0, blocked: 0, total: 0 };
    }

    const memberName = developer.name;
    const tasks = clickupData.tasks || [];

    // Filter tasks assigned to this member using ID-based matching
    const memberTasks = tasks.filter(task => {
      const assignees = task.assignees || [];
      const memberClickUpId = clickUpUserIdMap[memberName];
      
      // If we have a valid ClickUp ID, use ID-based matching only
      if (memberClickUpId) {
        return assignees.some(assignee => assignee.id === memberClickUpId);
      }
      
      // Fallback to username matching only if no ID available
      return assignees.some(assignee => 
        assignee.username === memberName || 
        assignee.name === memberName ||
        assignee.email === developer.email
      );
    });
    
    // Count tasks by status
    const completed = memberTasks.filter(task => {
      const status = typeof task.status === 'string' ? task.status : task.status?.status || task.status?.name || '';
      return status.toLowerCase().includes('complete') || status.toLowerCase().includes('done') || status.toLowerCase().includes('closed');
    }).length;

    const blocked = memberTasks.filter(task => {
      const status = typeof task.status === 'string' ? task.status : task.status?.status || task.status?.name || '';
      return status.toLowerCase().includes('block') || status.toLowerCase().includes('stuck');
    }).length;

    const open = memberTasks.length - completed;

    return { completed, open, blocked, total: memberTasks.length };
  };

  const recentActivity = parseGitHubActivity();
  const taskMetrics = parseClickUpTasks();
  
  // Calculate Smart Productivity Score (SPS) using weighted metrics
  const calculateSPS = () => {
    const weights = {
      commits: 0.35,    // Git commits weight (increased)
      prs: 0.35,        // PRs merged weight (increased)
      tasks: 0.30       // Tasks completed weight
    };
    
    // Normalize metrics to 0-100 scale
    const commitScore = Math.min(recentActivity.commits * 8, 100);
    const prScore = Math.min(recentActivity.pullRequests * 15, 100);
    const taskScore = Math.min(taskMetrics.completed * 10, 100);
    
    const sps = Math.round(
      commitScore * weights.commits +
      prScore * weights.prs +
      taskScore * weights.tasks
    );
    
    return sps;
  };
  
  // Calculate individual happiness scores for all team members
  const calculateAllMemberHappiness = () => {
    if (!clickupData?.tasks) {
      return { memberScores: [], teamAverage: 50 };
    }
    
    const teamMembers = ['Heejai Kim', 'Jenson Miralles'];
    const memberScores = [];
    
    teamMembers.forEach(memberName => {
      // Get tasks for this member using ID-based matching
      const memberTasks = (clickupData.tasks || []).filter(task => {
        const assignees = task.assignees || [];
        const memberClickUpId = clickUpUserIdMap[memberName];
        
        // If we have a valid ClickUp ID, use ID-based matching only
        if (memberClickUpId) {
          return assignees.some(assignee => assignee.id === memberClickUpId);
        }
        
        // Fallback to username matching only if no ID available
        return assignees.some(assignee => {
          const usernameExactMatch = assignee.username === memberName;
          const usernameContainsName = assignee.username?.includes(memberName);
          const emailMatch = assignee.email?.includes(memberName.toLowerCase().replace(' ', '.'));
          return usernameExactMatch || usernameContainsName || emailMatch;
        });
      });
      
      const totalTasks = memberTasks.length;
      const completedTasks = memberTasks.filter(task => {
        const status = typeof task.status === 'string' ? task.status : task.status?.status || task.status?.name || '';
        return status.toLowerCase().includes('complete') || status.toLowerCase().includes('done');
      }).length;
      const openTasks = memberTasks.filter(task => {
        const status = typeof task.status === 'string' ? task.status : task.status?.status || task.status?.name || '';
        return status.toLowerCase().includes('progress') || status.toLowerCase().includes('doing') || status.toLowerCase().includes('active');
      }).length;
      const blockedTasks = memberTasks.filter(task => {
        const status = typeof task.status === 'string' ? task.status : task.status?.status || task.status?.name || '';
        return status.toLowerCase().includes('block') || status.toLowerCase().includes('stuck');
      }).length;
      
      // Calculate raw happiness score (0-100)
      let happiness = 50; // Default baseline
      
      if (totalTasks > 0) {
        const completionRatio = completedTasks / totalTasks;
        const blockedRatio = blockedTasks / totalTasks;
        const openRatio = openTasks / totalTasks;
        
        // Base score from completion ratio (0-60 points)
        const completionScore = completionRatio * 60;
        
        // Penalty for open tasks (0-25 points penalty)
        const openPenalty = openRatio * 25;
        
        // Penalty for blocked tasks (0-40 points penalty)
        const blockedPenalty = blockedRatio * 40;
        
        happiness = Math.max(0, Math.min(100, 
          50 + completionScore - openPenalty - blockedPenalty
        ));
      }
      
      memberScores.push({ name: memberName, score: Math.round(happiness) });
    });
    
    // Calculate team average
    const teamAverage = memberScores.reduce((sum, member) => sum + member.score, 0) / memberScores.length;
    
    return { memberScores, teamAverage: Math.round(teamAverage) };
  };
  
  // Calculate Pulse Factor and team average difference
  const calculateHappiness = () => {
    const { memberScores, teamAverage } = calculateAllMemberHappiness();
    
    // Find this member's score
    const currentMemberScore = memberScores.find(member => 
      member.name === developer.name
    )?.score || 50;
    
    return {
      score: currentMemberScore,
      teamAverage: teamAverage,
      difference: currentMemberScore - teamAverage
    };
  };
  
  // Calculate burnout based on actual workload intensity and team comparison
  const calculateBurnout = () => {
    const totalTasks = taskMetrics.total;
    const completedTasks = taskMetrics.completed;
    const blockedTasks = taskMetrics.blocked;
    const recentCommits = recentActivity.commits;
    const recentPRs = recentActivity.pullRequests;
    
    // Calculate team averages for relative comparison
    const teamMembers = ['Heejai Kim', 'Jenson Miralles'];
    let teamTotalCommits = 0;
    let teamTotalPRs = 0;
    let teamTotalTasks = 0;
    
    teamMembers.forEach(memberName => {
      const memberGithubName = githubUsernameMap[memberName] || memberName;
      const memberClickUpId = clickUpUserIdMap[memberName];
      
      // Count member's commits
      const memberCommits = (githubData?.commits || []).filter(commit => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const commitDate = new Date(commit.commit?.author?.date || commit.commit?.committer?.date);
        const authorMatches = commit.author?.login === memberGithubName;
        const nameMatches = commit.commit?.author?.name === memberName;
        return (authorMatches || nameMatches) && commitDate >= weekAgo;
      }).length;
      
      // Count member's PRs
      const memberPRs = (githubData?.pullRequests || []).filter(pr => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const prDate = new Date(pr.created_at);
        return pr.user?.login === memberGithubName && prDate >= weekAgo;
      }).length;
      
      // Count member's tasks
      const memberTasks = (clickupData?.tasks || []).filter(task => {
        const assignees = task.assignees || [];
        if (memberClickUpId) {
          return assignees.some(assignee => assignee.id === memberClickUpId);
        }
        return assignees.some(assignee => 
          assignee.username === memberName || assignee.name === memberName
        );
      }).length;
      
      teamTotalCommits += memberCommits;
      teamTotalPRs += memberPRs;
      teamTotalTasks += memberTasks;
    });
    
    const avgCommits = teamTotalCommits / teamMembers.length;
    const avgPRs = teamTotalPRs / teamMembers.length;
    const avgTasks = teamTotalTasks / teamMembers.length;
    
    // 1. Development Activity Overload (0-50 points) - Major factor
    // Compare against team average, heavily weight high activity
    const commitOverload = avgCommits > 0 ? Math.min(40, (recentCommits / avgCommits - 1) * 25) : 0;
    const prOverload = avgPRs > 0 ? Math.min(20, (recentPRs / avgPRs - 1) * 15) : 0;
    const activityOverload = Math.max(0, commitOverload + prOverload);
    
    // 2. Task Management Stress (0-25 points) - Reduced weight
    const taskOverload = avgTasks > 0 ? Math.min(15, (totalTasks / avgTasks - 1) * 10) : 0;
    const blockedStress = totalTasks > 0 ? Math.round((blockedTasks / totalTasks) * 10) : 0;
    const taskStress = Math.max(0, taskOverload + blockedStress);
    
    // 3. Work-Life Balance Indicator (0-25 points)
    // High activity with low completion suggests overcommitment
    const completionRatio = totalTasks > 0 ? completedTasks / totalTasks : 1;
    const activityIntensity = recentCommits + (recentPRs * 2); // PRs count more
    const balanceScore = activityIntensity > 10 && completionRatio < 0.7 ? 25 : 
                        activityIntensity > 5 && completionRatio < 0.5 ? 15 : 0;
    
    // Total burnout score (max 100)
    const burnout = Math.min(100, Math.round(activityOverload + taskStress + balanceScore));
    
    // More nuanced level calculation
    const level = burnout > 70 ? 'critical' : 
                  burnout > 50 ? 'high' : 
                  burnout > 25 ? 'medium' : 'low';
    
    return { 
      score: burnout, 
      level,
      factors: {
        activityOverload: Math.round(activityOverload),
        taskStress: Math.round(taskStress),
        balanceScore: Math.round(balanceScore),
        teamComparison: {
          commitsVsAvg: avgCommits > 0 ? (recentCommits / avgCommits).toFixed(1) : 'N/A',
          prsVsAvg: avgPRs > 0 ? (recentPRs / avgPRs).toFixed(1) : 'N/A'
        }
      }
    };
  };
  
  const spsScore = calculateSPS();
  const happinessData = calculateHappiness();
  const burnoutData = calculateBurnout();
  
  // Dynamic color functions based on percentage
  const getSPSColor = (score) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-blue-500';
    if (score >= 30) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  const getSPSGradient = (score) => {
    if (score >= 70) return 'bg-gradient-to-r from-green-400 to-green-500';
    if (score >= 50) return 'bg-gradient-to-r from-blue-400 to-blue-500';
    if (score >= 30) return 'bg-gradient-to-r from-yellow-400 to-yellow-500';
    return 'bg-gradient-to-r from-red-400 to-red-500';
  };
  
  const getRadarColor = (score) => {
    if (score >= 70) return { stroke: '#10B981', fill: '#10B981' }; // green
    if (score >= 50) return { stroke: '#3B82F6', fill: '#3B82F6' }; // blue
    if (score >= 30) return { stroke: '#F59E0B', fill: '#F59E0B' }; // yellow
    return { stroke: '#EF4444', fill: '#EF4444' }; // red
  };
  
  const radarColors = getRadarColor(spsScore);
  
  // Calculate team averages for relative radar chart
  const calculateTeamAverages = () => {
    if (!clickupData?.tasks || !githubData?.commits || !githubData?.pullRequests) {
      return { avgCommits: 1, avgPRs: 1, avgTasks: 1 }; // fallback
    }
    
    // Get all team members from the parent component or calculate from data
    const teamMembers = ['Heejai Kim', 'Jenson Miralles']; // TODO: make this dynamic
    
    let totalCommits = 0, totalPRs = 0, totalTasks = 0;
    
    teamMembers.forEach(memberName => {
      const memberGithubName = githubUsernameMap[memberName] || memberName;
      
      // Count commits for this member
      const memberCommits = (githubData.commits || []).filter(commit => 
        commit.author?.login === memberGithubName || commit.commit?.author?.name === memberName
      );
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentCommits = memberCommits.filter(commit => {
        const commitDate = new Date(commit.commit?.author?.date || commit.commit?.committer?.date);
        return commitDate >= weekAgo;
      });
      
      // Count PRs for this member
      const memberPRs = (githubData.pullRequests || []).filter(pr => {
        const prDate = new Date(pr.created_at);
        return pr.user?.login === memberGithubName && prDate >= weekAgo;
      });
      
      // Count completed tasks for this member using ID-based matching
      const memberTasks = (clickupData.tasks || []).filter(task => {
        const assignees = task.assignees || [];
        const memberClickUpId = clickUpUserIdMap[memberName];
        
        // If we have a valid ClickUp ID, use ID-based matching only
        if (memberClickUpId) {
          return assignees.some(assignee => assignee.id === memberClickUpId);
        }
        
        // Fallback to username matching only if no ID available
        return assignees.some(assignee => {
          const usernameExactMatch = assignee.username === memberName;
          const usernameContainsName = assignee.username?.includes(memberName);
          const emailMatch = assignee.email?.includes(memberName.toLowerCase().replace(' ', '.'));
          return usernameExactMatch || usernameContainsName || emailMatch;
        });
      });
      const completedTasks = memberTasks.filter(task => {
        const status = typeof task.status === 'string' ? task.status : task.status?.status || task.status?.name || '';
        return status.toLowerCase().includes('complete') || status.toLowerCase().includes('done');
      });
      
      totalCommits += recentCommits.length;
      totalPRs += memberPRs.length;
      totalTasks += completedTasks.length;
    });
    
    const avgCommits = totalCommits / teamMembers.length;
    const avgPRs = totalPRs / teamMembers.length;
    const avgTasks = totalTasks / teamMembers.length;
    
    return { avgCommits, avgPRs, avgTasks };
  };
  
  // Calculate relative values based on team average (average = 50%)
  const { avgCommits, avgPRs, avgTasks } = calculateTeamAverages();
  
  const calculateRelativeValue = (individualValue, teamAverage) => {
    if (teamAverage === 0) return individualValue > 0 ? 100 : 50;
    
    // Team average = 50%, scale individual values relative to average
    const ratio = individualValue / teamAverage;
    const relativeValue = 50 * ratio;
    
    // Cap at reasonable bounds (0-100)
    return Math.max(0, Math.min(100, Math.round(relativeValue)));
  };
  
  // Prepare radar chart data with team-relative values
  const radarData = [
    { 
      metric: 'Commits', 
      value: calculateRelativeValue(recentActivity.commits, avgCommits),
      fullMark: 100,
      individual: recentActivity.commits,
      teamAvg: avgCommits.toFixed(1)
    },
    { 
      metric: 'PRs', 
      value: calculateRelativeValue(recentActivity.pullRequests, avgPRs),
      fullMark: 100,
      individual: recentActivity.pullRequests,
      teamAvg: avgPRs.toFixed(1)
    },
    { 
      metric: 'Tasks', 
      value: calculateRelativeValue(taskMetrics.completed, avgTasks),
      fullMark: 100,
      individual: taskMetrics.completed,
      teamAvg: avgTasks.toFixed(1)
    }
  ];
  

  
  // Happiness helper functions
  const getHappinessColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 65) return 'text-green-500'
    if (score >= 45) return 'text-gray-500'
    if (score >= 30) return 'text-orange-500'
    return 'text-red-500'
  }

  const getHappinessEmoji = (score) => {
    if (score >= 80) return '😊';
    if (score >= 65) return '🙂';
    if (score >= 45) return '😐';
    if (score >= 30) return '😟';
    return '😢';
  };

  const getHappinessLevel = (score) => {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 45) return 'neutral';
    if (score >= 30) return 'concerning';
    return 'critical';
  };

  const getHappinessTrend = (score) => {
    // Simple trend calculation based on score (could be enhanced with historical data)
    if (score >= 65) return 'positive'
    if (score <= 45) return 'negative'
    return 'neutral'
  }
  
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'positive': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'negative': return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getBurnoutColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }



  return (
    <div className="metric-card relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3 shadow-lg">
            <span className="text-white font-bold text-lg">
              {developer.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{developer.name}</h3>
            <p className="text-sm text-gray-600 font-medium">{developer.role || 'Senior Frontend Developer'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                burnoutData?.level === 'low' ? 'bg-green-100 text-green-700 border border-green-200' :
                burnoutData?.level === 'medium' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                'bg-red-100 text-red-700 border border-red-200'
              }`}>
                {burnoutData?.level === 'low' ? 'active' : burnoutData?.level || 'active'}
              </span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                {taskMetrics.total} tasks
              </span>
            </div>
          </div>
        </div>
        
        {/* SPS Score */}
        <div className="text-right">
          <div className={`text-3xl font-bold ${getSPSColor(spsScore)}`}>
            {spsScore}%
          </div>
          <div className="text-sm text-gray-500 font-medium">
            SPS Score
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="mb-6">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid gridType="polygon" className="opacity-30" />
              <PolarAngleAxis 
                dataKey="metric" 
                tick={{ fontSize: 12, fill: '#6B7280' }}
                className="text-gray-500"
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]} 
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickCount={6}
              />
              <Radar
                name="Performance"
                dataKey="value"
                stroke={radarColors.stroke}
                fill={radarColors.fill}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Productivity Score Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Productivity Score</span>
          <span className="text-sm font-bold text-gray-900">{spsScore}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getSPSGradient(spsScore)}`}
            style={{ width: `${spsScore}%` }}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="flex justify-between items-center mb-4 text-sm">
        <div className="flex items-center text-gray-600">
          <GitCommit className="h-4 w-4 mr-1" />
          <span className="font-bold text-gray-900">{recentActivity.commits}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <GitPullRequest className="h-4 w-4 mr-1" />
          <span className="font-bold text-gray-900">{recentActivity.pullRequests}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <Clock className="h-4 w-4 mr-1" />
          <span className="font-bold text-gray-900">{Math.floor(Math.random() * 8) + 4}h</span>
        </div>
      </div>



      {/* Pulse Factor */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 text-sm">Pulse Factor</h4>
          <div className="flex items-center">
            {getTrendIcon(getHappinessTrend(happinessData?.score || 50))}
            <span className="ml-1 text-xs text-gray-500 capitalize">
              {getHappinessTrend(happinessData?.score || 50)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <div className={`text-2xl mr-3 ${getHappinessColor(happinessData?.score || 50)}`}>
              {getHappinessEmoji(happinessData?.score || 50)}
            </div>
            <div>
              <div className={`text-xl font-bold ${getHappinessColor(happinessData?.score || 50)}`}>
                {happinessData?.score || 50}/100
              </div>
              <div className="text-xs text-gray-500">
                {getHappinessLevel(happinessData?.score || 50)}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">vs Team Avg</div>
            <span className={`text-sm font-medium ${
              (happinessData?.difference || 0) >= 0 ? 'text-green-600' :
              'text-red-600'
            }`}>
              {(happinessData?.difference || 0) >= 0 ? '+' : ''}{happinessData?.difference || 0}
            </span>
          </div>
        </div>
        
        {/* Happiness Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${
              (happinessData?.score || 50) >= 80 ? 'bg-green-500' :
              (happinessData?.score || 50) >= 65 ? 'bg-green-400' :
              (happinessData?.score || 50) >= 45 ? 'bg-gray-400' :
              (happinessData?.score || 50) >= 30 ? 'bg-orange-400' : 'bg-red-500'
            }`}
            style={{ width: `${happinessData?.score || 50}%` }}
          />
        </div>
        
        {/* Happiness Insights */}
        <div className="text-xs text-gray-600">
          {(happinessData?.score || 50) >= 80 && (
            <span className="text-green-600">🎉 Thriving and engaged</span>
          )}
          {(happinessData?.score || 50) >= 65 && (happinessData?.score || 50) < 80 && (
            <span className="text-green-600">✨ Positive and productive</span>
          )}
          {(happinessData?.score || 50) >= 45 && (happinessData?.score || 50) < 65 && (
            <span className="text-gray-600">📊 Stable, room for improvement</span>
          )}
          {(happinessData?.score || 50) >= 30 && (happinessData?.score || 50) < 45 && (
            <span className="text-orange-600">⚠️ May need support</span>
          )}
          {(happinessData?.score || 50) < 30 && (
            <span className="text-red-600">🚨 Needs immediate attention</span>
          )}
        </div>
      </div>

      {/* Burnout Indicator */}
      <div className={`rounded-lg p-3 border ${getBurnoutColor(burnoutData?.level)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="font-medium text-sm">
              Burnout: {burnoutData?.level || 'low'}
            </span>
          </div>
          <span className="text-sm font-semibold">
            {burnoutData?.score || 0}/100
          </span>
        </div>
        
        {/* Burnout Progress Bar */}
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              burnoutData?.level === 'critical' ? 'bg-red-500' :
              burnoutData?.level === 'high' ? 'bg-orange-500' :
              burnoutData?.level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${burnoutData?.score || 0}%` }}
          />
        </div>
      </div>

      {/* Blocked Tasks Alert */}
      {taskMetrics.blocked > 0 && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span>{taskMetrics.blocked} blocked task{taskMetrics.blocked > 1 ? 's' : ''}</span>
          </div>
        </div>
      )}


    </div>
  )
}

export default DeveloperCard
