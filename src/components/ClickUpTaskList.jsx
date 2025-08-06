import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Circle, 
  RefreshCw,
  Search,
  Filter,
  ExternalLink
} from 'lucide-react';
import { fetchTasksFromList } from '../services/clickupService';

const ClickUpTaskList = ({ 
  listId, 
  token, 
  title = "ClickUp Tasks",
  showFilters = true,
  autoRefresh = false,
  refreshInterval = 300000 // 5 minutes
}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    assignee: 'all',
    search: ''
  });

  // Memoized fetch function
  const fetchTasks = useCallback(async () => {
    if (!listId || !token) {
      setError('Missing list ID or token');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const tasks = await fetchTasksFromList(listId, token, {
        includeClosed: true,
        pageSize: 100
      });
      
      setTasks(tasks);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [listId, token]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    fetchTasks();

    let intervalId;
    if (autoRefresh && refreshInterval > 0) {
      intervalId = setInterval(fetchTasks, refreshInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchTasks, autoRefresh, refreshInterval]);

  // Filter tasks based on current filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Status filter
      if (filters.status !== 'all' && task.status?.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }
      
      // Assignee filter
      if (filters.assignee !== 'all' && 
          !task.assignees?.some(a => a.username?.toLowerCase().includes(filters.assignee.toLowerCase()))) {
        return false;
      }
      
      // Search filter
      if (filters.search && !task.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [tasks, filters]);

  // Get unique values for filters
  const { statuses, assignees } = useMemo(() => {
    const statusSet = new Set();
    const assigneeSet = new Set();
    
    tasks.forEach(task => {
      if (task.status?.status) {
        statusSet.add(task.status.status);
      }
      
      task.assignees?.forEach(assignee => {
        if (assignee.username) {
          assigneeSet.add(assignee.username);
        }
      });
    });
    
    return {
      statuses: Array.from(statusSet).sort(),
      assignees: Array.from(assigneeSet).sort()
    };
  }, [tasks]);

  if (loading && tasks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading tasks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
        <div className="flex items-center space-x-2">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Last updated: {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="p-1 rounded-full hover:bg-gray-100"
            title="Refresh tasks"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
              <select
                value={filters.assignee}
                onChange={(e) => setFilters(f => ({ ...f, assignee: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Assignees</option>
                {assignees.map(assignee => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Search tasks..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignees</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
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
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span 
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${task.status?.status?.toLowerCase().includes('complete') 
                          ? 'bg-green-100 text-green-800' 
                          : task.status?.status?.toLowerCase().includes('in progress') 
                            ? 'bg-blue-100 text-blue-800' 
                            : task.status?.status?.toLowerCase().includes('blocked')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'}`}
                    >
                      {task.status?.status || 'No Status'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex -space-x-2">
                      {task.assignees?.map(assignee => (
                        <div 
                          key={assignee.id} 
                          className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600"
                          title={assignee.username || 'Unassigned'}
                        >
                          {assignee.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      ))}
                      {(!task.assignees || task.assignees.length === 0) && (
                        <span className="text-sm text-gray-500">Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : 'No due date'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a 
                      href={task.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900"
                      title="Open in ClickUp"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                  {tasks.length === 0 ? 'No tasks found' : 'No tasks match the current filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClickUpTaskList;
