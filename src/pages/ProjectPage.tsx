import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  Grid,
  Chip,
  CircularProgress,
  Dialog,
} from '@mui/material';
import {
  Users as UsersIcon,
  Calendar as CalendarIcon,
  Target as TargetIcon,
  Clock as ClockIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Project, ProjectMember } from '../types/project';
import { User } from '../types/auth';
import { TeamAssignmentModal } from '../components/TeamAssignmentModal';
import { KnowledgeBase } from '../components/KnowledgeBase';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    fetchProject();
    fetchCurrentUser();
  }, [projectId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUser(data);
    }
  };

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:owner_id(*),
          manager:manager_id(*),
          members:project_members(
            user_id,
            role,
            user:users(*)
          )
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'on_hold':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Project not found
        </Typography>
        <Button variant="contained" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Card>
    );
  }

  return (
    <Box>
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4" component="h1">
            {project.name}
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<UsersIcon />}
              onClick={() => setIsTeamModalOpen(true)}
              sx={{ mr: 2 }}
            >
              Manage Team
            </Button>
          </Box>
        </Box>
        <Chip
          label={project.status}
          color={getStatusColor(project.status) as any}
          sx={{ mr: 2 }}
        />
      </Box>

      <Grid container spacing={4}>
        {/* Project Overview */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Project Overview
            </Typography>
            <Typography color="text.secondary" paragraph>
              {project.description || 'No description provided.'}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box display="flex" alignItems="center">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Start Date
                    </Typography>
                    <Typography>
                      {project.start_date
                        ? new Date(project.start_date).toLocaleDateString()
                        : 'Not set'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box display="flex" alignItems="center">
                  <TargetIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      End Date
                    </Typography>
                    <Typography>
                      {project.end_date
                        ? new Date(project.end_date).toLocaleDateString()
                        : 'Not set'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box display="flex" alignItems="center">
                  <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Progress
                    </Typography>
                    <Typography>{project.progress || 0}%</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Card>

          {/* Knowledge Base Section */}
          {currentUser && (
            <Card sx={{ p: 3 }}>
              <KnowledgeBase
                projectId={project.id}
                currentUser={currentUser}
              />
            </Card>
          )}
        </Grid>

        {/* Team Members Sidebar */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Team Members
            </Typography>
            <Box>
              {project.members?.map((member: ProjectMember) => (
                <Box
                  key={member.user_id}
                  display="flex"
                  alignItems="center"
                  p={1}
                  sx={{
                    '&:not(:last-child)': {
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    },
                  }}
                >
                  {member.user?.avatar_url ? (
                    <img
                      src={member.user.avatar_url}
                      alt={member.user.full_name}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        marginRight: 8,
                      }}
                    />
                  ) : (
                    <UsersIcon style={{ width: 32, height: 32, marginRight: 8 }} />
                  )}
                  <Box flex={1}>
                    <Typography variant="subtitle2">
                      {member.user?.full_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {member.role}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Team Assignment Modal */}
      <Dialog
        open={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <TeamAssignmentModal
          projectId={project.id}
          currentMembers={project.members || []}
          onClose={() => setIsTeamModalOpen(false)}
          onUpdate={fetchProject}
        />
      </Dialog>
    </Box>
  );
} 