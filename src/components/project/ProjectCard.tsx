import { Calendar, Users, Clock, ChevronRight, Edit2, Trash2, Archive, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Box, Typography, IconButton, Card, Chip, CircularProgress, LinearProgress, Avatar, AvatarGroup, Tooltip } from '@mui/material';
import type { Project } from '../../types/project';
import { useState } from 'react';

interface ProjectCardProps {
  project: Project;
  isAdmin?: boolean;
  onEdit?: (project: Project) => void;
  onDelete?: (projectId: string) => void;
  onArchive?: (project: Project) => void;
  isArchived?: boolean;
}

export function ProjectCard({ project, isAdmin, onEdit, onDelete, onArchive, isArchived = false }: ProjectCardProps) {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const memberCount = project.team_members?.length || 0;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_progress':
        return 'success';
      case 'planning':
        return 'info';
      case 'on_hold':
        return 'warning';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'error';
      case 'archived':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // Convert progress to a color
  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'error';
    if (progress < 50) return 'warning';
    if (progress < 75) return 'info';
    return 'success';
  };

  const handleClick = async (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement) {
      e.stopPropagation();
      return;
    }
    setIsNavigating(true);
    navigate(`/admin/projects/${project.id}`);
  };

  // Get first 3 team members to display in avatar group
  const displayMembers = project.team_members?.slice(0, 3) || [];
  const remainingMembers = Math.max(0, memberCount - 3);

  return (
    <Card 
      onClick={handleClick}
      sx={{ 
        p: 0, 
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)',
        },
        ...(isArchived && {
          opacity: 0.85,
          bgcolor: 'rgba(0, 0, 0, 0.02)'
        })
      }}
    >
      {isNavigating && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bgcolor="rgba(255, 255, 255, 0.8)"
          zIndex={1}
        >
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Status indicator stripe at the top */}
      <Box 
        sx={{ 
          height: '6px', 
          width: '100%', 
          bgcolor: `${getStatusColor(project.status)}.main`
        }} 
      />
      
      <Box p={3} flexGrow={1} display="flex" flexDirection="column">
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" fontWeight="600" gutterBottom>
            {project.name}
          </Typography>
          
          <Box display="flex" gap={1}>
            <Chip
              label={project.status.replace('_', ' ')}
              color={getStatusColor(project.status) as any}
              size="small"
              sx={{ textTransform: 'capitalize' }}
            />
            
            {isAdmin && (
              <Box display="flex">
                {onArchive && (
                  <Tooltip title={isArchived ? "Unarchive" : "Archive"}>
                    <IconButton
                      size="small"
                      color={isArchived ? "primary" : "default"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(project);
                      }}
                    >
                      {isArchived ? (
                        <RefreshCw className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
                {onEdit && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(project);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </IconButton>
                )}
                {onDelete && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(project.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </Box>
            )}
          </Box>
        </Box>
      
        <Typography color="text.secondary" paragraph sx={{ 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          mb: 3,
          minHeight: '48px'
        }}>
          {project.description || 'No description provided'}
        </Typography>

        <Box mt="auto" mb={3}>
          <Box display="flex" alignItems="center" mb={1}>
            <Calendar className="h-4 w-4 mr-2" />
            <Typography variant="body2" color="text.secondary">
              {project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : 'Not set'} 
              {' - '}
              {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'Not set'}
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Box display="flex" alignItems="center">
              <Users className="h-4 w-4 mr-2" />
              <Typography variant="body2" color="text.secondary">
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </Typography>
            </Box>
            
            <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.85rem' } }}>
              {displayMembers.map((member: any) => (
                <Tooltip key={member.user?.id} title={member.user?.full_name || 'Team member'}>
                  <Avatar 
                    src={member.user?.avatar_url}
                    alt={member.user?.full_name || 'Team member'}
                  >
                    {member.user?.full_name?.charAt(0) || '?'}
                  </Avatar>
                </Tooltip>
              ))}
              {remainingMembers > 0 && (
                <Tooltip title={`${remainingMembers} more team member${remainingMembers !== 1 ? 's' : ''}`}>
                  <Avatar>+{remainingMembers}</Avatar>
                </Tooltip>
              )}
            </AvatarGroup>
          </Box>

          <Box display="flex" alignItems="center">
            <Clock className="h-4 w-4 mr-2" />
            <Typography variant="body2" color="text.secondary">
              Created {format(new Date(project.created_at), 'MMM d, yyyy')}
            </Typography>
          </Box>
        </Box>

        <Box borderTop={1} borderColor="divider" pt={2}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="body2" fontWeight="medium">
              Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {project.progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={project.progress || 0} 
            color={getProgressColor(project.progress || 0) as any}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      </Box>
    </Card>
  );
} 