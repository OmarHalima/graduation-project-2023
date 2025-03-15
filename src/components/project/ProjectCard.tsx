import { Calendar, Users, Clock, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Box, Typography, IconButton, Card, Chip, CircularProgress } from '@mui/material';
import type { Project } from '../../types/project';
import { useState } from 'react';

interface ProjectCardProps {
  project: Project;
  isAdmin?: boolean;
  onEdit?: (project: Project) => void;
  onDelete?: (projectId: string) => void;
}

export function ProjectCard({ project, isAdmin, onEdit, onDelete }: ProjectCardProps) {
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
      default:
        return 'default';
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement) {
      e.stopPropagation();
      return;
    }
    setIsNavigating(true);
    navigate(`/admin/projects/${project.id}`);
  };

  return (
    <Card 
      onClick={handleClick}
      sx={{ 
        p: 3, 
        cursor: 'pointer',
        position: 'relative',
        '&:hover': {
          boxShadow: 6,
          transition: 'box-shadow 0.3s ease-in-out'
        }
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
      
      <Box>
        <Typography variant="h6" gutterBottom>
          {project.name}
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label={project.status}
            color={getStatusColor(project.status) as any}
            size="small"
          />
          {isAdmin && onEdit && (
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
          {isAdmin && onDelete && (
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
      </Box>
      
      <Typography color="text.secondary" paragraph sx={{ 
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        mb: 2,
        height: '48px'
      }}>
        {project.description || 'No description provided'}
      </Typography>

      <Box>
        <Box display="flex" alignItems="center" mb={1}>
          <Calendar className="h-4 w-4 mr-2" />
          <Typography variant="body2" color="text.secondary">
            {project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : 'Not set'} 
            {' - '}
            {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'Not set'}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" mb={1}>
          <Users className="h-4 w-4 mr-2" />
          <Typography variant="body2" color="text.secondary">
            Team members: {memberCount}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center">
          <Clock className="h-4 w-4 mr-2" />
          <Typography variant="body2" color="text.secondary">
            Created {format(new Date(project.created_at), 'MMM d, yyyy')}
          </Typography>
        </Box>
      </Box>

      <Box display="flex" alignItems="center" justifyContent="space-between" pt={2} borderTop={1} borderColor="divider">
        <Typography variant="body2" color="text.secondary">
          Progress: {project.progress}%
        </Typography>
        <ChevronRight className="h-5 w-5" />
      </Box>
    </Card>
  );
} 