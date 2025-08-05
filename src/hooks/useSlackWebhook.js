import { useState } from 'react'
import { sendSlackMessage, generateSlackCurlCommand, generateEmailAlert } from '../utils/corsProxy'

export const useSlackWebhook = (webhookUrl) => {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)


  const sendMessage = async (message, channel = null) => {
    if (!webhookUrl) {
      setError('Slack webhook URL not configured')
      return false
    }

    try {
      setSending(true)
      setError(null)

      const fullMessage = channel ? `#${channel}: ${message}` : message
      const result = await sendSlackMessage(webhookUrl, fullMessage)
      

      setSending(false)

      if (result.success) {
        console.log('Slack message sent successfully:', result.method)
        return true
      } else {
        console.log('Slack message failed:', result)
        
        // Handle CORS error with user-friendly message and alternatives
        if (result.error === 'CORS_BLOCKED') {
          console.log('CORS error detected, setting error state for modal')
          const corsError = {
            type: 'CORS_BLOCKED',
            message: result.message,
            suggestions: result.suggestions,
            curlCommand: generateSlackCurlCommand(webhookUrl, fullMessage),
            emailLink: generateEmailAlert(fullMessage)
          }
          console.log('Setting CORS error:', corsError)
          setError(corsError)
        } else {
          setError(result.message || 'Failed to send Slack message')
        }
        return false
      }
    } catch (error) {
      console.error('Slack webhook error:', error)
      setError(error.message)
      setSending(false)
      return false
    }
  }

  const sendBlockerAlert = async (task, assignee) => {
    const message = `🚧 *Blocker Alert* 🚧\n\n` +
      `Task: *${task.name}*\n` +
      `Assignee: ${assignee}\n` +
      `Status: ${task.status?.status || 'Unknown'}\n` +
      `Blocked for: ${task.hoursBlocked || 0} hours\n\n` +
      `Please check on this task and help unblock it! 🙏`

    return await sendMessage(message)
  }

  const sendKudosMessage = async (teammate, achievements) => {
    const { commits, pullRequests, completedTasks } = achievements
    
    let message = `🎉 *Kudos to ${teammate}!* 🎉\n\n`
    
    if (commits > 0) message += `📝 ${commits} commits\n`
    if (pullRequests > 0) message += `🔄 ${pullRequests} pull requests\n`
    if (completedTasks > 0) message += `✅ ${completedTasks} tasks completed\n`
    
    message += `\nKeep up the great work! 🚀`

    return await sendMessage(message)
  }

  const sendBurnoutAlert = async (teammate, metrics) => {
    const message = `⚠️ *Burnout Alert* ⚠️\n\n` +
      `${teammate} might be experiencing high workload:\n\n` +
      `• Open tasks: ${metrics.openTasks}\n` +
      `• Recent activity: ${metrics.recentActivity}\n` +
      `• Ongoing PRs: ${metrics.ongoingPRs}\n\n` +
      `Consider checking in with them or redistributing some work. 💙`

    return await sendMessage(message)
  }

  const sendFollowUpMessage = async (task, assignee) => {
    const message = `🔄 *Follow-up Reminder* 🔄\n\n` +
      `Task: *${task.name}* has been blocked for ${Math.floor(task.hoursBlocked / 24)} days\n` +
      `Assignee: ${assignee}\n\n` +
      `This task needs attention! Please:\n` +
      `• Check if it can be unblocked\n` +
      `• Reassign if needed\n` +
      `• Update status if work is in progress\n\n` +
      `Let's keep things moving! 🏃‍♂️`

    return await sendMessage(message)
  }

  return {
    sendMessage,
    sendBlockerAlert,
    sendKudosMessage,
    sendBurnoutAlert,
    sendFollowUpMessage,
    sending,
    error
  }
}
