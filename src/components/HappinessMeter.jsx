import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const HappinessMeter = ({ teamMembers, happinessData, showIndividual = true }) => {
  const teamStats = useMemo(() => {
    if (!teamMembers || teamMembers.length === 0 || !happinessData) {
      return { average: 50, distribution: {}, trend: 'neutral' }
    }

    const scores = teamMembers.map(member => {
      const memberHappiness = happinessData[member.name]
      return memberHappiness?.score || 50
    })

    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    
    const distribution = {
      very_happy: scores.filter(s => s >= 80).length,
      happy: scores.filter(s => s >= 65 && s < 80).length,
      neutral: scores.filter(s => s >= 45 && s < 65).length,
      concerned: scores.filter(s => s >= 30 && s < 45).length,
      unhappy: scores.filter(s => s < 30).length
    }

    // Simple trend calculation (could be enhanced with historical data)
    const trend = average >= 65 ? 'positive' : average <= 45 ? 'negative' : 'neutral'

    return { average, distribution, trend, scores }
  }, [teamMembers, happinessData])

  const getHappinessColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 65) return 'text-green-500'
    if (score >= 45) return 'text-gray-500'
    if (score >= 30) return 'text-orange-500'
    return 'text-red-500'
  }

  const getHappinessEmoji = (score) => {
    if (score >= 80) return '😄'
    if (score >= 65) return '😊'
    if (score >= 45) return '😐'
    if (score >= 30) return '😕'
    return '😞'
  }

  const getDistributionColor = (level) => {
    switch (level) {
      case 'very_happy': return 'bg-green-500'
      case 'happy': return 'bg-green-400'
      case 'neutral': return 'bg-gray-400'
      case 'concerned': return 'bg-orange-400'
      case 'unhappy': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'positive': return <TrendingUp className="h-5 w-5 text-green-500" />
      case 'negative': return <TrendingDown className="h-5 w-5 text-red-500" />
      default: return <Minus className="h-5 w-5 text-gray-500" />
    }
  }

  if (!teamMembers || teamMembers.length === 0) {
    return (
      <div className="metric-card">
        <h3 className="font-semibold text-gray-900 mb-4">Team Happiness</h3>
        <div className="text-center py-8 text-gray-500">
          <p>No team data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-900">Team Happiness</h3>
        <div className="flex items-center">
          {getTrendIcon(teamStats.trend)}
          <span className="ml-1 text-sm text-gray-500 capitalize">
            {teamStats.trend}
          </span>
        </div>
      </div>

      {/* Team Average */}
      <div className="text-center mb-6">
        <div className={`text-4xl mb-2 ${getHappinessColor(teamStats.average)}`}>
          {getHappinessEmoji(teamStats.average)}
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {teamStats.average}/100
        </div>
        <div className="text-sm text-gray-500">Team Average</div>
        
        {/* Progress Bar */}
        <div className="mt-3 w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${
              teamStats.average >= 80 ? 'bg-green-500' :
              teamStats.average >= 65 ? 'bg-green-400' :
              teamStats.average >= 45 ? 'bg-gray-400' :
              teamStats.average >= 30 ? 'bg-orange-400' : 'bg-red-500'
            }`}
            style={{ width: `${teamStats.average}%` }}
          />
        </div>
      </div>

      {/* Distribution */}
      <div className="mb-6">
        <h4 className="font-medium text-sm text-gray-700 mb-3">Team Distribution</h4>
        <div className="space-y-2">
          {Object.entries(teamStats.distribution).map(([level, count]) => {
            const percentage = teamMembers.length > 0 ? (count / teamMembers.length) * 100 : 0
            const labels = {
              very_happy: 'Very Happy',
              happy: 'Happy',
              neutral: 'Neutral',
              concerned: 'Concerned',
              unhappy: 'Unhappy'
            }
            
            return (
              <div key={level} className="flex items-center">
                <div className="w-20 text-xs text-gray-600">
                  {labels[level]}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-2 mx-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getDistributionColor(level)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-8 text-xs text-gray-600 text-right">
                  {count}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Individual Members */}
      {showIndividual && (
        <div>
          <h4 className="font-medium text-sm text-gray-700 mb-3">Individual Scores</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {teamMembers
              .map(member => ({
                ...member,
                happiness: happinessData?.[member.name] || { score: 50, emoji: '😐', level: 'neutral' }
              }))
              .sort((a, b) => b.happiness.score - a.happiness.score)
              .map((member) => (
                <div key={member.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-primary-700 font-medium text-xs">
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <span className="font-medium text-sm text-gray-900">
                      {member.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="text-lg mr-2">
                      {member.happiness.emoji}
                    </span>
                    <span className={`font-semibold text-sm ${getHappinessColor(member.happiness.score)}`}>
                      {member.happiness.score}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {teamStats.distribution.unhappy > 0 && (
            <p className="text-red-600 mb-1">
              ⚠️ {teamStats.distribution.unhappy} team member{teamStats.distribution.unhappy > 1 ? 's' : ''} need{teamStats.distribution.unhappy === 1 ? 's' : ''} attention
            </p>
          )}
          {teamStats.distribution.very_happy > 0 && (
            <p className="text-green-600 mb-1">
              🎉 {teamStats.distribution.very_happy} team member{teamStats.distribution.very_happy > 1 ? 's' : ''} {teamStats.distribution.very_happy === 1 ? 'is' : 'are'} thriving
            </p>
          )}
          {teamStats.average >= 65 && (
            <p className="text-green-600">
              ✨ Team morale is positive overall
            </p>
          )}
          {teamStats.average <= 45 && (
            <p className="text-orange-600">
              📊 Consider team check-ins or workload adjustments
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default HappinessMeter
