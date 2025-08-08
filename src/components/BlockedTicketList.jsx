import { useState } from 'react'
import { AlertTriangle, Clock, User, ExternalLink, MessageCircle, RefreshCw, UserX, Construction } from 'lucide-react'

const BlockedTicketList = ({ blockedTickets, onExecuteAction, onOpenTask }) => {
  const [executingActions, setExecutingActions] = useState(new Set())

  if (!blockedTickets || blockedTickets.length === 0) {
    return (
      <div className="metric-card text-center py-8">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Construction className="h-8 w-8 text-orange-600" />
        </div>
        <h3 className="font-semibold text-gray-900 mb-2">We are under construction</h3>
        <p className="text-gray-500">This feature is being developed! 🚧</p>
      </div>
    )
  }

  const handleExecuteAction = async (task, suggestion) => {
    const actionKey = `${task.id}-${suggestion.type}`
    setExecutingActions(prev => new Set([...prev, actionKey]))
    
    try {
      await onExecuteAction?.(task, suggestion)
    } finally {
      setExecutingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(actionKey)
        return newSet
      })
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'border-red-300 bg-red-50'
      case 'high': return 'border-orange-300 bg-orange-50'
      case 'medium': return 'border-yellow-300 bg-yellow-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  const getPriorityBadge = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-gray-100 text-gray-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    )
  }

  const getSuggestionIcon = (type) => {
    switch (type) {
      case 'urgent': return <AlertTriangle className="h-4 w-4" />
      case 'communication': return <MessageCircle className="h-4 w-4" />
      case 'review': return <ExternalLink className="h-4 w-4" />
      case 'reassignment': return <UserX className="h-4 w-4" />
      case 'assignment': return <User className="h-4 w-4" />
      default: return <RefreshCw className="h-4 w-4" />
    }
  }

  const getSuggestionColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-600 hover:bg-red-700 text-white'
      case 'medium': return 'bg-orange-600 hover:bg-orange-700 text-white'
      default: return 'bg-gray-600 hover:bg-gray-700 text-white'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Blocked Tasks ({blockedTickets.length})
        </h2>
        <div className="text-sm text-gray-500">
          Sorted by priority and duration
        </div>
      </div>

      <div className="space-y-4">
        {blockedTickets.map((task) => (
          <div
            key={task.id}
            className={`border rounded-lg p-4 ${getPriorityColor(task.priorityLevel)}`}
          >
            {/* Task Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {task.name}
                  </h3>
                  {getPriorityBadge(task.priorityLevel)}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {task.assigneeName}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {Math.floor(task.hoursBlocked / 24)}d {task.hoursBlocked % 24}h blocked
                  </div>
                  {task.space_name && (
                    <div className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {task.space_name}
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => onOpenTask?.(task)}
                className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Open in ClickUp"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>

            {/* Task Status */}
            <div className="mb-3 p-2 bg-white bg-opacity-60 rounded text-sm">
              <span className="font-medium">Status:</span> {task.status?.status || 'Unknown'}
              {task.daysSinceUpdate > 0 && (
                <span className="ml-2 text-gray-500">
                  • Last updated {task.daysSinceUpdate} day{task.daysSinceUpdate > 1 ? 's' : ''} ago
                </span>
              )}
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Suggested Actions:</h4>
              <div className="grid gap-2">
                {task.suggestions.map((suggestion, index) => {
                  const actionKey = `${task.id}-${suggestion.type}`
                  const isExecuting = executingActions.has(actionKey)
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-white bg-opacity-80 rounded"
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="mr-2 text-gray-500">
                          {getSuggestionIcon(suggestion.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{suggestion.action}</p>
                          <p className="text-xs text-gray-600">{suggestion.description}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleExecuteAction(task, suggestion)}
                        disabled={isExecuting}
                        className={`ml-2 px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getSuggestionColor(suggestion.priority)}`}
                      >
                        {isExecuting ? (
                          <div className="flex items-center">
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Sending...
                          </div>
                        ) : (
                          'Execute'
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Follow-up Alert */}
            {task.needsFollowUp && (
              <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-sm">
                <div className="flex items-center text-red-700">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="font-medium">
                    Needs immediate follow-up (blocked for {Math.floor(task.hoursBlocked / 24)} days)
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default BlockedTicketList
