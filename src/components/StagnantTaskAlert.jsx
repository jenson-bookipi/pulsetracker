import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, User, ExternalLink } from 'lucide-react';

const StagnantTaskAlert = ({ stagnantTasks = [], thresholdHours = 24, thresholdUnit = 'hours', isMonitoring = false, lastCheck = null }) => {
  // Stable state to prevent rapid flickering
  const [displayTasks, setDisplayTasks] = useState([]);
  const [hasEverHadTasks, setHasEverHadTasks] = useState(false);

  // Update display tasks with debouncing to prevent flickering
  useEffect(() => {
    console.log('🎯 StagnantTaskAlert received tasks:', stagnantTasks.length);
    
    if (stagnantTasks.length > 0) {
      setHasEverHadTasks(true);
      setDisplayTasks(stagnantTasks);
    } else if (hasEverHadTasks) {
      // Keep showing tasks for a brief moment to prevent flickering
      const timeout = setTimeout(() => {
        setDisplayTasks([]);
      }, 2000); // 2 second delay before clearing
      
      return () => clearTimeout(timeout);
    }
  }, [stagnantTasks, hasEverHadTasks]);
  if (!displayTasks || displayTasks.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Clock className="h-4 w-4 text-green-600" />
            </div>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-green-800">
              All Tasks Moving Forward
            </h3>
            <p className="text-sm text-green-700 mt-1">
              No tasks have been stagnant for more than {thresholdHours} {thresholdUnit === 'seconds' ? 'seconds' : 'hours'}.
            </p>
            {isMonitoring && lastCheck && (
              <p className="text-xs text-green-600 mt-1">
                Last checked: {lastCheck.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-center mb-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </div>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Stagnant Tasks Detected
          </h3>
          <p className="text-sm text-yellow-700">
            {displayTasks.length} task{displayTasks.length !== 1 ? 's' : ''} haven't been updated in over {thresholdHours} {thresholdUnit === 'seconds' ? 'seconds' : 'hours'}
          </p>
          {isMonitoring && lastCheck && (
            <p className="text-xs text-yellow-600 mt-1">
              Last checked: {lastCheck.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {displayTasks.map((task) => {
          const lastUpdated = new Date(parseInt(task.date_updated));
          const timeSinceUpdate = new Date() - lastUpdated;
          const stagnantDuration = thresholdUnit === 'seconds' 
            ? Math.floor(timeSinceUpdate / 1000) // seconds
            : Math.floor(timeSinceUpdate / (1000 * 60 * 60)); // hours
          const unitLabel = thresholdUnit === 'seconds' ? 's' : 'h';
          const assigneeNames = task.assignees?.map(a => a.username).join(', ') || 'Unassigned';

          return (
            <div key={task.id} className="bg-white border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {task.name}
                    </h4>
                    {task.url && (
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-yellow-600 hover:text-yellow-800"
                        title="Open in ClickUp"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{assigneeNames}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Stagnant for {stagnantDuration}{unitLabel}</span>
                    </div>
                  </div>

                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {task.status?.status || 'In Progress'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-yellow-200">
        <p className="text-xs text-yellow-700">
          💡 These tasks may need attention or status updates. Consider reaching out to assignees.
        </p>
      </div>
    </div>
  );
};

export default StagnantTaskAlert;
