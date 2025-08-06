// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts"

interface SlackMessage {
  text: string
  webhookUrl: string
  channel?: string
  username?: string
  icon_emoji?: string
}

interface SlackResponse {
  success: boolean
  message?: string
  error?: string
}

console.log("PulseTracker Slack Webhook Function Started")

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { 
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }

  try {
    const body: SlackMessage = await req.json()
    const { text, webhookUrl, channel, username, icon_emoji } = body

    // Validate required fields
    if (!text || !webhookUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: text and webhookUrl' 
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Prepare Slack message payload
    const slackPayload: any = { text }
    if (channel) slackPayload.channel = channel
    if (username) slackPayload.username = username
    if (icon_emoji) slackPayload.icon_emoji = icon_emoji

    console.log('Sending Slack message:', { text, webhookUrl: webhookUrl.substring(0, 50) + '...' })

    // Send message to Slack
    const slackResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackPayload),
    })

    if (slackResponse.ok) {
      const responseData: SlackResponse = {
        success: true,
        message: 'Slack message sent successfully'
      }

      console.log('Slack message sent successfully')

      return new Response(
        JSON.stringify(responseData),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    } else {
      const errorText = await slackResponse.text()
      console.error('Slack API error:', slackResponse.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Slack API error: ${slackResponse.status} ${errorText}` 
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }
  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Server error: ${error.message}` 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/slack-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
