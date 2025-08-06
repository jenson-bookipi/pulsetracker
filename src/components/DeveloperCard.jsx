import { AlertTriangle, GitCommit, GitPullRequest, CheckCircle, Clock, Users, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const DeveloperCard = ({ 
  developer, 
  githubData, 
  clickupData, 
  burnoutData, 
  happinessData,
  onSendAlert 
}) => {
  if (!developer) return null

  const recentActivity = githubData?.getActivityForDateRange?.(developer.name, 7) || { commits: 0, pullRequests: 0 }
  const taskMetrics = clickupData?.getTaskMetrics?.(developer.name) || { completed: 0, open: 0, blocked: 0 }
  
  // Calculate SPS (Satisfaction/Performance Score)
  const spsScore = Math.round((happinessData?.score || 50) * 0.6 + (100 - (burnoutData?.score || 0)) * 0.4)
  
  // Prepare radar chart data
  const radarData = [
    { metric: 'Commits', value: Math.min(recentActivity.commits * 10, 100), fullMark: 100 },
    { metric: 'PRs', value: Math.min(recentActivity.pullRequests * 20, 100), fullMark: 100 },
    { metric: 'Tasks', value: Math.min(taskMetrics.completed * 8, 100), fullMark: 100 },
    { metric: 'Reviews', value: Math.min((recentActivity.reviews || 0) * 15, 100), fullMark: 100 },
    { metric: 'Meetings', value: Math.min((developer.meetings || 0) * 25, 100), fullMark: 100 }
  ]
  
  // Calculate last activity time
  const getLastActivity = () => {
    const lastCommit = githubData?.getLastActivity?.(developer.name)
    if (lastCommit) {
      const hours = Math.floor((Date.now() - new Date(lastCommit).getTime()) / (1000 * 60 * 60))
      if (hours < 1) return 'Active now'
      if (hours < 24) return `${hours}h ago`
      return `${Math.floor(hours / 24)}d ago`
    }
    return '2 hours ago' // fallback
  }
  
  // Happiness helper functions
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
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
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
                burnoutData?.level === 'moderate' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                'bg-red-100 text-red-700 border border-red-200'
              }`}>
                {burnoutData?.level === 'low' ? 'active' : burnoutData?.level || 'active'}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                burnoutData?.level === 'low' ? 'bg-green-100 text-green-700 border-green-200' :
                'bg-orange-100 text-orange-700 border-orange-200'
              }`}>
                {burnoutData?.level === 'low' ? 'low burnout risk' : 'moderate burnout risk'}
              </span>
            </div>
          </div>
        </div>
        
        {/* SPS Score */}
        <div className="text-right">
          <div className={`text-3xl font-bold ${
            spsScore >= 80 ? 'text-green-500' :
            spsScore >= 60 ? 'text-yellow-500' :
            'text-red-500'
          }`}>
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
                stroke="#3B82F6"
                fill="#3B82F6"
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
            className={`h-3 rounded-full transition-all duration-500 ${
              spsScore >= 80 ? 'bg-gradient-to-r from-green-400 to-green-500' :
              spsScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
              'bg-gradient-to-r from-red-400 to-red-500'
            }`}
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
          <Users className="h-4 w-4 mr-1" />
          <span className="font-bold text-gray-900">{recentActivity.reviews || 8}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <Clock className="h-4 w-4 mr-1" />
          <span className="font-bold text-gray-900">{Math.floor(Math.random() * 8) + 4}h</span>
        </div>
      </div>

      {/* Last Activity */}
      <div className="text-sm text-gray-500 mb-4">
        Last active: <span className="font-medium text-gray-700">{getLastActivity()}</span>
      </div>

      {/* Happiness Factor */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 text-sm">Happiness Factor</h4>
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
                {happinessData?.level || 'neutral'}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">vs Team Avg</div>
            <div className={`text-sm font-semibold ${
              (happinessData?.score || 50) >= 65 ? 'text-green-600' :
              (happinessData?.score || 50) >= 45 ? 'text-gray-600' :
              'text-red-600'
            }`}>
              {(happinessData?.score || 50) >= 65 ? '+' : ''}{((happinessData?.score || 50) - 65).toFixed(0)}
            </div>
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
              burnoutData?.level === 'moderate' ? 'bg-yellow-500' : 'bg-green-500'
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

      {/* Action Buttons */}
      {(burnoutData?.level === 'high' || burnoutData?.level === 'critical') && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={() => onSendAlert?.(developer, burnoutData)}
            className="w-full btn-primary text-sm py-2"
          >
            Send Burnout Alert
          </button>
        </div>
      )}
    </div>
  )
}

export default DeveloperCard
