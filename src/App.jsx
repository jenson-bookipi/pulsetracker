import { useState } from 'react'
import { Settings, Users, Activity, AlertTriangle } from 'lucide-react'
import TeamDashboard from './pages/TeamDashboard'
import SettingsPage from './pages/SettingsPage'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'team', name: 'Team', icon: Users },
    { id: 'settings', name: 'Settings', icon: Settings },
  ]

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <TeamDashboard />
      case 'team':
        return <TeamDashboard />
      case 'settings':
        return <SettingsPage />
      default:
        return <TeamDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">PulseTracker</h1>
            </div>
            
            {/* Navigation */}
            <nav className="flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentPage === item.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
