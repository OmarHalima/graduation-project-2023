import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Phase } from '../types/phase';
import type { User } from '../types/auth';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Box,
  Card,
  Typography,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import { PhaseTable } from '../components/phase/PhaseTable';
import { NewPhaseModal } from '../components/phase/NewPhaseModal';

export function PhasesPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [isNewPhaseModalOpen, setIsNewPhaseModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchPhases();
      fetchProjects();
    }
  }, [currentUser, projectFilter]);

  const fetchPhases = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('project_phases')
        .select(`
          *,
          creator:created_by(id, full_name, email),
          project:projects(id, name)
        `)
        .order('sequence_order', { ascending: true });

      if (projectFilter) {
        query = query.eq('project_id', projectFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPhases(data || []);
    } catch (error: any) {
      console.error('Error fetching phases:', error);
      toast.error('Error loading phases');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleUpdatePhase = async (phaseId: string, updates: Partial<Phase>) => {
    try {
      const { error } = await supabase
        .from('project_phases')
        .update(updates)
        .eq('id', phaseId);

      if (error) throw error;
      await fetchPhases();
      toast.success('Phase updated successfully');
    } catch (error: any) {
      console.error('Error updating phase:', error);
      toast.error('Error updating phase');
    }
  };

  if (!currentUser) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Please sign in to view phases
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Go to Sign In
        </Button>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  const canManagePhases = currentUser.role === 'admin' || currentUser.role === 'project_manager';

  return (
    <Box p={3}>
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
        <div>
          <Typography variant="h4" component="h1" gutterBottom>
            Phases
          </Typography>
          <Typography color="text.secondary">
            View and manage project phases
          </Typography>
        </div>
        {canManagePhases && (
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => setIsNewPhaseModalOpen(true)}
          >
            New Phase
          </Button>
        )}
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Filter by Project</InputLabel>
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              label="Filter by Project"
            >
              <MenuItem value="">All Projects</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <PhaseTable
        phases={phases}
        onUpdatePhase={handleUpdatePhase}
        currentUser={currentUser}
        canManagePhases={canManagePhases}
      />
      
      {isNewPhaseModalOpen && projectFilter && (
        <NewPhaseModal 
          projectId={projectFilter}
          currentUser={currentUser}
          onClose={() => setIsNewPhaseModalOpen(false)}
          onCreated={() => {
            fetchPhases();
            setIsNewPhaseModalOpen(false);
          }}
        />
      )}
      
      {isNewPhaseModalOpen && !projectFilter && (
        <NewPhaseModal 
          projects={projects}
          currentUser={currentUser}
          onClose={() => setIsNewPhaseModalOpen(false)}
          onCreated={() => {
            fetchPhases();
            setIsNewPhaseModalOpen(false);
          }}
        />
      )}
    </Box>
  );
} 