import { useMemo } from 'react'

export const useHappinessScore = (burnoutData, githubData, clickupData, teammate) => {
  const calculateHappinessScore = useMemo(() => {
    if (!teammate || !burnoutData) return { score: 50, level: 'neutral', factors: [] }

    const factors = []
    let score = 70 // Start with neutral-positive baseline

    // Primary factor: Inverse of burnout score (weight: 40%)
    const burnoutImpact = Math.floor(burnoutData.score * 0.4)
    score -= burnoutImpact
    if (burnoutImpact > 0) {
      factors.push({ 
        type: 'burnout_impact', 
        value: burnoutData.score, 
        impact: -burnoutImpact,
        description: `Burnout level: ${burnoutData.level}`
      })
    }

    // Factor 2: Recent accomplishments (weight: 25%)
    const recentActivity = githubData?.getActivityForDateRange?.(teammate, 7) || { commits: 0, pullRequests: 0 }
    const completedTasks = clickupData?.getCompletedTasks?.(teammate, 7)?.length || 0
    
    const accomplishmentScore = Math.min((recentActivity.commits * 2) + (recentActivity.pullRequests * 3) + (completedTasks * 4), 25)
    score += accomplishmentScore
    if (accomplishmentScore > 0) {
      factors.push({
        type: 'recent_accomplishments',
        value: { commits: recentActivity.commits, prs: recentActivity.pullRequests, tasks: completedTasks },
        impact: accomplishmentScore,
        description: 'Recent productive activity'
      })
    }

    // Factor 3: Task completion rate (weight: 20%)
    const taskMetrics = clickupData?.getTaskMetrics?.(teammate) || { completionRate: 0 }
    let completionBonus = 0
    if (taskMetrics.completionRate > 80) {
      completionBonus = 20
    } else if (taskMetrics.completionRate > 60) {
      completionBonus = 15
    } else if (taskMetrics.completionRate > 40) {
      completionBonus = 10
    } else if (taskMetrics.completionRate < 20) {
      completionBonus = -10
    }
    
    score += completionBonus
    if (completionBonus !== 0) {
      factors.push({
        type: 'completion_rate',
        value: taskMetrics.completionRate,
        impact: completionBonus,
        description: `Task completion rate: ${Math.round(taskMetrics.completionRate)}%`
      })
    }

    // Factor 4: Blocked tasks penalty (weight: 10%)
    const blockedTasks = clickupData?.getBlockedTasks?.(teammate)?.length || 0
    const blockedPenalty = blockedTasks * 5
    score -= blockedPenalty
    if (blockedPenalty > 0) {
      factors.push({
        type: 'blocked_tasks',
        value: blockedTasks,
        impact: -blockedPenalty,
        description: `${blockedTasks} blocked task${blockedTasks > 1 ? 's' : ''}`
      })
    }

    // Factor 5: PR merge success (weight: 5%)
    const mergedPRs = githubData?.pullRequests?.filter(pr => 
      pr.author === teammate && pr.state === 'closed' && pr.merged_at
    )?.length || 0
    
    const mergeBonus = Math.min(mergedPRs * 2, 10)
    score += mergeBonus
    if (mergeBonus > 0) {
      factors.push({
        type: 'merged_prs',
        value: mergedPRs,
        impact: mergeBonus,
        description: `${mergedPRs} merged PR${mergedPRs > 1 ? 's' : ''}`
      })
    }

    // Ensure score stays within bounds
    score = Math.max(0, Math.min(100, score))

    // Determine happiness level
    let level = 'neutral'
    let emoji = '😐'
    
    if (score >= 80) {
      level = 'very_happy'
      emoji = '😄'
    } else if (score >= 65) {
      level = 'happy'
      emoji = '😊'
    } else if (score >= 45) {
      level = 'neutral'
      emoji = '😐'
    } else if (score >= 30) {
      level = 'concerned'
      emoji = '😕'
    } else {
      level = 'unhappy'
      emoji = '😞'
    }

    return {
      score: Math.round(score),
      level,
      emoji,
      factors,
      burnoutLevel: burnoutData.level
    }
  }, [burnoutData, githubData, clickupData, teammate])

  const getHappinessInsights = (happinessData) => {
    const insights = []

    if (happinessData.level === 'very_happy') {
      insights.push('🎉 This teammate is thriving! Great work-life balance.')
    } else if (happinessData.level === 'happy') {
      insights.push('✨ This teammate seems to be doing well overall.')
    } else if (happinessData.level === 'neutral') {
      insights.push('📊 This teammate is maintaining steady progress.')
    } else if (happinessData.level === 'concerned') {
      insights.push('⚠️ This teammate might need some support or check-in.')
    } else if (happinessData.level === 'unhappy') {
      insights.push('🚨 This teammate likely needs immediate attention and support.')
    }

    // Add specific insights based on factors
    const negativeFactors = happinessData.factors.filter(f => f.impact < 0)
    const positiveFactors = happinessData.factors.filter(f => f.impact > 0)

    if (negativeFactors.length > 0) {
      const mainIssue = negativeFactors.reduce((prev, current) => 
        Math.abs(prev.impact) > Math.abs(current.impact) ? prev : current
      )
      insights.push(`Main concern: ${mainIssue.description}`)
    }

    if (positiveFactors.length > 0) {
      const mainStrength = positiveFactors.reduce((prev, current) => 
        prev.impact > current.impact ? prev : current
      )
      insights.push(`Strength: ${mainStrength.description}`)
    }

    return insights
  }

  const shouldCelebrate = (happinessData) => {
    return happinessData.level === 'very_happy' || 
           (happinessData.level === 'happy' && 
            happinessData.factors.some(f => f.type === 'recent_accomplishments' && f.impact > 15))
  }

  return {
    happinessData: calculateHappinessScore,
    getHappinessInsights,
    shouldCelebrate
  }
}
