import { useMemo } from 'react'
import { format, subDays, startOfDay } from 'date-fns'

const TeamHeatmap = ({ githubData, clickupData, teamMembers }) => {
  const heatmapData = useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) return []

    const days = 14 // Show last 2 weeks
    const dateRange = Array.from({ length: days }, (_, i) => 
      startOfDay(subDays(new Date(), days - 1 - i))
    )

    return teamMembers.map(member => {
      const memberData = dateRange.map(date => {
        // Get activity for this specific date
        const dateStr = format(date, 'yyyy-MM-dd')
        
        // Count commits for this date
        const commits = githubData?.commits?.filter(commit => {
          const commitDate = format(new Date(commit.date), 'yyyy-MM-dd')
          return commitDate === dateStr && 
                 (commit.author === member.name || commit.commit?.author?.name === member.name)
        })?.length || 0

        // Count PRs created on this date
        const prs = githubData?.pullRequests?.filter(pr => {
          const prDate = format(new Date(pr.created_at), 'yyyy-MM-dd')
          return prDate === dateStr && pr.author === member.name
        })?.length || 0

        // Count tasks completed on this date
        const tasks = clickupData?.tasks?.filter(task => {
          if (!task.date_closed) return false
          const taskDate = format(new Date(parseInt(task.date_closed)), 'yyyy-MM-dd')
          return taskDate === dateStr && 
                 task.assignees?.some(assignee => 
                   assignee.username === member.name || assignee.id === member.name
                 )
        })?.length || 0

        const totalActivity = commits + (prs * 2) + (tasks * 1.5) // Weight PRs and tasks higher
        
        return {
          date,
          dateStr,
          commits,
          prs,
          tasks,
          totalActivity: Math.round(totalActivity),
          level: totalActivity === 0 ? 0 : 
                 totalActivity <= 2 ? 1 :
                 totalActivity <= 5 ? 2 :
                 totalActivity <= 10 ? 3 : 4
        }
      })

      return {
        member: member.name,
        data: memberData,
        totalActivity: memberData.reduce((sum, day) => sum + day.totalActivity, 0),
        avgActivity: Math.round(memberData.reduce((sum, day) => sum + day.totalActivity, 0) / days)
      }
    }).sort((a, b) => b.totalActivity - a.totalActivity)
  }, [githubData, clickupData, teamMembers])

  const getActivityColor = (level) => {
    switch (level) {
      case 0: return 'bg-gray-100'
      case 1: return 'bg-green-200'
      case 2: return 'bg-green-300'
      case 3: return 'bg-green-500'
      case 4: return 'bg-green-700'
      default: return 'bg-gray-100'
    }
  }

  const getActivityTooltip = (dayData) => {
    return `${format(dayData.date, 'MMM d')}: ${dayData.totalActivity} activity (${dayData.commits} commits, ${dayData.prs} PRs, ${dayData.tasks} tasks)`
  }

  if (!heatmapData || heatmapData.length === 0) {
    return (
      <div className="metric-card">
        <h3 className="font-semibold text-gray-900 mb-4">Team Activity Heatmap</h3>
        <div className="text-center py-8 text-gray-500">
          <p>No activity data available</p>
          <p className="text-sm">Connect GitHub and ClickUp to see team activity</p>
        </div>
      </div>
    )
  }

  const dateHeaders = heatmapData[0]?.data.map(day => day.date) || []

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Team Activity Heatmap</h3>
        <div className="text-sm text-gray-500">
          Last 14 days
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
        <span>Less</span>
        <div className="flex items-center space-x-1">
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`w-3 h-3 rounded-sm ${getActivityColor(level)}`}
            />
          ))}
        </div>
        <span>More</span>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Date Headers */}
          <div className="flex mb-2">
            <div className="w-24 flex-shrink-0"></div>
            <div className="flex space-x-1">
              {dateHeaders.map((date, index) => (
                <div
                  key={index}
                  className="w-4 text-xs text-gray-500 text-center"
                  title={format(date, 'MMM d, yyyy')}
                >
                  {index % 7 === 0 ? format(date, 'd') : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Member Rows */}
          <div className="space-y-1">
            {heatmapData.map((memberData) => (
              <div key={memberData.member} className="flex items-center">
                <div className="w-24 flex-shrink-0 pr-2">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {memberData.member}
                  </div>
                  <div className="text-xs text-gray-500">
                    {memberData.avgActivity}/day avg
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  {memberData.data.map((dayData, index) => (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-sm cursor-pointer transition-opacity hover:opacity-80 ${getActivityColor(dayData.level)}`}
                      title={getActivityTooltip(dayData)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {heatmapData.reduce((sum, m) => sum + m.totalActivity, 0)}
            </div>
            <div className="text-xs text-gray-500">Total Activity</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round(heatmapData.reduce((sum, m) => sum + m.avgActivity, 0) / heatmapData.length)}
            </div>
            <div className="text-xs text-gray-500">Team Avg/Day</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {heatmapData.filter(m => m.avgActivity > 0).length}
            </div>
            <div className="text-xs text-gray-500">Active Members</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamHeatmap
