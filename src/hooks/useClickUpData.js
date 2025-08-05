import { useState, useEffect } from 'react'

export const useClickUpData = (token, teamId) => {
  const [data, setData] = useState({
    tasks: [],
    spaces: [],
    loading: true,
    error: null
  })

  const fetchClickUpData = async () => {
    if (!token || !teamId) {
      setData(prev => ({ ...prev, loading: false }))
      return
    }

    try {
      setData(prev => ({ ...prev, loading: true, error: null }))
      
      const headers = {
        'Authorization': token,
        'Content-Type': 'application/json'
      }

      // Fetch spaces
      const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space`, { headers })
      if (!spacesResponse.ok) throw new Error('Failed to fetch ClickUp spaces')
      const spacesData = await spacesResponse.json()

      // Fetch tasks from all spaces
      const taskPromises = spacesData.spaces.map(async (space) => {
        try {
          const tasksResponse = await fetch(`https://api.clickup.com/api/v2/space/${space.id}/task`, { headers })
          if (!tasksResponse.ok) return []
          const tasksData = await tasksResponse.json()
          return tasksData.tasks.map(task => ({
            ...task,
            space_name: space.name,
            space_id: space.id
          }))
        } catch (error) {
          console.error(`Error fetching tasks for space ${space.name}:`, error)
          return []
        }
      })

      const taskResults = await Promise.all(taskPromises)
      const allTasks = taskResults.flat()

      setData({
        tasks: allTasks,
        spaces: spacesData.spaces,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('ClickUp API Error:', error)
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }))
    }
  }

  useEffect(() => {
    fetchClickUpData()
  }, [token, teamId])

  const getTasksByAssignee = (userId) => {
    return data.tasks.filter(task => 
      task.assignees?.some(assignee => assignee.id === userId || assignee.username === userId)
    )
  }

  const getCompletedTasks = (userId, days = 7) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    
    return getTasksByAssignee(userId).filter(task => 
      task.status?.status === 'complete' || task.status?.status === 'closed'
    ).filter(task => {
      const completedDate = task.date_closed ? new Date(parseInt(task.date_closed)) : null
      return completedDate && completedDate > cutoff
    })
  }

  const getOpenTasks = (userId) => {
    return getTasksByAssignee(userId).filter(task => 
      task.status?.status !== 'complete' && task.status?.status !== 'closed'
    )
  }

  const getBlockedTasks = (userId = null) => {
    const tasks = userId ? getTasksByAssignee(userId) : data.tasks
    
    return tasks.filter(task => {
      // Check status for blocked indicators
      const statusName = task.status?.status?.toLowerCase() || ''
      const isBlockedStatus = statusName.includes('blocked') || 
                             statusName.includes('waiting') || 
                             statusName.includes('pending')
      
      // Check comments for blocked keywords
      const hasBlockedComments = task.comments?.some(comment => {
        const text = comment.comment_text?.toLowerCase() || ''
        return text.includes('blocked') || 
               text.includes('waiting') || 
               text.includes('pending') ||
               text.includes('stuck')
      })

      return isBlockedStatus || hasBlockedComments
    })
  }

  const getTaskMetrics = (userId) => {
    const userTasks = getTasksByAssignee(userId)
    const completedTasks = getCompletedTasks(userId)
    const openTasks = getOpenTasks(userId)
    const blockedTasks = getBlockedTasks(userId)

    return {
      total: userTasks.length,
      completed: completedTasks.length,
      open: openTasks.length,
      blocked: blockedTasks.length,
      completionRate: userTasks.length > 0 ? (completedTasks.length / userTasks.length) * 100 : 0
    }
  }

  const getBlockedTasksWithDuration = () => {
    return getBlockedTasks().map(task => {
      // Calculate how long task has been blocked
      const blockedSince = task.date_updated ? new Date(parseInt(task.date_updated)) : new Date(parseInt(task.date_created))
      const now = new Date()
      const hoursBlocked = Math.floor((now - blockedSince) / (1000 * 60 * 60))
      
      return {
        ...task,
        blockedSince,
        hoursBlocked,
        needsFollowUp: hoursBlocked >= 48
      }
    })
  }

  return {
    ...data,
    getTasksByAssignee,
    getCompletedTasks,
    getOpenTasks,
    getBlockedTasks,
    getTaskMetrics,
    getBlockedTasksWithDuration,
    refresh: fetchClickUpData
  }
}
