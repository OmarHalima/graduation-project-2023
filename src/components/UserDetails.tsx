import React from 'react';
import { User } from '../types/auth';
import { UserAvatar } from './UserAvatar';
import { Box, Typography } from '@mui/material';

interface UserDetailsProps {
  user: User;
}

export function UserDetails({ user }: UserDetailsProps) {
  return (
    <Box className="p-4 bg-white rounded-lg shadow">
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <UserAvatar user={user} sx={{ width: 64, height: 64 }} />
        <Box>
          <Typography variant="h6">{user.full_name}</Typography>
          <Typography color="text.secondary">{user.email}</Typography>
          <Typography color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            Role: {user.role}
          </Typography>
          <Typography color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            Status: {user.status}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
