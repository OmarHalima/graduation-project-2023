import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Box,
  Paper,
  Grid,
  Typography,
  CircularProgress,
  LinearProgress,
  Divider,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, differenceInDays } from 'date-fns';
import type { Task } from '../../types/task';
import type { ProjectMember } from '../../types/project';

interface ProjectAnalysisProps {
  projectId: string;
}

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  inReview: number;
  todo: number;
  overdue: number;
  highPriority: number;
}

interface TeamStats {
  totalMembers: number;
  taskDistribution: { name: string; tasks: number }[];
  completionRate: { name: string; rate: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function ProjectAnalysis({ projectId }: ProjectAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    inReview: 0,
    todo: 0,
    overdue: 0,
    highPriority: 0,
  });
  const [teamStats, setTeamStats] = useState<TeamStats>({
    totalMembers: 0,
    taskDistribution: [],
    completionRate: [],
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_user:users!tasks_assigned_to_fkey (
            id,
            full_name
          )
        `)
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select(`
          *,
          user:users (
            id,
            full_name
          )
        `)
        .eq('project_id', projectId);

      if (membersError) throw membersError;

      setTasks(tasksData || []);
      setTeamMembers(membersData || []);
      
      // Calculate statistics
      calculateTaskStats(tasksData || []);
      calculateTeamStats(tasksData || [], membersData || []);
    } catch (error) {
      console.error('Error fetching project analysis data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTaskStats = (tasks: Task[]) => {
    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      inReview: tasks.filter(t => t.status === 'in_review').length,
      todo: tasks.filter(t => t.status === 'todo').length,
      overdue: tasks.filter(t => {
        if (!t.due_date || t.status === 'completed') return false;
        return new Date(t.due_date) < new Date();
      }).length,
      highPriority: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
    };

    setTaskStats(stats);
  };

  const calculateTeamStats = (tasks: Task[], members: ProjectMember[]) => {
    // Calculate task distribution per member
    const taskDistribution = members
      .map(member => ({
        name: member.user?.full_name || 'Unknown',
        tasks: tasks.filter(t => t.assigned_to === member.user_id).length,
      }))
      .filter(item => item.tasks > 0)
      .sort((a, b) => b.tasks - a.tasks);

    // Calculate completion rate per member
    const completionRate = members
      .map(member => {
        const memberTasks = tasks.filter(t => t.assigned_to === member.user_id);
        const completedTasks = memberTasks.filter(t => t.status === 'completed').length;
        const rate = memberTasks.length ? (completedTasks / memberTasks.length) * 100 : 0;
        
        return {
          name: member.user?.full_name || 'Unknown',
          rate: Math.round(rate),
        };
      })
      .filter(item => item.rate > 0)
      .sort((a, b) => b.rate - a.rate);

    setTeamStats({
      totalMembers: members.length,
      taskDistribution,
      completionRate,
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const taskStatusData = [
    { name: 'To Do', value: taskStats.todo },
    { name: 'In Progress', value: taskStats.inProgress },
    { name: 'In Review', value: taskStats.inReview },
    { name: 'Completed', value: taskStats.completed },
  ];

  return (
    <Box>
      {/* Project Overview Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card 
            sx={{ 
              p: 2.5,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                bgcolor: 'primary.main',
                opacity: 0.8
              }
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="medium">
                Total Tasks
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h3" fontWeight="medium">
                {taskStats.total}
              </Typography>
              {taskStats.total > 0 && (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ ml: 1, mt: 1.5 }}
                >
                  tasks
                </Typography>
              )}
            </Box>
            {taskStats.total > 0 && (
              <Box sx={{ mt: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Completion
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Math.round((taskStats.completed / taskStats.total) * 100)}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(taskStats.completed / taskStats.total) * 100}
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: 'grey.100',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3
                    }
                  }}
                />
              </Box>
            )}
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card 
            sx={{ 
              p: 2.5,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                bgcolor: 'info.main',
                opacity: 0.8
              }
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="medium">
                Team Members
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h3" fontWeight="medium">
                {teamStats.totalMembers}
              </Typography>
              {teamStats.totalMembers > 0 && (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ ml: 1, mt: 1.5 }}
                >
                  members
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card 
            sx={{ 
              p: 2.5,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                bgcolor: 'error.main',
                opacity: 0.8
              }
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="medium">
                Overdue Tasks
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h3" fontWeight="medium" color="error.main">
                {taskStats.overdue}
              </Typography>
              {taskStats.overdue > 0 && (
                <Typography 
                  variant="body2" 
                  color="error.main" 
                  sx={{ ml: 1, mt: 1.5, opacity: 0.8 }}
                >
                  overdue
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card 
            sx={{ 
              p: 2.5,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                bgcolor: 'warning.main',
                opacity: 0.8
              }
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="medium">
                High Priority Tasks
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h3" fontWeight="medium" color="warning.main">
                {taskStats.highPriority}
              </Typography>
              {taskStats.highPriority > 0 && (
                <Typography 
                  variant="body2" 
                  color="warning.main" 
                  sx={{ ml: 1, mt: 1.5, opacity: 0.8 }}
                >
                  urgent
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Task Status Distribution */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Task Status Distribution
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Team Performance */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Team Task Distribution
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamStats.taskDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tasks" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Completion Rates */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Team Completion Rates
            </Typography>
            <Grid container spacing={2}>
              {teamStats.completionRate.map((member, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Box sx={{ mb: 2 }}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">{member.name}</Typography>
                      <Typography variant="body2">{member.rate}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={member.rate}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                      }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
} 