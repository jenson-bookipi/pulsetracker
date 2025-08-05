import { AlertTriangle, GitCommit, GitPullRequest, CheckCircle, Clock } from 'lucide-react'

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

  const getBurnoutColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  const getHappinessColor = (level) => {
    switch (level) {
      case 'very_happy': return 'text-green-600'
      case 'happy': return 'text-green-500'
      case 'neutral': return 'text-gray-500'
      case 'concerned': return 'text-orange-500'
      case 'unhappy': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="metric-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-primary-700 font-semibold text-sm">
              {developer.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{developer.name}</h3>
            <p className="text-sm text-gray-500">{developer.role || 'Developer'}</p>
          </div>
        </div>
        
        {/* Happiness Score */}
        <div className="text-right">
          <div className={`text-2xl ${getHappinessColor(happinessData?.level)}`}>
            {happinessData?.emoji || '😐'}
          </div>
          <div className="text-xs text-gray-500">
            {happinessData?.score || 50}/100
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <GitCommit className="h-4 w-4 text-gray-400 mr-1" />
            <span className="text-lg font-semibold text-gray-900">
              {recentActivity.commits}
            </span>
          </div>
          <p className="text-xs text-gray-500">Commits (7d)</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <GitPullRequest className="h-4 w-4 text-gray-400 mr-1" />
            <span className="text-lg font-semibold text-gray-900">
              {recentActivity.pullRequests}
            </span>
          </div>
          <p className="text-xs text-gray-500">PRs (7d)</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <CheckCircle className="h-4 w-4 text-gray-400 mr-1" />
            <span className="text-lg font-semibold text-gray-900">
              {taskMetrics.completed}
            </span>
          </div>
          <p className="text-xs text-gray-500">Tasks Done</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock className="h-4 w-4 text-gray-400 mr-1" />
            <span className="text-lg font-semibold text-gray-900">
              {taskMetrics.open}
            </span>
          </div>
          <p className="text-xs text-gray-500">Open Tasks</p>
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
