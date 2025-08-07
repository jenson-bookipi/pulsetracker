import { useState, useEffect, useCallback, useMemo } from 'react';

const useStagnantTaskDetector = ({
  alertsEnabled = false,
  thresholdHours = 24,
  thresholdUnit = 'hours',
  checkInterval = 30,
  slackWebhookUrl = '',
  clickUpData = null, // Use passed ClickUp data instead of creating new instance
  refreshClickUpData = null
} = {}) => {
  const [stagnantTasks, setStagnantTasks] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  
  // Debug log for received data
  console.log('🔧 StagnantTaskDetector received:');
  console.log('  ⚙️ Settings:', { alertsEnabled, thresholdHours, thresholdUnit, hasSlackWebhook: !!slackWebhookUrl });
  console.log('  📊 ClickUp Data:', {
    exists: !!clickUpData,
    loading: clickUpData?.loading,
    error: clickUpData?.error,
    tasksCount: clickUpData?.tasks?.length || 0
  });
  if (clickUpData?.tasks?.length > 0) {
    console.log('  📋 Sample Tasks:', clickUpData.tasks.slice(0, 3).map(t => ({
      id: t.id,
      name: t.name,
      status: t.status?.status,
      date_updated: new Date(parseInt(t.date_updated)).toLocaleString()
    })));
  }

  // Detect stagnant tasks based on threshold
  const detectStagnantTasks = useCallback(() => {
    if (!clickUpData || !clickUpData.tasks || clickUpData.tasks.length === 0) {
      console.log('🔍 No ClickUp data available for stagnant task detection');
      return [];
    }

    const now = new Date();
    // Convert threshold to milliseconds based on unit
    const thresholdMs = thresholdUnit === 'seconds' 
      ? thresholdHours * 1000 // Convert seconds to milliseconds
      : thresholdHours * 60 * 60 * 1000; // Convert hours to milliseconds

    return clickUpData.tasks.filter(task => {
      // Check if task is in 'in progress' status (various possible names)
      // Handle both object and string status formats
      let statusText = '';
      if (typeof task.status === 'string') {
        statusText = task.status.toLowerCase();
      } else if (task.status && task.status.status) {
        statusText = task.status.status.toLowerCase();
      } else if (task.status && task.status.name) {
        statusText = task.status.name.toLowerCase();
      }
      
      const isInProgress = statusText && 
        (statusText.includes('progress') ||
         statusText.includes('doing') ||
         statusText.includes('active') ||
         statusText.includes('started'));

      console.log(`🔍 Task "${task.name}" status check:`, {
        rawStatus: task.status,
        statusText,
        isInProgress
      });

      if (!isInProgress) return false;

      // Get the last update time
      const lastUpdated = new Date(parseInt(task.date_updated));
      const timeSinceUpdate = now - lastUpdated;

      return timeSinceUpdate > thresholdMs;
    });
  }, [clickUpData, thresholdHours, thresholdUnit]);

  // Send Slack alert for stagnant task
  const sendStagnantTaskAlert = useCallback(async (task) => {
    if (!slackWebhookUrl) {
      console.warn('Slack webhook URL not configured');
      return;
    }

    const assigneeNames = task.assignees?.map(a => a.username).join(', ') || 'Unassigned';
    const taskUrl = task.url || '#';
    const timeSinceUpdate = new Date() - new Date(parseInt(task.date_updated));
    const stagnantDuration = thresholdUnit === 'seconds' 
      ? Math.floor(timeSinceUpdate / 1000) // seconds
      : Math.floor(timeSinceUpdate / (1000 * 60 * 60)); // hours
    const unitLabel = thresholdUnit === 'seconds' ? 'seconds' : 'hours';

    const message = {
      text: `🚨 *Stagnant Task Alert*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🚨 *Stagnant Task Detected*\n\n*Task:* <${taskUrl}|${task.name}>\n*Assignee(s):* ${assigneeNames}\n*Status:* ${task.status?.status || 'Unknown'}\n*Stagnant for:* ${stagnantDuration} ${unitLabel}\n*Threshold:* ${thresholdHours} ${unitLabel}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `This task has been in progress without updates for over ${thresholdHours} ${unitLabel}. Please check if it needs attention.`
            }
          ]
        }
      ]
    };

    try {
      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }

      console.log(`Stagnant task alert sent for: ${task.name}`);
    } catch (error) {
      console.error('Failed to send stagnant task alert:', error);
    }
  }, [slackWebhookUrl, thresholdHours, thresholdUnit]);

  // Check for stagnant tasks and send alerts
  const checkForStagnantTasks = useCallback(async () => {
    console.log('🔍 Checking for stagnant tasks...', {
      alertsEnabled,
      clickUpDataLoading: clickUpData?.loading,
      tasksCount: clickUpData?.tasks?.length || 0,
      thresholdHours,
      thresholdUnit
    });

    if (!alertsEnabled || !clickUpData || clickUpData.loading) {
      console.log('⏸️ Skipping check - alerts disabled or data loading/unavailable');
      return;
    }

    const currentStagnant = detectStagnantTasks();
    console.log('📊 Detected stagnant tasks:', currentStagnant.length);
    
    // Use functional update to avoid dependency issues
    setStagnantTasks(prevStagnantTasks => {
      const previousStagnantIds = prevStagnantTasks.map(t => t.id);
      
      // Find newly stagnant tasks (not previously detected)
      const newlyStagnant = currentStagnant.filter(task => 
        !previousStagnantIds.includes(task.id)
      );

      // Send alerts for newly stagnant tasks (async operation)
      if (newlyStagnant.length > 0) {
        console.log('🚨 Found newly stagnant tasks:', newlyStagnant.map(t => t.name));
        // Use setTimeout to avoid blocking the state update
        setTimeout(async () => {
          for (const task of newlyStagnant) {
            console.log('📤 Sending alert for task:', task.name);
            await sendStagnantTaskAlert(task);
            // Add small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }, 0);
      } else {
        console.log('✅ No new stagnant tasks to alert');
      }

      console.log('📋 Updated stagnant tasks list:', currentStagnant.map(t => t.name));
      return currentStagnant;
    });
    
    setLastCheck(new Date());
  }, [alertsEnabled, clickUpData, detectStagnantTasks, sendStagnantTaskAlert, thresholdHours, thresholdUnit]);

  // Start/stop monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Test alert function
  const testAlert = useCallback(async () => {
    if (!slackWebhookUrl) {
      alert('Please configure Slack webhook URL first');
      return;
    }

    const testMessage = {
      text: `🧪 *Test Alert from PulseTracker*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🧪 *Test Alert*\n\nThis is a test message from PulseTracker's stagnant task alert system.\n\n*Settings:*\n• Alerts Enabled: ${alertsEnabled ? 'Yes' : 'No'}\n• Threshold: ${thresholdHours} ${thresholdUnit === 'seconds' ? 'seconds' : 'hours'}\n• Current Time: ${new Date().toLocaleString()}`
          }
        }
      ]
    };

    try {
      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testMessage),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }

      alert('Test alert sent successfully!');
    } catch (error) {
      console.error('Failed to send test alert:', error);
      alert(`Failed to send test alert: ${error.message}`);
    }
  }, [slackWebhookUrl, alertsEnabled, thresholdHours, thresholdUnit]);

  // Auto-start monitoring when conditions are met
  useEffect(() => {
    const hasClickUpData = clickUpData?.tasks?.length > 0;
    const shouldStart = alertsEnabled && slackWebhookUrl && hasClickUpData && !isMonitoring;
    const shouldStop = (!alertsEnabled || !slackWebhookUrl || !hasClickUpData) && isMonitoring;
    
    console.log('🔄 Monitoring state check:', {
      alertsEnabled,
      hasSlackWebhook: !!slackWebhookUrl,
      hasClickUpData,
      tasksCount: clickUpData?.tasks?.length || 0,
      isMonitoring,
      shouldStart,
      shouldStop
    });

    if (shouldStart) {
      console.log('▶️ Starting stagnant task monitoring with all conditions met');
      startMonitoring();
    } else if (shouldStop) {
      console.log('⏹️ Stopping stagnant task monitoring - conditions not met');
      stopMonitoring();
    }
  }, [alertsEnabled, slackWebhookUrl, clickUpData, isMonitoring, startMonitoring, stopMonitoring]);

  // Periodic check when monitoring is active
  useEffect(() => {
    console.log('🔍 Periodic check effect triggered:', {
      isMonitoring,
      thresholdUnit,
      checkInterval,
      hasRefreshFunction: !!refreshClickUpData
    });
    
    if (!isMonitoring) {
      console.log('⏸️ Monitoring not active, skipping periodic checks');
      return;
    }

    console.log('⏰ Setting up periodic checks for stagnant tasks');
    
    // Initial check after 5 seconds
    const initialTimeout = setTimeout(() => {
      console.log('🔄 Initial stagnant task check triggered');
      checkForStagnantTasks();
    }, 5000);
    
    // Set up interval based on threshold unit
    const intervalMs = thresholdUnit === 'seconds' ? checkInterval * 1000 : checkInterval * 60 * 1000;
    console.log(`⏱️ Setting interval for ${intervalMs}ms (${thresholdUnit} mode, ${checkInterval} ${thresholdUnit === 'seconds' ? 'seconds' : 'minutes'})`);
    
    const interval = setInterval(async () => {
      console.log('🔄 Periodic check triggered - refreshing ClickUp data and checking stagnant tasks');
      
      // First refresh ClickUp data to get latest task status
      if (refreshClickUpData) {
        try {
          console.log('🔄 Refreshing ClickUp data...');
          await refreshClickUpData();
          console.log('✅ ClickUp data refresh complete');
        } catch (error) {
          console.error('❌ Error refreshing ClickUp data:', error);
        }
      } else {
        console.log('⚠️ No refresh function available, skipping data refresh');
      }
      
      // Then check for stagnant tasks with fresh data
      console.log('🔍 Checking for stagnant tasks with updated data...');
      checkForStagnantTasks();
    }, intervalMs);
    
    console.log('✅ Periodic check setup complete:', {
      initialTimeoutId: initialTimeout,
      intervalId: interval,
      intervalMs
    });

    return () => {
      console.log('🧹 Cleaning up stagnant task monitoring intervals');
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isMonitoring, checkForStagnantTasks, thresholdUnit, checkInterval, refreshClickUpData]);

  // Memoized return value
  const returnValue = useMemo(() => ({
    stagnantTasks,
    isMonitoring,
    lastCheck,
    startMonitoring,
    stopMonitoring,
    testAlert,
    detectStagnantTasks
  }), [
    stagnantTasks,
    isMonitoring,
    lastCheck,
    startMonitoring,
    stopMonitoring,
    testAlert,
    detectStagnantTasks
  ]);

  return returnValue;
};

export default useStagnantTaskDetector;
