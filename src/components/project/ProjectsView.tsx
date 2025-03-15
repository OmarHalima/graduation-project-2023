import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Calendar, Users, Clock, ChevronUp, ChevronDown, Search, Filter } from 'lucide-react';
import type { Project, ProjectStatus, ProjectFormData } from '../../types/project';
import type { User } from '../../types/auth';
import { ProjectCard } from '../project/ProjectCard';
import { NewProjectModal } from '../project/NewProjectModal';
import { EditProjectModal } from './EditProjectModal';
import toast from 'react-hot-toast';
import { DeleteProjectModal } from '../project/DeleteProjectModal';

interface ProjectsViewProps {
  user: User;
  onProjectCreated: () => void;
}

type SortField = 'name' | 'status' | 'start_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

export function ProjectsView({ user, onProjectCreated }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'upcoming' | 'past' | 'all'>('all');
  const [admins, setAdmins] = useState<User[]>([]);
  const [projectManagers, setProjectManagers] = useState<User[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planning',
    owner_id: null,
    manager_id: null,
    budget: null,
    progress: 0
  });

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          members:project_members(user_id, role)
        `);

      if (error) throw error;

      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filteredAdmins = (data || []).filter((user: User) => user.role === 'admin');
      const filteredProjectManagers = (data || []).filter((user: User) => user.role === 'admin');

      setAdmins(filteredAdmins);
      setProjectManagers(filteredProjectManagers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Error fetching users: ' + error.message);
    }
  };

  const handleProjectCreated = async () => {
    await fetchProjects();
    onProjectCreated();
  };

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setShowEditModal(true);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjectToDelete(projectId);
    setShowDeleteModal(true);
  };

  const filteredAndSortedProjects = useMemo(() => {
    return projects
      .filter(project => {
        const matchesSearch = 
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = 
          statusFilter === 'all' || project.status === statusFilter;

        const matchesDate = () => {
          if (dateFilter === 'all') return true;
          const today = new Date();
          const startDate = project.start_date ? new Date(project.start_date) : null;
          
          if (dateFilter === 'upcoming') {
            return startDate ? startDate >= today : false;
          } else {
            return startDate ? startDate < today : false;
          }
        };

        return matchesSearch && matchesStatus && matchesDate();
      })
      .sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'status':
            comparison = a.status.localeCompare(b.status);
            break;
          case 'start_date':
            comparison = new Date(a.start_date || '').getTime() - 
                        new Date(b.start_date || '').getTime();
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - 
                        new Date(b.created_at).getTime();
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [projects, searchQuery, statusFilter, dateFilter, sortField, sortDirection]);

  return (
    <div className="space-y-6">
      {/* Loading Indicator */}
      {loading && <div>Loading...</div>}

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="h-5 w-5" />
            Filters
          </button>

          <button
            onClick={() => setShowNewProjectModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            New Project
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'upcoming' | 'past' | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>

          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at">Created Date</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="start_date">Start Date</option>
          </select>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedProjects.map(project => (
          <ProjectCard 
            key={project.id} 
            project={project}
            isAdmin={user.role === 'admin'}
            onEdit={handleEditProject}
            onDelete={handleDeleteProject}
          />
        ))}
      </div>

      {/* Modals */}
      {showNewProjectModal && (
        <NewProjectModal
          project={null}
          onClose={() => setShowNewProjectModal(false)}
          onSubmit={handleProjectCreated}
          formData={formData}
          setFormData={setFormData}
        />
      )}

      {showEditModal && selectedProject && (
        <EditProjectModal
          project={selectedProject}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProject(null);
          }}
          onUpdate={() => {
            fetchProjects();
            onProjectCreated();
          }}
          admins={admins}
          projectManagers={projectManagers}
        />
      )}

      {showDeleteModal && selectedProject && (
        <DeleteProjectModal
          projectId={selectedProject.id}
          onClose={() => setSelectedProject(null)}
          onDeleted={fetchProjects}
        />
      )}
    </div>
  );
} 