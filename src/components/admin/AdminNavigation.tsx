import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Settings,
  CheckSquare,
  Search,
} from 'lucide-react';
import { Box, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';

export function AdminNavigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigationItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      path: '/users',
      label: 'Users',
      icon: <Users className="h-5 w-5" />,
    },
    {
      path: '/projects',
      label: 'Projects',
      icon: <FolderKanban className="h-5 w-5" />,
    },
    {
      path: '/tasks',
      label: 'Tasks',
      icon: <CheckSquare className="h-5 w-5" />,
    },
    {
      path: '/deepsearch',
      label: 'Deepsearch',
      icon: <Search className="h-5 w-5" />,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  return (
    <Box component="nav" sx={{ width: '100%', maxWidth: 360 }}>
      <List>
        {navigationItems.map((item) => (
          <ListItem
            key={item.path}
            component={Link}
            to={item.path}
            sx={{
              color: isActive(item.path) ? 'primary.main' : 'text.primary',
              bgcolor: isActive(item.path) ? 'action.selected' : 'transparent',
              borderRadius: 1,
              mb: 0.5,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
} 