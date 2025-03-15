import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  TableSortLabel,
  Tabs,
  Tab,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  OutlinedInput,
  InputAdornment,
  Stack,
  Paper,
} from '@mui/material';
import {
  MoreVertical,
  UserPlus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  Users,
  UserCheck,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { User, UserRole, UserStatus } from '../types/auth';
import toast from 'react-hot-toast';
import { EditUserModal } from '../components/user/EditUserModal';
import { DeleteUserModal } from '../components/user/DeleteUserModal';
import { useAuth } from '../contexts/auth/AuthContext';

interface UsersPageProps {
  users: User[];
  otherUsers: User[];
  projects: Array<{ id: string; name: string; team_members: { user_id: string }[] }>;
  onDeleteUser: (userId: string) => void;
  onEditUser: (user: User) => void;
  onCreateUser: () => void;
}

type SortField = keyof Pick<User, 'full_name' | 'email' | 'role' | 'status'>;
type SortDirection = 'asc' | 'desc';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`users-tabpanel-${index}`}
      aria-labelledby={`users-tab-${index}`}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

export function UsersPage({ users, otherUsers, projects, onDeleteUser, onEditUser, onCreateUser }: UsersPageProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'error' as const;
      case 'project_manager':
        return 'warning' as const;
      case 'employee':
        return 'success' as const;
      default:
        return 'default' as const;
    }
  };

  const getRoleWeight = (role: string) => {
    switch (role) {
      case 'admin':
        return 3;
      case 'project_manager':
        return 2;
      case 'employee':
        return 1;
      default:
        return 0;
    }
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortUsers = (usersToSort: User[]) => {
    return [...usersToSort].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'role') {
        comparison = getRoleWeight(b.role) - getRoleWeight(a.role);
      } else {
        comparison = String(a[sortField]).localeCompare(String(b[sortField]));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const handleRowClick = (user: User) => {
    navigate(`/users/${user.id}`);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEditClick = () => {
    handleMenuClose();
    if (selectedUser) {
      setShowEditModal(true);
    }
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    if (selectedUser) {
      setShowDeleteModal(true);
    }
  };

  const handleViewDetails = () => {
    handleMenuClose();
    if (selectedUser) {
      navigate(`/users/${selectedUser.id}`);
    }
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setSelectedUser(null);
  };

  const handleEditSuccess = async (updatedUser: User) => {
    try {
      await onEditUser(updatedUser);
      setShowEditModal(false);
      setSelectedUser(null);
      toast.success('User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const filterUsers = (usersToFilter: User[]) => {
    return usersToFilter.filter(user => {
      const matchesSearch = searchQuery === '' || 
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      const matchesProject = projectFilter === 'all' || 
        projects.find(p => 
          p.id === projectFilter && 
          p.team_members.some(m => m.user_id === user.id)
        );

      return matchesSearch && matchesRole && matchesStatus && matchesProject;
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setProjectFilter('all');
  };

  const renderFilters = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack spacing={2}>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search by name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
              label="Role"
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="project_manager">Project Manager</MenuItem>
              <MenuItem value="employee">Employee</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
              label="Status"
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Project</InputLabel>
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              label="Project"
            >
              <MenuItem value="all">All Projects</MenuItem>
              {projects.map(project => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || projectFilter !== 'all') && (
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={clearFilters}
              startIcon={<X size={18} />}
            >
              Clear Filters
            </Button>
          )}
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap">
          {searchQuery && (
            <Chip
              label={`Search: ${searchQuery}`}
              onDelete={() => setSearchQuery('')}
              size="small"
            />
          )}
          {roleFilter !== 'all' && (
            <Chip
              label={`Role: ${roleFilter}`}
              onDelete={() => setRoleFilter('all')}
              size="small"
            />
          )}
          {statusFilter !== 'all' && (
            <Chip
              label={`Status: ${statusFilter}`}
              onDelete={() => setStatusFilter('all')}
              size="small"
            />
          )}
          {projectFilter !== 'all' && (
            <Chip
              label={`Project: ${projects.find(p => p.id === projectFilter)?.name}`}
              onDelete={() => setProjectFilter('all')}
              size="small"
            />
          )}
        </Box>
      </Stack>
    </Paper>
  );

  const renderUsersTable = (usersToRender: User[]) => {
    const filteredUsers = filterUsers(usersToRender);
    const sortedUsers = sortUsers(filteredUsers);

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'full_name'}
                  direction={sortDirection}
                  onClick={() => handleSort('full_name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'email'}
                  direction={sortDirection}
                  onClick={() => handleSort('email')}
                >
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'role'}
                  direction={sortDirection}
                  onClick={() => handleSort('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'status'}
                  direction={sortDirection}
                  onClick={() => handleSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedUsers.length > 0 ? (
              sortedUsers.map((user) => (
                <TableRow
                  key={user.id}
                  hover
                  onClick={() => handleRowClick(user)}
                  sx={{ 
                    cursor: 'pointer',
                    bgcolor: users.some(u => u.id === user.id) ? 'action.hover' : 'inherit'
                  }}
                >
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      color={getRoleColor(user.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.status}
                      color={user.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, user)}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">
                    No users found matching the current filters
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Users
          </Typography>
          {currentUser?.role === 'project_manager' && (
            <Box display="flex" alignItems="center" gap={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showAllUsers}
                    onChange={(e) => setShowAllUsers(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show all users"
              />
              {showAllUsers ? (
                <Chip
                  icon={<Users size={16} />}
                  label="Viewing all users"
                  color="info"
                  variant="outlined"
                  size="small"
                />
              ) : (
                <Chip
                  icon={<UserCheck size={16} />}
                  label="Viewing team members"
                  color="success"
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          )}
        </Box>
        {currentUser?.role === 'admin' && (
          <Button
            variant="contained"
            startIcon={<UserPlus />}
            onClick={onCreateUser}
          >
            Add User
          </Button>
        )}
      </Box>

      {renderFilters()}

      {currentUser?.role === 'project_manager' && (
        <Card>
          {showAllUsers ? (
            <>
              <Box sx={{ p: 2, bgcolor: 'primary.lighter' }}>
                <Alert severity="info" sx={{ mb: 0 }}>
                  Showing all users. Team members are highlighted.
                </Alert>
              </Box>
              {renderUsersTable([...users, ...otherUsers])}
            </>
          ) : (
            renderUsersTable(users)
          )}
        </Card>
      )}

      {currentUser?.role !== 'project_manager' && (
        <Card>
          {renderUsersTable(users)}
        </Card>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          <FileText className="h-4 w-4 mr-2" />
          View Details
        </MenuItem>
        {currentUser?.role === 'admin' && (
          <>
            <MenuItem onClick={handleEditClick}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </MenuItem>
            <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </MenuItem>
          </>
        )}
      </Menu>

      {selectedUser && showEditModal && (
        <EditUserModal
          user={selectedUser}
          onClose={handleEditModalClose}
          onUpdated={handleEditSuccess}
        />
      )}

      {selectedUser && showDeleteModal && (
        <DeleteUserModal
          user={selectedUser}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
          onDeleted={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
            onDeleteUser(selectedUser.id);
          }}
        />
      )}
    </Box>
  );
} 