import { AlertTriangle, Clock, Users } from 'lucide-react'

const BlockerAlert = ({ blockedTickets, onViewDetails, onSendAlert }) => {
  if (!blockedTickets || blockedTickets.length === 0) {
    return (
      <div className="metric-card border-green-200 bg-green-50">
        <div className="flex items-center text-green-700">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-green-600 text-lg">✓</span>
          </div>
          <div>
            <h3 className="font-semibold">No Blockers</h3>
            <p className="text-sm text-green-600">All tasks are flowing smoothly!</p>
          </div>
        </div>
      </div>
    )
  }

  const criticalCount = blockedTickets.filter(t => t.priorityLevel === 'critical').length
  const highCount = blockedTickets.filter(t => t.priorityLevel === 'high').length
  const needsFollowUp = blockedTickets.filter(t => t.needsFollowUp).length

  const getAlertLevel = () => {
    if (criticalCount > 0) return 'critical'
    if (highCount > 2) return 'high'
    if (blockedTickets.length > 5) return 'moderate'
    return 'low'
  }

  const alertLevel = getAlertLevel()
  
  const getAlertColors = (level) => {
    switch (level) {
      case 'critical': return 'border-red-300 bg-red-50 text-red-800'
      case 'high': return 'border-orange-300 bg-orange-50 text-orange-800'
      case 'moderate': return 'border-yellow-300 bg-yellow-50 text-yellow-800'
      default: return 'border-blue-300 bg-blue-50 text-blue-800'
    }
  }

  const getIconColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'moderate': return 'text-yellow-600'
      default: return 'text-blue-600'
    }
  }

  return (
    <div className={`metric-card border-2 ${getAlertColors(alertLevel)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
            alertLevel === 'critical' ? 'bg-red-100' :
            alertLevel === 'high' ? 'bg-orange-100' :
            alertLevel === 'moderate' ? 'bg-yellow-100' : 'bg-blue-100'
          }`}>
            <AlertTriangle className={`h-5 w-5 ${getIconColor(alertLevel)}`} />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">
              {alertLevel === 'critical' ? '🚨 Critical Blockers' :
               alertLevel === 'high' ? '⚠️ High Priority Blockers' :
               alertLevel === 'moderate' ? '⚡ Multiple Blockers' : '📋 Active Blockers'}
            </h3>
            
            <p className="text-sm mb-3">
              {blockedTickets.length} task{blockedTickets.length > 1 ? 's' : ''} currently blocked
              {needsFollowUp > 0 && ` • ${needsFollowUp} need${needsFollowUp > 1 ? '' : 's'} follow-up`}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Clock className="h-4 w-4 mr-1 opacity-60" />
                  <span className="font-semibold">
                    {Math.round(blockedTickets.reduce((sum, t) => sum + t.hoursBlocked, 0) / blockedTickets.length)}h
                  </span>
                </div>
                <p className="text-xs opacity-75">Avg Blocked</p>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <AlertTriangle className="h-4 w-4 mr-1 opacity-60" />
                  <span className="font-semibold text-red-600">
                    {criticalCount}
                  </span>
                </div>
                <p className="text-xs opacity-75">Critical</p>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Users className="h-4 w-4 mr-1 opacity-60" />
                  <span className="font-semibold">
                    {new Set(blockedTickets.map(t => t.assigneeName)).size}
                  </span>
                </div>
                <p className="text-xs opacity-75">People</p>
              </div>
            </div>

            {/* Top Blocked Tasks Preview */}
            <div className="space-y-2 mb-4">
              {blockedTickets.slice(0, 3).map((task, index) => (
                <div key={task.id} className="flex items-center justify-between p-2 bg-white bg-opacity-60 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.name}</p>
                    <p className="text-xs opacity-75">
                      {task.assigneeName} • {Math.floor(task.hoursBlocked / 24)}d blocked
                    </p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ml-2 ${
                    task.priorityLevel === 'critical' ? 'bg-red-500' :
                    task.priorityLevel === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                </div>
              ))}
              
              {blockedTickets.length > 3 && (
                <p className="text-xs opacity-75 text-center">
                  +{blockedTickets.length - 3} more blocked tasks
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t border-current border-opacity-20">
        <button
          onClick={() => onViewDetails?.(blockedTickets)}
          className="flex-1 bg-white bg-opacity-80 hover:bg-opacity-100 text-current font-medium py-2 px-4 rounded-lg transition-all text-sm"
        >
          View All Blockers
        </button>
        
        {needsFollowUp > 0 && (
          <button
            onClick={() => onSendAlert?.(blockedTickets.filter(t => t.needsFollowUp))}
            className="flex-1 bg-current text-white font-medium py-2 px-4 rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            Send Follow-ups ({needsFollowUp})
          </button>
        )}
      </div>
    </div>
  )
}

export default BlockerAlert
