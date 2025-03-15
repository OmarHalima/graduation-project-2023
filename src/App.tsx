import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthForm } from './components/AuthForm';
import { UsersPage } from './pages/UsersPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './contexts/auth/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase, supabaseAdmin, debugSession } from './lib/supabase';
import toast from 'react-hot-toast';
import type { User } from './types/auth';
import type { Project, ProjectMember } from './types/project';
import { NewUserModal } from './components/user/NewUserModal';
import { UserDetailsPage } from './pages/UserDetailsPage';
import { ProjectsPage } from './components/admin/ProjectsPage';
import { TasksPage } from './pages/TasksPage';
import { DeepsearchPage } from './pages/DeepsearchPage';
import { runStorageInitialization } from './lib/initStorage';

interface ProjectWithMembers {
  id: string;
  name: string;
  team_members: { user_id: string }[];
}

interface UserProject {
  project_id: string;
  project: {
    team_members: Array<{ user_id: string }>;
  };
}

function AppContent() {
  const { user, loading, session } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [otherUsers, setOtherUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [projectManagers, setProjectManagers] = useState<User[]>([]);
  const [projects, setProjects] = useState<ProjectWithMembers[]>([]);

  useEffect(() => {
    // Log authentication state
    console.log('Auth State:', {
      user,
      session,
      loading,
      isAuthenticated: !!user
    });

    if (user) {
      console.log('Current User:', {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        fullName: user.full_name
      });
      fetchUsers();
    }
  }, [user, session, loading]);

  const fetchUsers = async () => {
    if (!user) return;

    try {
      // First, fetch all users
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Fetch all projects
      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          team_members:project_members(
            user_id
          )
        `);

      if (projectsError) throw projectsError;

      setProjects(allProjects as ProjectWithMembers[]);

      // Store all users for admin view
      setUsers(allUsers || []);
      setAdmins(allUsers?.filter(u => u.role === 'admin') || []);
      setProjectManagers(allUsers?.filter(u => u.role === 'project_manager') || []);

      // Handle role-based visibility
      if (user.role === 'admin') {
        // Admins see all users
        setFilteredUsers(allUsers || []);
        setOtherUsers([]);
      } else if (user.role === 'project_manager') {
        // Fetch projects managed by this project manager
        const { data: managedProjects, error: pmProjectsError } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            team_members:project_members(
              user_id
            )
          `)
          .or(`manager_id.eq.${user.id},owner_id.eq.${user.id}`);

        if (pmProjectsError) throw pmProjectsError;

        // Get unique user IDs from all managed projects
        const teamMemberIds = new Set<string>();
        (managedProjects as ProjectWithMembers[] || []).forEach(project => {
          project.team_members?.forEach(member => {
            teamMemberIds.add(member.user_id);
          });
        });

        // Filter users based on team membership
        const teamUsers = allUsers?.filter(u => teamMemberIds.has(u.id)) || [];
        setFilteredUsers(teamUsers);
        setOtherUsers(allUsers?.filter(u => 
          !teamMemberIds.has(u.id) && 
          u.role !== 'admin'
        ) || []);
      } else {
        // Regular employees see only users in their projects
        const { data: userProjects, error: projectsError } = await supabase
          .from('project_members')
          .select(`
            project_id,
            project:projects(
              team_members:project_members(
                user_id
              )
            )
          `)
          .eq('user_id', user.id);

        if (projectsError) throw projectsError;

        // Get unique user IDs from all projects the user is part of
        const teamMemberIds = new Set<string>();
        (userProjects as unknown as UserProject[]).forEach(projectMember => {
          projectMember.project?.team_members?.forEach(member => {
            teamMemberIds.add(member.user_id);
          });
        });

        // Filter users to only show team members
        const teamUsers = allUsers?.filter(u => teamMemberIds.has(u.id)) || [];
        setFilteredUsers(teamUsers);
        setOtherUsers([]);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Error fetching users: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      if (!supabaseAdmin) {
        throw new Error('Admin client not available');
      }

      // Delete user profile using RPC
      const { error: rpcError } = await supabaseAdmin.rpc('delete_user_profile', {
        p_user_id: userId,
        p_current_user_id: user?.id
      });

      if (rpcError) {
        // If RPC fails, try direct deletion as fallback
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId);

        if (deleteError) throw deleteError;
      }

      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Error deleting user: ' + error.message);
    }
  };

  const handleEditUser = async (updatedUser: User) => {
    try {
      if (!supabaseAdmin) {
        throw new Error('Admin client not available');
      }

      // Update user profile using RPC
      const { error: rpcError } = await supabaseAdmin.rpc('update_user_profile', {
        p_user_id: updatedUser.id,
        p_full_name: updatedUser.full_name,
        p_role: updatedUser.role,
        p_status: updatedUser.status,
        p_department: updatedUser.department,
        p_position: updatedUser.position,
        p_current_user_id: user?.id
      });

      if (rpcError) {
        // If RPC fails, try direct update as fallback
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            full_name: updatedUser.full_name,
            role: updatedUser.role,
            status: updatedUser.status,
            department: updatedUser.department,
            position: updatedUser.position,
            updated_at: new Date().toISOString()
          })
          .eq('id', updatedUser.id);

        if (updateError) throw updateError;
      }

      toast.success('User updated successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Error updating user: ' + error.message);
    }
  };

  const handleUserCreated = async () => {
    await fetchUsers();
    setShowNewUserModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <AuthForm mode={mode} onModeChange={setMode} />
      </div>
    );
  }

  return (
    <Layout user={user}>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <DashboardPage 
              user={user} 
              users={users} 
              admins={admins} 
              projectManagers={projectManagers} 
            />
          } />
          <Route
            path="/users"
            element={
              <UsersPage
                users={filteredUsers}
                otherUsers={otherUsers}
                projects={projects}
                onDeleteUser={handleDeleteUser}
                onEditUser={handleEditUser}
                onCreateUser={() => setShowNewUserModal(true)}
              />
            }
          />
          <Route path="/users/:userId" element={<UserDetailsPage />} />
          <Route path="/projects" element={<Navigate to="/admin/projects" replace />} />
          <Route path="/admin/projects" element={<ProjectsPage />} />
          <Route path="/admin/projects/:projectId" element={<ProjectDetailsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/deepsearch" element={<DeepsearchPage />} />
          <Route
            path="/settings"
            element={
              <SettingsPage
                user={user}
                onEnableMFA={() => {}}
              />
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>

      {showNewUserModal && (
        <NewUserModal
          onClose={() => setShowNewUserModal(false)}
          onCreated={handleUserCreated}
        />
      )}
    </Layout>
  );
}

// Initialize storage buckets when in development mode
if (import.meta.env.DEV) {
  runStorageInitialization().then(result => {
    console.log('Storage initialization result:', result);
    
    if (!result.success && result.error instanceof TypeError && 
        result.error.message.includes('createPolicy is not a function')) {
      console.warn('==========================================================');
      console.warn('STORAGE POLICY SETUP REQUIRED');
      console.warn('==========================================================');
      console.warn('The storage bucket has been created, but policies need to be set up manually.');
      console.warn('Please read the setup instructions at:');
      console.warn('supabase/policies/setup_instructions.md');
      console.warn('or run the SQL script at:');
      console.warn('supabase/policies/rls_policies.sql');
      console.warn('==========================================================');
    }
  });
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;