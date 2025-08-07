import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle, RefreshCw, Settings, BarChart2, Clock, CheckCircle, AlertCircle, GitPullRequest, GitCommit } from 'lucide-react'

// Import hooks
import { useGitHubData } from '../hooks/useGitHubData'
import { useClickUpData } from '../hooks/useClickUpData'
import { useSlackWebhook } from '../hooks/useSlackWebhook'
import { useBlockedTickets } from '../hooks/useBlockedTickets'
import { useTeamMetrics } from '../hooks/useTeamMetrics'

// Import components
import DeveloperCard from '../components/DeveloperCard'
import BlockerAlert from '../components/BlockerAlert'
import BlockedTicketList from '../components/BlockedTicketList'
import TeamHeatmap from '../components/TeamHeatmap'
import HappinessMeter from '../components/HappinessMeter'
import CorsErrorModal from '../components/CorsErrorModal'
import ClickUpTaskList from '../components/ClickUpTaskList'
import MetricCard from '../components/MetricCard'

const TeamDashboard = () => {
  const [settings, setSettings] = useState(null)
  const [showBlockedTickets, setShowBlockedTickets] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [corsError, setCorsError] = useState(null)
  const [showTaskFilters, setShowTaskFilters] = useState(false)
  const [teamMembersFromList, setTeamMembersFromList] = useState([])
  const [isFetchingMembers, setIsFetchingMembers] = useState(false)

  // Initialize hooks
  const githubData = useGitHubData(settings?.github)
  const clickupData = useClickUpData(settings?.clickup?.token, settings?.clickup?.teamId)
  const slackWebhook = useSlackWebhook(settings?.slack?.webhookUrl)
  const blockedTickets = useBlockedTickets(clickupData, slackWebhook)
  
  // Memoize the team metrics config to prevent unnecessary re-renders
  const teamMetricsConfig = useMemo(() => ({
    clickUpListId: settings?.clickup?.listId || '901810346248',
    clickUpToken: settings?.clickup?.token,
    githubOwner: settings?.github?.owner || 'jenson-bookipi',
    githubRepo: settings?.github?.repo || 'pulsetracker',
    githubToken: settings?.github?.token || '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',
    teamMembers: (settings?.team?.members || []).map(m => m.githubUsername || m.name).filter(Boolean),
    days: 30
  }), [
    settings?.clickup?.listId,
    settings?.clickup?.token,
    settings?.github?.owner,
    settings?.github?.repo,
    settings?.github?.token,
    settings?.team?.members
  ]);

  // Initialize the new team metrics hook with memoized config
  const teamMetrics = useTeamMetrics(teamMetricsConfig)

  // Memoize the fetch function
  const fetchTeamMembers = useCallback(async () => {
    if (!clickupData?.fetchListTasksAndTeamMembers || isFetchingMembers) return;
    
    setIsFetchingMembers(true);
    
    try {
      const LIST_ID = '901810346248';
      const result = await clickupData.fetchListTasksAndTeamMembers(LIST_ID);
      setTeamMembersFromList(prevMembers => {
        // Only update if we have new members to prevent unnecessary re-renders
        const newMembers = result.teamMembers || [];
        if (JSON.stringify(prevMembers) !== JSON.stringify(newMembers)) {
          return newMembers;
        }
        return prevMembers;
      });
    } catch (error) {
      console.error('Error fetching team members from ClickUp list:', error);
    } finally {
      setIsFetchingMembers(false);
    }
  }, [clickupData?.fetchListTasksAndTeamMembers, isFetchingMembers]);

  // Initial fetch when component mounts and when settings are loaded
  useEffect(() => {
    if (settings) {
      fetchTeamMembers();
    }
  }, [settings]);

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
    };

    loadSettings()

    // Listen for settings updates
    const handleSettingsUpdate = (event) => {
      setSettings(event.detail)
    }

    window.addEventListener('pulsetracker-settings-updated', handleSettingsUpdate)
    return () => window.removeEventListener('pulsetracker-settings-updated', handleSettingsUpdate)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        githubData.refresh?.(),
        clickupData.refresh?.(),
        teamMetrics.refresh?.()  // Add team metrics refresh
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

  // Get team members - prioritize list members, fall back to settings
  const teamMembers = teamMembersFromList.length > 0 ? teamMembersFromList : settings?.team?.members || []

  // Calculate burnout and happiness for each team member
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

  const isLoading = githubData.loading || clickupData.loading || teamMetrics.loading
  const metrics = teamMetrics.metrics
  console.log('metricsmetrics', metrics)
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Team Dashboard</h1>
        <div className="flex items-center space-x-2">
          {refreshing ? (
            <span className="text-sm text-gray-500 flex items-center">
              <RefreshCw className="h-4 w-4 animate-spin mr-1" />
              Refreshing...
            </span>
          ) : (
            <span className="text-sm text-gray-500">
              {teamMetrics.lastRefreshed 
                ? `Last updated: ${new Date(teamMetrics.lastRefreshed).toLocaleTimeString()}` 
                : 'Never updated'}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-full ${refreshing 
              ? 'bg-gray-100 text-gray-400' 
              : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800'
            } border border-gray-200 transition-colors`}
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-gray-600">Loading team data...</p>
        </div>
      )}

      {/* Error States */}
      {(githubData.error || clickupData.error || teamMetrics.error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center text-red-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span className="font-medium">Data Loading Errors</span>
          </div>
          <div className="mt-2 text-sm text-red-700">
            {githubData.error && <p>GitHub: {githubData.error}</p>}
            {clickupData.error && <p>ClickUp: {clickupData.error}</p>}
            {teamMetrics.error && <p>Metrics: {teamMetrics.error}</p>}
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Team Metrics Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <BarChart2 className="h-5 w-5 mr-2 text-primary-600" />
              Team Metrics Overview
            </h2>
            
            {/* Health & Productivity Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <div className="text-sm font-medium text-blue-800 mb-1">Team Health</div>
                <div className="text-3xl font-bold text-blue-600">
                  {metrics?.scores?.health || 0}%
                </div>
                <div className="h-2 bg-blue-100 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full" 
                    style={{ width: `${metrics?.scores?.health || 0}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <div className="text-sm font-medium text-green-800 mb-1">Productivity</div>
                <div className="text-3xl font-bold text-green-600">
                  {metrics?.scores?.productivity || 0}%
                </div>
                <div className="h-2 bg-green-100 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-green-600 rounded-full" 
                    style={{ width: `${metrics?.scores?.productivity || 0}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <div className="text-sm font-medium text-purple-800 mb-1">Code Quality</div>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics?.scores?.quality || 0}%
                </div>
                <div className="h-2 bg-purple-100 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 rounded-full" 
                    style={{ width: `${metrics?.scores?.quality || 0}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                title="Tasks Completed"
                value={metrics?.tasks?.completed || 0}
                subValue={metrics?.tasks?.total || 0}
                change={metrics?.tasks?.completed ? 
                  `${Math.round((metrics.tasks.completed / metrics.tasks.total) * 100)}%` : '0%'}
                changeType={metrics?.tasks?.completed > (metrics?.tasks?.total * 0.7) ? 'positive' : 'neutral'}
              />
              
              <MetricCard 
                icon={<GitPullRequest className="h-5 w-5 text-blue-600" />}
                title="Pull Requests"
                value={metrics?.code?.pullRequests?.merged || 0}
                subValue={metrics?.code?.pullRequests?.total || 0}
                change={
                  metrics?.code?.pullRequests?.averageTimeToMerge ? 
                  `${Math.round(metrics.code.pullRequests.averageTimeToMerge)}d` : 'N/A'
                }
                changeType={
                  metrics?.code?.pullRequests?.averageTimeToMerge < 3 ? 'positive' : 
                  metrics?.code?.pullRequests?.averageTimeToMerge > 7 ? 'negative' : 'neutral'
                }
              />
              
              <MetricCard 
                icon={<GitCommit className="h-5 w-5 text-purple-600" />}
                title="Commits"
                value={metrics?.code?.commits?.total || 0}
                change={
                  metrics?.code?.commits?.byAuthor ? 
                  `${Object.keys(metrics.code.commits.byAuthor).length} authors` : '0 authors'
                }
              />
              
              <MetricCard 
                icon={<AlertCircle className="h-5 w-5 text-red-600" />}
                title="Blocked Tasks"
                value={metrics?.tasks?.blocked || 0}
                change={
                  metrics?.tasks?.blocked > 0 ? 
                  `${Math.round((metrics.tasks.blocked / metrics.tasks.total) * 100)}% of total` : '0%'
                }
                changeType={metrics?.tasks?.blocked > 0 ? 'negative' : 'positive'}
              />
            </div>
          </div>

          {/* Health Metrics Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              Team Health Breakdown
            </h2>
            
            {metrics?.healthMetrics?.error ? (
              <div className="text-red-500 p-4 bg-red-50 rounded-md">
                Error loading health metrics: {metrics.healthMetrics.error}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Velocity Metric */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-700">Velocity</h3>
                      <p className="text-sm text-gray-500">
                        {metrics?.healthMetrics?.velocity?.value?.toFixed(1) || '0.0'} points/week
                        <span className="ml-2 text-xs">
                          (target: {metrics?.healthMetrics?.velocity?.target || 20})
                        </span>
                      </p>
                    </div>
                    <div className="text-lg font-semibold">
                      {metrics?.healthMetrics?.velocity?.score?.toFixed(0) || 0}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${metrics?.healthMetrics?.velocity?.score || 0}%` }}
                    />
                  </div>
                </div>

                {/* Blockers Metric */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-700">Blockers</h3>
                      <p className="text-sm text-gray-500">
                        {metrics?.healthMetrics?.blockers?.count || 0} active blockers
                      </p>
                    </div>
                    <div className="text-lg font-semibold">
                      {metrics?.healthMetrics?.blockers?.score?.toFixed(0) || 0}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        (metrics?.healthMetrics?.blockers?.score || 0) > 70 ? 'bg-green-600' : 
                        (metrics?.healthMetrics?.blockers?.score || 0) > 40 ? 'bg-yellow-500' : 'bg-red-600'
                      }`}
                      style={{ width: `${metrics?.healthMetrics?.blockers?.score || 0}%` }}
                    />
                  </div>
                </div>

                {/* PR Merge Rate */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-700">PR Merge Rate</h3>
                      <p className="text-sm text-gray-500">
                        {metrics?.healthMetrics?.prMergeRate?.value?.toFixed(1) || 0}% merged
                        <span className="ml-2 text-xs">
                          (target: {metrics?.healthMetrics?.prMergeRate?.target || 70}%)
                        </span>
                      </p>
                    </div>
                    <div className="text-lg font-semibold">
                      {metrics?.healthMetrics?.prMergeRate?.score?.toFixed(0) || 0}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-purple-600 h-2.5 rounded-full"
                      style={{ width: `${metrics?.healthMetrics?.prMergeRate?.score || 0}%` }}
                    />
                  </div>
                </div>

                {/* Review Time */}
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-700">Avg. First Review Time</h3>
                      <p className="text-sm text-gray-500">
                        {metrics?.healthMetrics?.reviewTime?.hours?.toFixed(1) || 0} hours
                        <span className="ml-2 text-xs">
                          (target: ≤{metrics?.healthMetrics?.reviewTime?.target || 48}h)
                        </span>
                      </p>
                    </div>
                    <div className="text-lg font-semibold">
                      {metrics?.healthMetrics?.reviewTime?.score?.toFixed(0) || 0}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        (metrics?.healthMetrics?.reviewTime?.score || 0) > 80 ? 'bg-green-600' : 
                        (metrics?.healthMetrics?.reviewTime?.score || 0) > 50 ? 'bg-yellow-500' : 'bg-red-600'
                      }`}
                      style={{ width: `${metrics?.healthMetrics?.reviewTime?.score || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {metrics?.healthMetrics?.lastUpdated && (
              <div className="mt-4 text-xs text-gray-500 text-right">
                Last updated: {new Date(metrics.healthMetrics.lastUpdated).toLocaleString()}
              </div>
            )}
          </div>

          {/* Blocker Alert */}
          <BlockerAlert
            blockedTickets={blockedTickets.blockedTickets}
            onViewDetails={() => setShowBlockedTickets(true)}
            onSendAlert={handleSendBlockerAlert}
          />

          {/* Team Members Grid */}
          {teamMembersFromList.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Team Members</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teamMembersFromList.map((member) => {
                  const memberName = member.githubUsername || member.name;
                  const memberMetrics = metrics?.teamMembers?.find(m => m.username === memberName);
                  
                  return (
                    <DeveloperCard
                      key={member.id}
                      developer={member}
                      githubData={githubData}
                      clickupData={clickupData}
                      metrics={memberMetrics}
                      onSendAlert={() => handleSendBurnoutAlert(member)}
                    />
                  );
                })}
              </div>
            </div>
          )}
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

export default TeamDashboard;
