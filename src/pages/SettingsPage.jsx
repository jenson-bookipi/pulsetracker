import { useState, useEffect } from 'react'
import { Save, TestTube, AlertCircle, CheckCircle, Github, Slack, Bell } from 'lucide-react'
import CorsErrorModal from '../components/CorsErrorModal'
import { useSlackWebhook } from '../hooks/useSlackWebhook'

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    github: {
      token: '',
      repos: []
    },
    clickup: {
      token: '',
      teamId: '',
      boardIds: [],
      listIds: []
    },
    slack: {
      webhookUrl: ''
    },
    team: {
      members: []
    },
    alerts: {
      stagnantTaskEnabled: false,
      stagnantTaskThresholdHours: 24,
      stagnantTaskThresholdUnit: 'hours' // 'hours' or 'seconds'
    }
  })

  const [newRepo, setNewRepo] = useState('')
  const [newMember, setNewMember] = useState({ name: '', role: '', githubUsername: '', clickupId: '' })
  const [newBoardId, setNewBoardId] = useState('')
  const [newListId, setNewListId] = useState('')
  const [testResults, setTestResults] = useState({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState({})
  const [corsError, setCorsError] = useState(null)
  
  const slackWebhook = useSlackWebhook(settings.slack.webhookUrl)

  // Direct test alert function for stagnant tasks using existing slackWebhook hook
  const testStagnantTaskAlert = async () => {
    if (!settings?.slack?.webhookUrl) {
      alert('Please configure Slack webhook URL first');
      return;
    }

    const alertsEnabled = settings?.alerts?.stagnantTaskEnabled || false;
    const thresholdHours = settings?.alerts?.stagnantTaskThresholdHours || 24;
    const thresholdUnit = settings?.alerts?.stagnantTaskThresholdUnit || 'hours';

    const testMessage = 
      `🧪 *Test Alert*\n\n` +
      `This is a test message from PulseTracker's stagnant task alert system.\n\n` +
      `*Settings:*\n` +
      `• Alerts Enabled: ${alertsEnabled ? 'Yes' : 'No'}\n` +
      `• Threshold: ${thresholdHours} ${thresholdUnit === 'seconds' ? 'seconds' : 'hours'}\n` +
      `• Current Time: ${new Date().toLocaleString()}`;

    try {
      console.log('📤 Sending test stagnant task alert via Supabase...');
      const result = await slackWebhook.sendMessage(testMessage, 'info');
      
      if (result) {
        console.log('✅ Test alert sent successfully');
        alert('Test alert sent successfully!');
      } else {
        console.error('❌ Failed to send test alert:', slackWebhook.error);
        
        // Check if it's a CORS error and show the modal
        if (slackWebhook.error && typeof slackWebhook.error === 'object' && slackWebhook.error.type === 'CORS_BLOCKED') {
          setCorsError(slackWebhook.error);
          alert('CORS error detected - see modal for alternatives');
        } else {
          alert(`Failed to send test alert: ${slackWebhook.error?.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('❌ Test alert error:', error);
      alert(`Failed to send test alert: ${error.message}`);
    }
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('pulsetracker-settings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    try {
      localStorage.setItem('pulsetracker-settings', JSON.stringify(settings))
      // Trigger a custom event to notify other components
      window.dispatchEvent(new CustomEvent('pulsetracker-settings-updated', { detail: settings }))
      setTimeout(() => setSaving(false), 1000) // Show success state briefly
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaving(false)
    }
  }

  const testConnection = async (service) => {
    setTesting(prev => ({ ...prev, [service]: true }))
    setTestResults(prev => ({ ...prev, [service]: null }))

    try {
      let success = false
      let message = ''

      switch (service) {
        case 'github': {
          if (!settings.github.token) {
            throw new Error('GitHub token is required')
          }
          const githubResponse = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${settings.github.token}` }
          })
          if (githubResponse.ok) {
            const user = await githubResponse.json()
            success = true
            message = `Connected as ${user.login}`
          } else {
            throw new Error('Invalid GitHub token')
          }
          break
        }

        case 'clickup': {
          if (!settings.clickup.token || !settings.clickup.teamId) {
            throw new Error('ClickUp token and team ID are required')
          }
          const clickupResponse = await fetch(`https://api.clickup.com/api/v2/team/${settings.clickup.teamId}`, {
            headers: { 'Authorization': settings.clickup.token }
          })
          if (clickupResponse.ok) {
            const team = await clickupResponse.json()
            success = true
            message = `Connected to ${team.team.name}`
          } else {
            throw new Error('Invalid ClickUp credentials')
          }
          break
        }

        case 'slack': {
          if (!settings.slack.webhookUrl) {
            throw new Error('Slack webhook URL is required')
          }
          const result = await slackWebhook.sendMessage('🧪 PulseTracker connection test')
          if (result) {
            success = true
            message = 'Test message sent successfully'
          } else {
            // Check if it's a CORS error
            if (slackWebhook.error && typeof slackWebhook.error === 'object' && slackWebhook.error.type === 'CORS_BLOCKED') {
              setCorsError(slackWebhook.error)
              success = false
              message = 'CORS error detected - see modal for alternatives'
            } else {
              throw new Error(slackWebhook.error || 'Failed to send test message')
            }
          }
          break
        }

        default:
          throw new Error('Unknown service')
      }

      setTestResults(prev => ({ ...prev, [service]: { success, message } }))
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [service]: { success: false, message: error.message } 
      }))
    } finally {
      setTesting(prev => ({ ...prev, [service]: false }))
    }
  }

  const addRepo = () => {
    if (newRepo && !settings.github.repos.includes(newRepo)) {
      setSettings(prev => ({
        ...prev,
        github: {
          ...prev.github,
          repos: [...prev.github.repos, newRepo]
        }
      }))
      setNewRepo('')
    }
  }

  const removeRepo = (repo) => {
    setSettings(prev => ({
      ...prev,
      github: {
        ...prev.github,
        repos: prev.github.repos.filter(r => r !== repo)
      }
    }))
  }

  const addMember = () => {
    if (newMember.name) {
      setSettings(prev => ({
        ...prev,
        team: {
          ...prev.team,
          members: [...prev.team.members, { ...newMember, id: Date.now() }]
        }
      }))
      setNewMember({ name: '', role: '', githubUsername: '', clickupId: '' })
    }
  }

  const removeMember = (memberId) => {
    setSettings(prev => ({
      ...prev,
      team: {
        ...prev.team,
        members: prev.team.members.filter(m => m.id !== memberId)
      }
    }))
  }

  const addBoardId = () => {
    if (newBoardId.trim() && !settings.clickup.boardIds.includes(newBoardId.trim())) {
      setSettings(prev => ({
        ...prev,
        clickup: {
          ...prev.clickup,
          boardIds: [...prev.clickup.boardIds, newBoardId.trim()]
        }
      }))
      setNewBoardId('')
    }
  }

  const removeBoardId = (boardId) => {
    setSettings(prev => ({
      ...prev,
      clickup: {
        ...prev.clickup,
        boardIds: prev.clickup.boardIds.filter(id => id !== boardId)
      }
    }))
  }

  const addListId = () => {
    if (newListId.trim() && !settings.clickup.listIds.includes(newListId.trim())) {
      setSettings(prev => ({
        ...prev,
        clickup: {
          ...prev.clickup,
          listIds: [...prev.clickup.listIds, newListId.trim()]
        }
      }))
      setNewListId('')
    }
  }

  const removeListId = (listId) => {
    setSettings(prev => ({
      ...prev,
      clickup: {
        ...prev.clickup,
        listIds: prev.clickup.listIds.filter(id => id !== listId)
      }
    }))
  }

  const TestResult = ({ service }) => {
    const result = testResults[service]
    const isLoading = testing[service]

    if (isLoading) {
      return <div className="text-sm text-gray-500">Testing...</div>
    }

    if (!result) return null

    return (
      <div className={`flex items-center text-sm mt-2 ${
        result.success ? 'text-green-600' : 'text-red-600'
      }`}>
        {result.success ? (
          <CheckCircle className="h-4 w-4 mr-1" />
        ) : (
          <AlertCircle className="h-4 w-4 mr-1" />
        )}
        {result.message}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your integrations and team settings</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary flex items-center"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* GitHub Settings */}
      <div className="card">
        <div className="flex items-center mb-4">
          <Github className="h-6 w-6 mr-3" />
          <h2 className="text-xl font-semibold">GitHub Integration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personal Access Token
            </label>
            <input
              type="password"
              value={settings.github.token}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                github: { ...prev.github, token: e.target.value }
              }))}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Generate at: GitHub → Settings → Developer settings → Personal access tokens
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repositories to Monitor
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="owner/repository"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && addRepo()}
              />
              <button onClick={addRepo} className="btn-secondary">
                Add
              </button>
            </div>
            
            <div className="space-y-1">
              {settings.github.repos.map((repo) => (
                <div key={repo} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                  <span className="text-sm">{repo}</span>
                  <button
                    onClick={() => removeRepo(repo)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => testConnection('github')}
              disabled={testing.github || !settings.github.token}
              className="btn-secondary flex items-center"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Connection
            </button>
            <TestResult service="github" />
          </div>
        </div>
      </div>

      {/* ClickUp Settings */}
      <div className="card">
        <div className="flex items-center mb-4">
          <div className="w-6 h-6 bg-purple-600 rounded mr-3 flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <h2 className="text-xl font-semibold">ClickUp Integration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Token
            </label>
            <input
              type="password"
              value={settings.clickup.token}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                clickup: { ...prev.clickup, token: e.target.value }
              }))}
              placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team ID
            </label>
            <input
              type="text"
              value={settings.clickup.teamId}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                clickup: { ...prev.clickup, teamId: e.target.value }
              }))}
              placeholder="123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Find in ClickUp URL: app.clickup.com/[TEAM_ID]/...
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Board IDs (Optional - specific boards to track)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newBoardId}
                onChange={(e) => setNewBoardId(e.target.value)}
                placeholder="Board ID (e.g., 901234567890)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && addBoardId()}
              />
              <button onClick={addBoardId} className="btn-secondary">
                Add
              </button>
            </div>
            
            <div className="space-y-1 mb-3">
              {settings?.clickup?.boardIds?.map((boardId) => (
                <div key={boardId} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                  <span className="text-sm font-mono">{boardId}</span>
                  <button
                    onClick={() => removeBoardId(boardId)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-500">
              Find Board ID in ClickUp URL: app.clickup.com/[TEAM_ID]/v/b/[BOARD_ID]
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              List IDs (Optional - specific lists to track)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newListId}
                onChange={(e) => setNewListId(e.target.value)}
                placeholder="List ID (e.g., 901234567890)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && addListId()}
              />
              <button onClick={addListId} className="btn-secondary">
                Add
              </button>
            </div>
            
            <div className="space-y-1 mb-3">
              {settings?.clickup?.listIds?.map((listId) => (
                <div key={listId} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                  <span className="text-sm font-mono">{listId}</span>
                  <button
                    onClick={() => removeListId(listId)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-500">
              Find List ID in ClickUp URL: app.clickup.com/[TEAM_ID]/v/li/[LIST_ID]. Leave empty to track all lists in the team.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => testConnection('clickup')}
              disabled={testing.clickup || !settings.clickup.token || !settings.clickup.teamId}
              className="btn-secondary flex items-center"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Connection
            </button>
            <TestResult service="clickup" />
          </div>
        </div>
      </div>

      {/* Slack Settings */}
      <div className="card">
        <div className="flex items-center mb-4">
          <Slack className="h-6 w-6 mr-3" />
          <h2 className="text-xl font-semibold">Slack Integration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              value={settings?.slack?.webhookUrl}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                slack: { ...prev.slack, webhookUrl: e.target.value }
              }))}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Create at: Slack → Apps → Incoming Webhooks
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => testConnection('slack')}
              disabled={testing.slack || !settings.slack.webhookUrl}
              className="btn-secondary flex items-center"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Send Test Message
            </button>
            <TestResult service="slack" />
          </div>
        </div>
      </div>

      {/* Stagnant Task Alert Settings */}
      <div className="card">
        <div className="flex items-center mb-4">
          <div className="w-6 h-6 bg-yellow-600 rounded mr-3 flex items-center justify-center">
            <Bell className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-xl font-semibold">Stagnant Task Alerts</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Enable Stagnant Task Alerts</h3>
              <p className="text-sm text-gray-500 mt-1">
                Send Slack notifications when tasks remain in 'in progress' status too long
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.alerts?.stagnantTaskEnabled || false}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  alerts: { ...prev.alerts, stagnantTaskEnabled: e.target.checked }
                }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alert Threshold
            </label>
            <div className="flex items-center gap-4 mb-2">
              <input
                type="number"
                min={settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? "10" : "1"}
                max={settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? "3600" : "168"}
                value={settings?.alerts?.stagnantTaskThresholdHours || 24}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  alerts: { ...prev.alerts, stagnantTaskThresholdHours: parseInt(e.target.value) || 24 }
                }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={!settings?.alerts?.stagnantTaskEnabled}
              />
              <select
                value={settings?.alerts?.stagnantTaskThresholdUnit || 'hours'}
                onChange={(e) => {
                  const newUnit = e.target.value;
                  const currentValue = settings?.alerts?.stagnantTaskThresholdHours || 24;
                  let newValue = currentValue;
                  
                  // Convert between units
                  if (newUnit === 'seconds' && settings?.alerts?.stagnantTaskThresholdUnit === 'hours') {
                    newValue = Math.max(30, currentValue * 3600); // Convert hours to seconds, min 30s
                  } else if (newUnit === 'hours' && settings?.alerts?.stagnantTaskThresholdUnit === 'seconds') {
                    newValue = Math.max(1, Math.round(currentValue / 3600)); // Convert seconds to hours, min 1h
                  }
                  
                  setSettings(prev => ({
                    ...prev,
                    alerts: { 
                      ...prev.alerts, 
                      stagnantTaskThresholdUnit: newUnit,
                      stagnantTaskThresholdHours: newValue
                    }
                  }));
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={!settings?.alerts?.stagnantTaskEnabled}
              >
                <option value="hours">Hours</option>
                <option value="seconds">Seconds (Testing)</option>
              </select>
            </div>
            <div className="text-sm text-gray-500 mb-2">
              Send alert if task hasn't been updated for this duration
            </div>
            <p className="text-xs text-gray-500">
              {settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? (
                <>Range: 10-3600 seconds (10 seconds to 1 hour). For testing purposes only.</>
              ) : (
                <>Range: 1-168 hours (1 hour to 1 week). Default: 24 hours.</>
              )}
            </p>
          </div>

          {/* Check Interval Setting */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Check Interval
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={settings?.alerts?.stagnantTaskCheckInterval || (settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? 30 : 30)}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  const unit = settings?.alerts?.stagnantTaskThresholdUnit || 'hours';
                  const min = unit === 'seconds' ? 10 : 5;
                  const max = unit === 'seconds' ? 300 : 120;
                  const clampedValue = Math.min(Math.max(value, min), max);
                  
                  setSettings(prev => ({
                    ...prev,
                    alerts: { 
                      ...prev.alerts, 
                      stagnantTaskCheckInterval: clampedValue
                    }
                  }));
                }}
                min={settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? 10 : 5}
                max={settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? 300 : 120}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={!settings?.alerts?.stagnantTaskEnabled}
              />
              <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 min-w-[80px] flex items-center justify-center">
                {settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? 'seconds' : 'minutes'}
              </span>
            </div>
            <div className="text-sm text-gray-500 mb-2">
              How often to check for stagnant tasks
            </div>
            <p className="text-xs text-gray-500">
              {settings?.alerts?.stagnantTaskThresholdUnit === 'seconds' ? (
                <>Range: 10-300 seconds. Default: 30 seconds. Shorter intervals provide faster detection but use more resources.</>
              ) : (
                <>Range: 5-120 minutes. Default: 30 minutes. Shorter intervals provide faster detection but use more resources.</>
              )}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Requirements:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>ClickUp token and team ID must be configured</li>
                  <li>Slack webhook URL must be configured</li>
                  <li>Alerts will automatically start when both are ready</li>
                </ul>
              </div>
            </div>
          </div>

          {settings?.alerts?.stagnantTaskEnabled && settings?.slack?.webhookUrl && (
            <div className="flex items-center gap-2">
              <button
                onClick={testStagnantTaskAlert}
                className="btn-secondary flex items-center"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Test Stagnant Task Alert
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Team Settings */}
      <div className="card">
        <div className="flex items-center mb-4">
          <div className="w-6 h-6 bg-blue-600 rounded mr-3 flex items-center justify-center">
            <span className="text-white text-xs font-bold">T</span>
          </div>
          <h2 className="text-xl font-semibold">Team Members</h2>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="text"
              value={newMember.name}
              onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Full Name"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <input
              type="text"
              value={newMember.role}
              onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value }))}
              placeholder="Role (optional)"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <input
              type="text"
              value={newMember.githubUsername}
              onChange={(e) => setNewMember(prev => ({ ...prev, githubUsername: e.target.value }))}
              placeholder="GitHub Username"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button onClick={addMember} className="btn-primary">
              Add Member
            </button>
          </div>

          <div className="space-y-2">
            {settings?.team?.members?.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-gray-500">
                    {member.role && `${member.role} • `}
                    {member.githubUsername && `@${member.githubUsername}`}
                  </div>
                </div>
                <button
                  onClick={() => removeMember(member.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CORS Error Modal */}
      <CorsErrorModal
        error={corsError}
        onClose={() => setCorsError(null)}
      />
    </div>
  )
}

export default SettingsPage
