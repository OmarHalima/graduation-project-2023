import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Users, Clock, Brain } from 'lucide-react';
import type { Task } from '../types/task';
import { generateProjectInsights } from '../../lib/gemini';
import toast from 'react-hot-toast';

interface ProjectInsight {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation?: string;
}

interface ProjectInsightsProps {
  projectId: string;
}

export function ProjectInsights({ projectId }: ProjectInsightsProps) {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<ProjectInsight[]>([]);
  const [projectData, setProjectData] = useState<{
    tasks: Task[];
    teamPerformance: Record<string, number>;
    completionRate: number;
    timelineStatus: 'ahead' | 'on_track' | 'behind';
  } | null>(null);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:assigned_to(id, full_name, email),
          creator:created_by(id, full_name, email)
        `)
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      // Calculate team performance
      const teamPerformance = tasks.reduce((acc, task) => {
        if (task.assignee && task.status === 'completed') {
          acc[task.assignee.id] = (acc[task.assignee.id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Calculate completion rate
      const completionRate = tasks.length > 0 
        ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 
        : 0;

      // Determine timeline status
      const overdueTasks = tasks.filter(t => 
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
      ).length;
      const timelineStatus = overdueTasks === 0 ? 'ahead' 
        : overdueTasks < 3 ? 'on_track' 
        : 'behind';

      setProjectData({
        tasks,
        teamPerformance,
        completionRate,
        timelineStatus
      });

      // Generate AI insights
      const text = await generateProjectInsights({
        tasks,
        teamPerformance,
        completionRate,
        timelineStatus
      });

      const insights = text.split('\n\n').map(block => {
        const lines = block.split('\n');
        const type = lines[0].toLowerCase().includes('warning') ? 'warning' :
                     lines[0].toLowerCase().includes('success') ? 'success' : 'info';
        return {
          type,
          title: lines[0].replace(/^(Type|Title):\s*/, ''),
          description: lines[1].replace(/^Description:\s*/, ''),
          recommendation: lines[2]?.replace(/^Recommendation:\s*/, '')
        } as ProjectInsight;
      });

      setInsights(insights);
    } catch (error: any) {
      toast.error('Error fetching project insights');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Project Insights</h3>
        <button
          onClick={fetchProjectData}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Refresh Insights
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <TrendingUp className="h-5 w-5" />
            <span className="font-medium">Completion Rate</span>
          </div>
          <p className="text-2xl font-bold text-green-800">
            {projectData?.completionRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Users className="h-5 w-5" />
            <span className="font-medium">Team Members</span>
          </div>
          <p className="text-2xl font-bold text-blue-800">
            {Object.keys(projectData?.teamPerformance || {}).length}
          </p>
        </div>

        <div className={`p-4 rounded-lg ${
          projectData?.timelineStatus === 'ahead' ? 'bg-green-50' :
          projectData?.timelineStatus === 'on_track' ? 'bg-yellow-50' :
          'bg-red-50'
        }`}>
          <div className="flex items-center gap-2 mb-2" style={{
            color: projectData?.timelineStatus === 'ahead' ? '#047857' :
                   projectData?.timelineStatus === 'on_track' ? '#92400E' :
                   '#991B1B'
          }}>
            <Clock className="h-5 w-5" />
            <span className="font-medium">Timeline Status</span>
          </div>
          <p className="text-2xl font-bold capitalize" style={{
            color: projectData?.timelineStatus === 'ahead' ? '#065F46' :
                   projectData?.timelineStatus === 'on_track' ? '#78350F' :
                   '#7F1D1D'
          }}>
            {projectData?.timelineStatus.replace('_', ' ')}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              insight.type === 'success' ? 'border-green-200 bg-green-50' :
              insight.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
              'border-blue-200 bg-blue-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <Brain className={`h-5 w-5 mt-0.5 ${
                insight.type === 'success' ? 'text-green-600' :
                insight.type === 'warning' ? 'text-yellow-600' :
                'text-blue-600'
              }`} />
              <div>
                <h4 className={`font-medium ${
                  insight.type === 'success' ? 'text-green-800' :
                  insight.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {insight.title}
                </h4>
                <p className="mt-1 text-sm text-gray-600">{insight.description}</p>
                {insight.recommendation && (
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    Recommendation: {insight.recommendation}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 