#!/usr/bin/env node

/**
 * Test script for Slack integration
 * This helps verify that our Supabase Edge Function works correctly
 */

const testSlackIntegration = async () => {
  console.log('🧪 Testing Slack Integration...\n')

  // Test 1: Check if environment variables are set
  console.log('1. Checking environment setup...')
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
  
  if (supabaseUrl === 'https://your-project.supabase.co') {
    console.log('⚠️  Environment variables not set. Please create .env file with your Supabase credentials.')
    console.log('   See SUPABASE_SETUP.md for instructions.\n')
  } else {
    console.log('✅ Environment variables configured\n')
  }

  // Test 2: Test Edge Function endpoint
  console.log('2. Testing Edge Function endpoint...')
  const functionUrl = `${supabaseUrl}/functions/v1/slack-webhook`
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        text: '🧪 Test message from PulseTracker setup',
        webhookUrl: 'https://hooks.slack.com/services/TEST/TEST/TEST' // This will fail but test the function
      })
    })

    if (response.ok) {
      console.log('✅ Edge Function is responding')
    } else {
      console.log(`⚠️  Edge Function returned ${response.status}`)
      const error = await response.text()
      console.log(`   Error: ${error}`)
    }
  } catch (error) {
    console.log(`❌ Could not reach Edge Function: ${error.message}`)
    console.log('   Make sure your Supabase project is set up and Edge Function is deployed.')
  }

  console.log('\n📋 Next Steps:')
  console.log('1. Follow SUPABASE_SETUP.md to create your Supabase project')
  console.log('2. Deploy the Edge Function: supabase functions deploy slack-webhook')
  console.log('3. Configure your .env file with the correct credentials')
  console.log('4. Test Slack integration in the PulseTracker Settings page')
}

// Run the test
testSlackIntegration().catch(console.error)
