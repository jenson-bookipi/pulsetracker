import { useState, useEffect } from 'react'
import { 
  User, 
  Users, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Circle, 
  Play, 
  Pause,
  ExternalLink,
  Hash,
  Flag,
  MessageSquare,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react'
import { fetchClickUpListTasks } from '../utils/clickupTaskFetcher'

const ClickUpTaskList = ({ 
  listId, 
  token, 
  title = "ClickUp Tasks",
  showFilters = true,
  autoRefresh = false,
  refreshInterval = 300000 // 5 minutes
}) => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filteredTasks, setFilteredTasks] = useState([])
  const [filters, setFilters] = useState({
    status: 'all',
    assignee: 'all',
    points: 'all',
    search: ''
  })
  const [lastRefresh, setLastRefresh] = useState(null)

  // Fetch tasks
  const fetchTasks = async () => {
    if (!listId || !token) {
      setError('Missing list ID or token')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const fetchedTasks = await fetchClickUpListTasks(listId, token)
      setTasks(fetchedTasks)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error fetching tasks:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    fetchTasks()

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchTasks, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [listId, token, autoRefresh, refreshInterval])

  // Get unique values for filters
  const uniqueStatuses = [...new Set(tasks.map(task => task.status))];
  const uniqueAssignees = [...new Set(tasks.flatMap(task => task.assignees || []))].filter(Boolean);
  const uniquePoints = [...new Set(tasks.map(task => task.points || 'Unestimated'))];

  // Apply filters
  useEffect(() => {
    let filtered = [...tasks];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(task => 
        task.status?.toLowerCase() === filters.status.toLowerCase()
      );
    }

    // Assignee filter
    if (filters.assignee !== 'all') {
      filtered = filtered.filter(task => 
        (task.assignees || []).some(assignee => 
          assignee?.toLowerCase().includes(filters.assignee.toLowerCase())
        )
      );
    }

    // Points filter
    if (filters.points !== 'all') {
      filtered = filtered.filter(task => 
        (task.points || 'Unestimated') === filters.points
      );
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(task => 
        task.name.toLowerCase().includes(searchTerm) ||
        (task.description || '').toLowerCase().includes(searchTerm)
      );
    }

    setFilteredTasks(filtered);
  }, [tasks, filters]);

  // Render filter controls
  const renderFilters = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Filter Tasks</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label htmlFor="status-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Assignee Filter */}
        <div>
          <label htmlFor="assignee-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Assignee
          </label>
          <select
            id="assignee-filter"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            value={filters.assignee}
            onChange={(e) => setFilters({...filters, assignee: e.target.value})}
          >
            <option value="all">All Assignees</option>
            {uniqueAssignees.map(assignee => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
        </div>

        {/* Points Filter */}
        <div>
          <label htmlFor="points-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Story Points
          </label>
          <select
            id="points-filter"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            value={filters.points}
            onChange={(e) => setFilters({...filters, points: e.target.value})}
          >
            <option value="all">All Points</option>
            {uniquePoints.sort((a, b) => {
              if (a === 'Unestimated') return 1;
              if (b === 'Unestimated') return -1;
              return Number(a) - Number(b);
            }).map(points => (
              <option key={points} value={points}>
                {points === 'Unestimated' ? 'Unestimated' : `${points} pts`}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-xs font-medium text-gray-600 mb-1">
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              id="search"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center space-x-2">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchTasks}
            className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
            title="Refresh tasks"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showFilters && renderFilters()}

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No tasks found matching your filters.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Task
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignees
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            <a 
                              href={task.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {task.name}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        task.status?.toLowerCase() === 'in progress' ? 'bg-blue-100 text-blue-800' :
                        task.status?.toLowerCase() === 'done' ? 'bg-green-100 text-green-800' :
                        task.status?.toLowerCase() === 'in review' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status || 'No Status'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex -space-x-1 overflow-hidden">
                        {task.assignees?.length > 0 ? (
                          task.assignees.map((assignee, idx) => (
                            <div 
                              key={idx}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              title={assignee}
                            >
                              {assignee.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.points ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                          {task.points} pts
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

}

export default ClickUpTaskList
