import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react'

// Import hooks
import { useGitHubData } from '../hooks/useGitHubData'
import { useClickUpData } from '../hooks/useClickUpData'
import { useSlackWebhook } from '../hooks/useSlackWebhook'
import { useBlockedTickets } from '../hooks/useBlockedTickets'

// Import components
import DeveloperCard from '../components/DeveloperCard'
import BlockerAlert from '../components/BlockerAlert'
import BlockedTicketList from '../components/BlockedTicketList'
import TeamHeatmap from '../components/TeamHeatmap'
import HappinessMeter from '../components/HappinessMeter'
import CorsErrorModal from '../components/CorsErrorModal'
import ClickUpTaskList from '../components/ClickUpTaskList'

const TeamDashboard = () => {
  const [settings, setSettings] = useState(null)
  const [showBlockedTickets, setShowBlockedTickets] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [corsError, setCorsError] = useState(null)
  const [showTaskFilters, setShowTaskFilters] = useState(false)

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('pulsetracker-settings')
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings))
        } catch (error) {
          console.error('Failed to load settings:', error)
        }
      }
    }

    loadSettings()

    // Listen for settings updates
    const handleSettingsUpdate = (event) => {
      setSettings(event.detail)
    }

    window.addEventListener('pulsetracker-settings-updated', handleSettingsUpdate)
    return () => window.removeEventListener('pulsetracker-settings-updated', handleSettingsUpdate)
  }, [])

  // Initialize hooks with settings
  const githubData = useGitHubData(
    settings?.github?.token,
    settings?.github?.repos || []
  )

  const clickupData = useClickUpData(
    settings?.clickup?.token,
    settings?.clickup?.teamId
  )

  const slackWebhook = useSlackWebhook(settings?.slack?.webhookUrl)
  const blockedTickets = useBlockedTickets(clickupData, slackWebhook)

  // Calculate burnout and happiness for each team member
  const teamMembers = settings?.team?.members || []
  const burnoutData = {}
  const happinessData = {}
  
  teamMembers.forEach(member => {
    const memberName = member.githubUsername || member.name
    const recentActivity = githubData?.getActivityForDateRange?.(memberName, 7) || { commits: 0, pullRequests: 0, totalActivity: 0 }
    const taskMetrics = clickupData?.getTaskMetrics?.(memberName) || { open: 0, completed: 0, blocked: 0 }
    
    // Simple burnout calculation
    const burnoutScore = Math.min(
      (taskMetrics.open > 10 ? 30 : taskMetrics.open > 5 ? 15 : 0) +
      (recentActivity.totalActivity > 15 ? 25 : recentActivity.totalActivity > 10 ? 15 : 0) +
      (taskMetrics.blocked * 10),
      100
    )
    
    const burnoutLevel = burnoutScore >= 70 ? 'critical' : 
                        burnoutScore >= 50 ? 'high' : 
                        burnoutScore >= 30 ? 'moderate' : 'low'
    
    // Simple happiness calculation
    const happinessScore = Math.max(
      70 - (burnoutScore * 0.4) + 
      Math.min((recentActivity.commits * 2) + (recentActivity.pullRequests * 3) + (taskMetrics.completed * 4), 25),
      0
    )
    
    const happinessLevel = happinessScore >= 80 ? 'very_happy' :
                          happinessScore >= 65 ? 'happy' :
                          happinessScore >= 45 ? 'neutral' :
                          happinessScore >= 30 ? 'concerned' : 'unhappy'
    
    burnoutData[memberName] = {
      score: Math.round(burnoutScore),
      level: burnoutLevel,
      factors: [],
      metrics: { openTasks: taskMetrics.open, recentActivity: recentActivity.totalActivity, blockedTasks: taskMetrics.blocked }
    }
    
    happinessData[memberName] = {
      score: Math.round(happinessScore),
      level: happinessLevel,
      emoji: happinessScore >= 80 ? '😄' : happinessScore >= 65 ? '😊' : happinessScore >= 45 ? '😐' : happinessScore >= 30 ? '😕' : '😞',
      factors: []
    }
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        githubData.refresh?.(),
        clickupData.refresh?.()
      ])
    } finally {
      setTimeout(() => setRefreshing(false), 1000)
    }
  }

  const handleSendBurnoutAlert = async (member) => {
    if (!slackWebhook.sendBurnoutAlert) return

    const memberName = member.githubUsername || member.name
    const metrics = {
      openTasks: clickupData.getTaskMetrics?.(memberName)?.open || 0,
      recentActivity: githubData.getActivityForDateRange?.(memberName, 7)?.totalActivity || 0,
      ongoingPRs: githubData.pullRequests?.filter(pr => 
        pr.author === memberName && pr.state === 'open'
      )?.length || 0
    }

    await slackWebhook.sendBurnoutAlert(member.name, metrics)
    
    // Handle CORS errors
    console.log('Checking for CORS errors:', slackWebhook.error)
    if (slackWebhook.error && typeof slackWebhook.error === 'object' && slackWebhook.error.type === 'CORS_BLOCKED') {
      console.log('Setting CORS error in dashboard:', slackWebhook.error)
      setCorsError(slackWebhook.error)
    }
  }

  const handleSendBlockerAlert = async (blockedTasks) => {
    for (const task of blockedTasks) {
      await slackWebhook.sendFollowUpMessage?.(task, task.assigneeName)
      
      // Handle CORS errors
      console.log('Checking for CORS errors in blocker alert:', slackWebhook.error)
      if (slackWebhook.error && typeof slackWebhook.error === 'object' && slackWebhook.error.type === 'CORS_BLOCKED') {
        console.log('Setting CORS error in dashboard from blocker alert:', slackWebhook.error)
        setCorsError(slackWebhook.error)
        break // Stop on first CORS error
      }
    }
  }

  const handleExecuteBlockerAction = async (task, suggestion) => {
    return await blockedTickets.executeAction(task, suggestion)
  }

  const handleOpenTask = (task) => {
    if (task.url) {
      window.open(task.url, '_blank')
    }
  }

  // Show setup message if no settings configured
  if (!settings || !settings.github?.token) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="h-8 w-8 text-primary-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to PulseTracker!</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Get started by configuring your GitHub, ClickUp, and Slack integrations in the settings page.
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings'))}
          className="btn-primary"
        >
          Go to Settings
        </button>
      </div>
    )
  }

  const isLoading = githubData.loading || clickupData.loading

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Dashboard</h1>
          <p className="text-gray-600">
            Monitor your team's productivity, wellness, and blockers
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-gray-600">Loading team data...</p>
        </div>
      )}

      {/* Error States */}
      {(githubData.error || clickupData.error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center text-red-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span className="font-medium">Data Loading Errors</span>
          </div>
          <div className="mt-2 text-sm text-red-700">
            {githubData.error && <p>GitHub: {githubData.error}</p>}
            {clickupData.error && <p>ClickUp: {clickupData.error}</p>}
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Blocker Alert */}
          <BlockerAlert
            blockedTickets={blockedTickets.blockedTickets}
            onViewDetails={() => setShowBlockedTickets(true)}
            onSendAlert={handleSendBlockerAlert}
          />

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Team Happiness */}
            <HappinessMeter
              teamMembers={teamMembers}
              happinessData={happinessData}
              showIndividual={true}
            />

            {/* Team Activity Heatmap */}
            <TeamHeatmap
              githubData={githubData}
              clickupData={clickupData}
              teamMembers={teamMembers}
            />
          </div>

          {/* Sprint Tasks Section */}
          {settings?.clickup?.token && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Sprint Tasks</h2>
                  <button
                    onClick={() => setShowTaskFilters(!showTaskFilters)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    {showTaskFilters ? 'Hide Filters' : 'Show Filters'}
                  </button>
                </div>
                <ClickUpTaskList
                  listId="901810346214"
                  token={settings.clickup.token}
                  title=""
                  showFilters={showTaskFilters}
                  autoRefresh={true}
                  refreshInterval={300000} // 5 minutes
                  compactView={!showTaskFilters}
                />
              </div>
            </div>
          )}

          {/* Team Members Grid */}
          {teamMembers.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Team Members</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teamMembers.map((member) => {
                  const memberName = member.githubUsername || member.name
                  return (
                    <DeveloperCard
                      key={member.id}
                      developer={{ ...member, name: memberName }}
                      githubData={githubData}
                      clickupData={clickupData}
                      burnoutData={burnoutData[memberName]}
                      happinessData={happinessData[memberName]}
                      onSendAlert={() => handleSendBurnoutAlert(member)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-gray-900">
                {teamMembers.length}
              </div>
              <div className="text-sm text-gray-500">Team Members</div>
            </div>
            
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-primary-600">
                {githubData.commits?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Total Commits</div>
            </div>
            
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-green-600">
                {clickupData.tasks?.filter(t => 
                  t.status?.status === 'complete' || t.status?.status === 'closed'
                ).length || 0}
              </div>
              <div className="text-sm text-gray-500">Completed Tasks</div>
            </div>
            
            <div className="metric-card text-center">
              <div className="text-2xl font-bold text-orange-600">
                {blockedTickets.blockedTickets?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Blocked Tasks</div>
            </div>
          </div>
        </>
      )}

      {/* Blocked Tickets Modal */}
      {showBlockedTickets && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Blocked Tasks</h2>
              <button
                onClick={() => setShowBlockedTickets(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <BlockedTicketList
                blockedTickets={blockedTickets.blockedTickets}
                onExecuteAction={handleExecuteBlockerAction}
                onOpenTask={handleOpenTask}
              />
            </div>
          </div>
        </div>
      )}

      {/* CORS Error Modal */}
      <CorsErrorModal
        error={corsError}
        onClose={() => setCorsError(null)}
      />
    </div>
  )
}

export default TeamDashboard
