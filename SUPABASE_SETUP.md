# Supabase Setup Guide for PulseTracker

This guide will help you set up Supabase to handle Slack messaging without CORS errors.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: `pulsetracker`
   - **Database Password**: (generate a secure password)
   - **Region**: Choose closest to you
6. Click "Create new project"
7. Wait for project to be ready (2-3 minutes)

## Step 2: Get Project Credentials

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Project Reference ID**: `your-project-id`
   - **anon public key**: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`

## Step 3: Configure Environment Variables

1. Create a `.env` file in your project root:

```bash
# Copy from .env.example and fill in your values
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Deploy Edge Function

1. **Login to Supabase CLI**:
   ```bash
   supabase login
   ```
   This will open your browser for authentication.

2. **Link your project**:
   ```bash
   supabase link --project-ref your-project-id
   ```

3. **Deploy the Slack webhook function**:
   ```bash
   supabase functions deploy slack-webhook
   ```

## Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to the Settings page in PulseTracker
3. Enter your Slack webhook URL
4. Click "Send Test Message"
5. Check your Slack channel - message should appear without CORS errors! 🎉

## Alternative: Manual Setup (If CLI doesn't work)

If the CLI setup doesn't work, you can:

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click "Create Function"
4. Name it `slack-webhook`
5. Copy the code from `supabase/functions/slack-webhook/index.ts`
6. Deploy manually through the dashboard

## Troubleshooting

### CORS Errors Still Happening?
- Check that your `.env` file has the correct Supabase URL and key
- Verify the Edge Function is deployed and active in your Supabase dashboard
- Check browser console for any Supabase connection errors

### Edge Function Not Working?
- Check the Supabase Edge Functions logs in your dashboard
- Verify your Slack webhook URL is valid
- Test the function directly in the Supabase dashboard

### Environment Variables Not Loading?
- Restart your development server after creating `.env`
- Check that variables start with `VITE_` prefix
- Verify `.env` is in the project root directory

## Success Indicators

✅ **Supabase project created and active**
✅ **Edge Function deployed successfully**  
✅ **Environment variables configured**
✅ **Slack messages sent without CORS errors**
✅ **PulseTracker Settings page shows successful connection**

Once setup is complete, your Slack integration will work flawlessly in both development and production!
