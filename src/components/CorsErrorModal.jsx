import { useState } from 'react'
import { AlertTriangle, Copy, Mail, Terminal, X, ExternalLink } from 'lucide-react'

const CorsErrorModal = ({ error, onClose }) => {
  const [copiedCurl, setCopiedCurl] = useState(false)

  if (!error || error.type !== 'CORS_BLOCKED') return null

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCurl(true)
      setTimeout(() => setCopiedCurl(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-orange-50">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-orange-600 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-orange-900">CORS Restriction</h2>
              <p className="text-sm text-orange-700">Slack message blocked by browser security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Explanation */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">What happened?</h3>
            <p className="text-sm text-gray-600 mb-3">
              Your browser blocked the request to Slack due to CORS (Cross-Origin Resource Sharing) policy. 
              This is a security feature that prevents websites from making unauthorized requests to other domains.
            </p>
            <p className="text-sm text-gray-600">
              This typically happens in development environments. In production, this can be resolved with proper server configuration.
            </p>
          </div>

          {/* Alternative Solutions */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Alternative Solutions:</h3>

            {/* Solution 1: Manual curl command */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Terminal className="h-4 w-4 text-gray-600 mr-2" />
                <h4 className="font-medium text-sm">Option 1: Run Terminal Command</h4>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Copy and run this command in your terminal to send the Slack message:
              </p>
              <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                {error.curlCommand}
              </div>
              <button
                onClick={() => copyToClipboard(error.curlCommand)}
                className="mt-2 flex items-center text-xs text-blue-600 hover:text-blue-800"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copiedCurl ? 'Copied!' : 'Copy Command'}
              </button>
            </div>

            {/* Solution 2: Email alert */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Mail className="h-4 w-4 text-gray-600 mr-2" />
                <h4 className="font-medium text-sm">Option 2: Send via Email</h4>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Open your email client to send this alert manually:
              </p>
              <a
                href={error.emailLink}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <Mail className="h-4 w-4 mr-1" />
                Open Email Draft
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </div>

            {/* Solution 3: Production deployment */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <ExternalLink className="h-4 w-4 text-gray-600 mr-2" />
                <h4 className="font-medium text-sm">Option 3: Deploy to Production</h4>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Deploy PulseTracker to a production environment where CORS can be properly configured:
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Vercel, Netlify, or similar hosting platforms</li>
                <li>• Configure server-side proxy for Slack requests</li>
                <li>• Use serverless functions for API calls</li>
              </ul>
            </div>
          </div>

          {/* Long-term Solutions */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Long-term Solutions:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              {error.suggestions?.map((suggestion, index) => (
                <li key={index}>• {suggestion}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              This is a common development issue that resolves in production
            </p>
            <button
              onClick={onClose}
              className="btn-primary text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CorsErrorModal
