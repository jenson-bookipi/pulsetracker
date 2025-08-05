// CORS Proxy utility for handling external API requests
// This provides fallback options when direct browser requests are blocked by CORS

export const sendSlackMessage = async (webhookUrl, message) => {
  try {
    // Try direct request - this will likely fail due to CORS in development
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: message })
    })

    if (response.ok) {
      return { success: true, method: 'direct' }
    } else {
      // Non-200 response, likely CORS preflight failure
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    console.warn('Slack request failed:', error.message)
    
    // Check if it's a CORS-related error
    const isCorsError = error.message.includes('CORS') || 
                       error.message.includes('fetch') ||
                       error.name === 'TypeError' ||
                       error.message.includes('Failed to fetch')
    
    if (isCorsError) {
      return {
        success: false,
        error: 'CORS_BLOCKED',
        message: 'Unable to send Slack message due to CORS restrictions in development environment',
        suggestions: [
          'Deploy the app to a production server with proper CORS configuration',
          'Use a backend service or serverless function as a proxy',
          'Set up Supabase Edge Functions for Slack messaging',
          'Use the provided curl command or email alternatives below'
        ]
      }
    } else {
      return {
        success: false,
        error: 'REQUEST_FAILED',
        message: `Slack request failed: ${error.message}`
      }
    }
  }
}

// Alternative: Generate curl command for manual execution
export const generateSlackCurlCommand = (webhookUrl, message) => {
  const escapedMessage = message.replace(/"/g, '\\"')
  return `curl -X POST -H 'Content-type: application/json' --data '{"text":"${escapedMessage}"}' ${webhookUrl}`
}

// Generate a mailto link for sharing the message via email
export const generateEmailAlert = (message, recipient = '') => {
  const subject = encodeURIComponent('PulseTracker Alert')
  const body = encodeURIComponent(`PulseTracker Alert:\n\n${message}`)
  return `mailto:${recipient}?subject=${subject}&body=${body}`
}
