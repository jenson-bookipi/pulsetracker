import { createClient } from '@supabase/supabase-js'

// These will be your actual Supabase project URL and anon key
// For now, we'll use placeholder values that you'll need to replace
// Note: Vite uses import.meta.env instead of process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to call our Slack webhook Edge Function
export const callSlackWebhook = async (text, webhookUrl, options = {}) => {
  try {
    const { data, error } = await supabase.functions.invoke('slack-webhook', {
      body: {
        text,
        webhookUrl,
        channel: options.channel,
        username: options.username || 'PulseTracker',
        icon_emoji: options.icon_emoji || '📊'
      }
    })

    if (error) {
      console.error('Supabase function error:', error)
      return {
        success: false,
        error: 'SUPABASE_ERROR',
        message: `Supabase function error: ${error.message}`
      }
    }

    return data
  } catch (error) {
    console.error('Slack webhook call failed:', error)
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: `Network error: ${error.message}`
    }
  }
}
