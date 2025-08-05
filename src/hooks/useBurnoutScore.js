import { useMemo } from 'react'

export const useBurnoutScore = (githubData, clickupData, teammate) => {
  const calculateBurnoutScore = useMemo(() => {
    if (!teammate) return { score: 0, level: 'low', factors: [] }

    const factors = []
    let score = 0

    // Get recent activity (last 7 days)
    const recentActivity = githubData?.getActivityForDateRange?.(teammate, 7) || { commits: 0, pullRequests: 0 }
    const taskMetrics = clickupData?.getTaskMetrics?.(teammate) || { open: 0, completed: 0 }

    // Factor 1: High number of open tasks (weight: 30)
    const openTasks = taskMetrics.open
    if (openTasks > 15) {
      score += 30
      factors.push({ type: 'high_open_tasks', value: openTasks, impact: 30 })
    } else if (openTasks > 10) {
      score += 20
      factors.push({ type: 'moderate_open_tasks', value: openTasks, impact: 20 })
    } else if (openTasks > 5) {
      score += 10
      factors.push({ type: 'some_open_tasks', value: openTasks, impact: 10 })
    }

    // Factor 2: High recent activity (weight: 25)
    const totalActivity = recentActivity.commits + recentActivity.pullRequests
    if (totalActivity > 20) {
      score += 25
      factors.push({ type: 'very_high_activity', value: totalActivity, impact: 25 })
    } else if (totalActivity > 15) {
      score += 20
      factors.push({ type: 'high_activity', value: totalActivity, impact: 20 })
    } else if (totalActivity > 10) {
      score += 15
      factors.push({ type: 'moderate_activity', value: totalActivity, impact: 15 })
    }

    // Factor 3: Many ongoing PRs (weight: 20)
    const ongoingPRs = githubData?.pullRequests?.filter(pr => 
      pr.author === teammate && pr.state === 'open'
    )?.length || 0
    
    if (ongoingPRs > 5) {
      score += 20
      factors.push({ type: 'many_ongoing_prs', value: ongoingPRs, impact: 20 })
    } else if (ongoingPRs > 3) {
      score += 15
      factors.push({ type: 'some_ongoing_prs', value: ongoingPRs, impact: 15 })
    }

    // Factor 4: Low completion rate (weight: 15)
    const completionRate = taskMetrics.completionRate || 0
    if (completionRate < 30) {
      score += 15
      factors.push({ type: 'low_completion_rate', value: completionRate, impact: 15 })
    } else if (completionRate < 50) {
      score += 10
      factors.push({ type: 'moderate_completion_rate', value: completionRate, impact: 10 })
    }

    // Factor 5: Blocked tasks (weight: 10)
    const blockedTasks = clickupData?.getBlockedTasks?.(teammate)?.length || 0
    if (blockedTasks > 0) {
      score += blockedTasks * 5 // 5 points per blocked task
      factors.push({ type: 'blocked_tasks', value: blockedTasks, impact: blockedTasks * 5 })
    }

    // Determine burnout level
    let level = 'low'
    if (score >= 70) level = 'critical'
    else if (score >= 50) level = 'high'
    else if (score >= 30) level = 'moderate'

    return {
      score: Math.min(score, 100), // Cap at 100
      level,
      factors,
      metrics: {
        openTasks,
        recentActivity: totalActivity,
        ongoingPRs,
        completionRate,
        blockedTasks
      }
    }
  }, [githubData, clickupData, teammate])

  const getBurnoutRecommendations = (burnoutData) => {
    const recommendations = []

    if (burnoutData.level === 'critical' || burnoutData.level === 'high') {
      recommendations.push('Consider redistributing some tasks to other team members')
      recommendations.push('Schedule a check-in meeting to discuss workload')
      recommendations.push('Look into blocking issues that might be slowing progress')
    }

    if (burnoutData.metrics.openTasks > 10) {
      recommendations.push('Help prioritize and close out some open tasks')
    }

    if (burnoutData.metrics.ongoingPRs > 3) {
      recommendations.push('Focus on getting PRs reviewed and merged')
    }

    if (burnoutData.metrics.blockedTasks > 0) {
      recommendations.push('Address blocked tasks immediately')
    }

    if (burnoutData.metrics.completionRate < 50) {
      recommendations.push('Break down large tasks into smaller, manageable pieces')
    }

    return recommendations
  }

  const shouldTriggerAlert = (burnoutData) => {
    return burnoutData.level === 'high' || burnoutData.level === 'critical'
  }

  return {
    burnoutData: calculateBurnoutScore,
    getBurnoutRecommendations,
    shouldTriggerAlert
  }
}
