/**
 * Enhanced Slack Proxy with multiple fallback strategies
 * This provides immediate working solutions while Supabase is being set up
 */

// Try multiple CORS proxy services as fallbacks
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
  'https://thingproxy.freeboard.io/fetch/'
]

export const sendSlackMessageWithFallbacks = async (webhookUrl, message) => {
  console.log('🔄 Attempting to send Slack message with fallbacks...')

  // Strategy 1: Try direct request first (will fail in dev due to CORS)
  try {
    console.log('📡 Trying direct request...')
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    })

    if (response.ok) {
      console.log('✅ Direct request succeeded!')
      return { success: true, method: 'direct' }
    }
  } catch (error) {
    console.log('❌ Direct request failed (expected in development):', error.message)
  }

  // Strategy 2: Try CORS proxy services
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxy = CORS_PROXIES[i]
    console.log(`📡 Trying CORS proxy ${i + 1}/${CORS_PROXIES.length}: ${proxy}`)
    
    try {
      const proxyUrl = proxy + encodeURIComponent(webhookUrl)
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      })

      if (response.ok) {
        console.log(`✅ CORS proxy ${i + 1} succeeded!`)
        return { success: true, method: `cors-proxy-${i + 1}` }
      }
    } catch (error) {
      console.log(`❌ CORS proxy ${i + 1} failed:`, error.message)
    }
  }

  // Strategy 3: Return helpful alternatives if all proxies fail
  console.log('❌ All proxy attempts failed. Providing alternatives...')
  
  return {
    success: false,
    error: 'CORS_BLOCKED',
    message: 'Unable to send Slack message due to CORS restrictions',
    alternatives: {
      curlCommand: generateCurlCommand(webhookUrl, message),
      emailDraft: generateEmailDraft(message),
      manualWebhook: webhookUrl,
      setupGuide: 'See SUPABASE_SETUP.md for permanent solution'
    }
  }
}

export const generateCurlCommand = (webhookUrl, message) => {
  const escapedMessage = message.replace(/'/g, "'\"'\"'")
  return `curl -X POST -H 'Content-type: application/json' --data '{"text":"${escapedMessage}"}' '${webhookUrl}'`
}

export const generateEmailDraft = (message) => {
  const subject = encodeURIComponent('PulseTracker Alert')
  const body = encodeURIComponent(`Hi team,\n\nPulseTracker Alert:\n\n${message}\n\nBest regards,\nPulseTracker`)
  return `mailto:?subject=${subject}&body=${body}`
}

// Test function to verify different strategies
export const testSlackIntegration = async (webhookUrl) => {
  console.log('🧪 Testing Slack integration strategies...')
  
  const testMessage = '🧪 PulseTracker integration test - ' + new Date().toISOString()
  const result = await sendSlackMessageWithFallbacks(webhookUrl, testMessage)
  
  console.log('📊 Test Results:', result)
  return result
}
