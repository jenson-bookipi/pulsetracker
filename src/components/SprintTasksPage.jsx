import { useState, useEffect } from 'react'
import ClickUpTaskList from './ClickUpTaskList'

const SprintTasksPage = () => {
  const [settings, setSettings] = useState(null)

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

  if (!settings?.clickup?.token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">ClickUp Configuration Required</h2>
          <p className="text-gray-600 mb-6">
            Please configure your ClickUp API token in the settings to view tasks.
          </p>
          <button
            onClick={() => window.location.href = '/settings'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sprint Tasks</h1>
          <p className="mt-2 text-gray-600">
            View and manage tasks from your ClickUp sprint board
          </p>
        </div>

        {/* ClickUp Task List Component */}
        <ClickUpTaskList
          listId="901810346214"
          token={settings.clickup.token}
          title="Sprint Board Tasks"
          showFilters={true}
          autoRefresh={true}
          refreshInterval={300000} // 5 minutes
        />

        {/* Additional Information */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">About This Sprint</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">List ID:</span>
              <span className="ml-2 text-gray-600">901810346214</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Source URL:</span>
              <a 
                href="https://app.clickup.com/6912544/v/l/li/901810346214?pr=90030340817"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                View in ClickUp
              </a>
            </div>
            <div>
              <span className="font-medium text-gray-700">Auto Refresh:</span>
              <span className="ml-2 text-green-600">Every 5 minutes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SprintTasksPage
