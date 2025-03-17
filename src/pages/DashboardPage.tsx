import React, { useEffect } from 'react';
import {
  Box,
  Card,
  Grid,
  Typography,
  LinearProgress,
  Chip,
  CircularProgress,
  Button,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Users as UsersIcon,
  Briefcase as BriefcaseIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon,
  RefreshCw as RefreshIcon,
} from 'lucide-react';
import { User } from '../types/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { UserAvatar } from '../components/UserAvatar';

interface DashboardPageProps {
  user: User;
  users: User[];
  admins: User[];
  projectManagers: User[];
}

// Auto-refresh interval in milliseconds (30 seconds)
const AUTO_REFRESH_INTERVAL = 30 * 1000;

// Fixed height for scrollable sections (approximately 4 items)
const SCROLLABLE_SECTION_HEIGHT = 320;

export function DashboardPage({ user, users, admins, projectManagers }: DashboardPageProps) {
  const { theme } = useTheme();
  const { 
    activities, 
    projects, 
    isLoadingActivities, 
    isLoadingProjects, 
    error, 
    refreshData 
  } = useDashboardData();

  // Setup auto-refresh on a timer
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData();
    }, AUTO_REFRESH_INTERVAL);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [refreshData]);

  const stats = [
    {
      title: 'Total Users',
      value: users.length,
      icon: UsersIcon,
      color: 'primary.main',
      details: [
        {
          label: 'Active',
          value: users.filter(u => u.status === 'active').length,
        },
        {
          label: 'Pending',
          value: users.filter(u => u.status === 'pending').length,
        },
      ],
    },
    {
      title: 'Admins',
      value: admins.length,
      icon: BriefcaseIcon,
      color: 'error.main',
      details: [
        {
          label: 'Active',
          value: admins.filter(u => u.status === 'active').length,
        },
      ],
    },
    {
      title: 'Project Managers',
      value: projectManagers.length,
      icon: CheckCircleIcon,
      color: 'warning.main',
      details: [
        {
          label: 'Active',
          value: projectManagers.filter(u => u.status === 'active').length,
        },
      ],
    },
    {
      title: 'Recent Activity',
      value: '24h',
      icon: ClockIcon,
      color: 'success.main',
      details: [
        {
          label: 'New Users',
          value: users.filter(u => {
            const created = new Date(u.created_at);
            const now = new Date();
            const diff = now.getTime() - created.getTime();
            return diff <= 24 * 60 * 60 * 1000;
          }).length,
        },
      ],
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom className="text-gray-900 dark:text-white">
            Dashboard
          </Typography>
          <Typography variant="body1" className="text-gray-600 dark:text-gray-300">
            Welcome back, {user.full_name}! Here's an overview of your system.
          </Typography>
        </Box>
        <Tooltip title="Refresh all data">
          <span>
            <IconButton 
              onClick={refreshData} 
              disabled={isLoadingActivities || isLoadingProjects}
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <RefreshIcon 
                size={20} 
                className={isLoadingActivities || isLoadingProjects ? 'animate-spin' : ''} 
              />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          className="mb-4"
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={refreshData}
              startIcon={<RefreshIcon size={16} />}
            >
              Retry
            </Button>
          }
        >
          Failed to load dashboard data. Please try again.
        </Alert>
      )}

      <Grid container spacing={3}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card className="card h-full">
              <Box sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: `${stat.color}15`,
                      color: stat.color,
                      mr: 1.5,
                    }}
                  >
                    <stat.icon size={20} />
                  </Box>
                  <Typography variant="h6" component="h2" className="text-gray-900 dark:text-white">
                    {stat.title}
                  </Typography>
                </Box>

                <Typography variant="h4" component="p" className="mb-2 text-gray-900 dark:text-white">
                  {stat.value}
                </Typography>

                <Box>
                  {stat.details.map((detail, idx) => (
                    <Box key={idx} display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" className="text-gray-600 dark:text-gray-300">
                        {detail.label}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" className="text-gray-900 dark:text-white">
                        {detail.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card className="card h-full">
            <Box sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" component="h2" className="text-gray-900 dark:text-white">
                  Recent Activity
                </Typography>
                <Button 
                  size="small" 
                  onClick={refreshData} 
                  disabled={isLoadingActivities}
                  startIcon={<RefreshIcon size={16} className={isLoadingActivities ? 'animate-spin' : ''} />}
                >
                  Refresh
                </Button>
              </Box>
              
              <Box 
                sx={{ 
                  height: SCROLLABLE_SECTION_HEIGHT, 
                  overflow: 'auto',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '4px',
                    '&:hover': {
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                    },
                  },
                }}
                className="pr-2"
              >
                {isLoadingActivities ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <CircularProgress size={28} color="primary" />
                    <Typography variant="body2" ml={2} className="text-gray-600 dark:text-gray-300">
                      Loading recent activities...
                    </Typography>
                  </Box>
                ) : activities.length > 0 ? (
                  <Box>
                    {activities.map((activity, index) => (
                      <Box
                        key={activity.id}
                        display="flex"
                        alignItems="flex-start"
                        mb={2}
                        pb={2}
                        className={index !== activities.length - 1 ? "border-b border-gray-200 dark:border-dark-border" : ""}
                      >
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            backgroundColor: `${activity.color}15`,
                            color: activity.color,
                            mr: 1.5,
                            flexShrink: 0,
                          }}
                        >
                          <activity.icon size={18} />
                        </Box>
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" mb={0.5}>
                            {activity.user && (
                              <Box mr={1}>
                                <UserAvatar 
                                  user={activity.user} 
                                  sx={{ width: 24, height: 24, fontSize: '0.8rem' }} 
                                />
                              </Box>
                            )}
                            <Typography variant="body2" className="text-gray-900 dark:text-white" sx={{ wordBreak: 'break-word' }}>
                              {activity.message}
                            </Typography>
                          </Box>
                          <Typography variant="caption" className="text-gray-500 dark:text-gray-400">
                            {activity.time} {activity.user && `• ${activity.user.full_name}`}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <Typography variant="body2" className="text-gray-500 dark:text-gray-400 text-center">
                      No recent activity to display.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Card>
        </Grid>

        {/* Project Status */}
        <Grid item xs={12} md={6}>
          <Card className="card h-full">
            <Box sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" component="h2" className="text-gray-900 dark:text-white">
                  Project Status
                </Typography>
                <Button 
                  size="small" 
                  onClick={refreshData} 
                  disabled={isLoadingProjects}
                  startIcon={<RefreshIcon size={16} className={isLoadingProjects ? 'animate-spin' : ''} />}
                >
                  Refresh
                </Button>
              </Box>
              
              <Box 
                sx={{ 
                  height: SCROLLABLE_SECTION_HEIGHT, 
                  overflow: 'auto',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '4px',
                    '&:hover': {
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                    },
                  },
                }}
                className="pr-2"
              >
                {isLoadingProjects ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <CircularProgress size={28} color="primary" />
                    <Typography variant="body2" ml={2} className="text-gray-600 dark:text-gray-300">
                      Loading project status...
                    </Typography>
                  </Box>
                ) : projects.length > 0 ? (
                  <Box>
                    {projects.map((project) => (
                      <Box key={project.id} mb={3}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="body2" className="text-gray-900 dark:text-white">
                            {project.name}
                          </Typography>
                          <Box display="flex" alignItems="center">
                            <Typography variant="caption" mr={1} className="text-gray-500 dark:text-gray-400">
                              {project.completed_tasks}/{project.total_tasks} tasks
                            </Typography>
                            <Chip
                              label={`${project.progress}%`}
                              size="small"
                              className={`badge badge-${project.progress < 30 ? 'error' : project.progress < 70 ? 'warning' : 'success'}`}
                            />
                          </Box>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={project.progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <Typography variant="body2" className="text-gray-500 dark:text-gray-400 text-center">
                      No projects to display.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
} 