import React, { useEffect, useState } from 'react';
import { Avatar, AvatarProps, Tooltip } from '@mui/material';
import { User } from '../types/auth';

interface UserAvatarProps extends Omit<AvatarProps, 'src'> {
  user: User | null | undefined;
  showTooltip?: boolean;
  fallbackText?: string;
}

/**
 * A reusable component for displaying user avatars consistently across the application
 */
export function UserAvatar({ 
  user, 
  showTooltip = true, 
  fallbackText,
  sx,
  ...props 
}: UserAvatarProps) {
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(user?.avatar_url || undefined);

  useEffect(() => {
    setAvatarSrc(user?.avatar_url || undefined);
  }, [user?.avatar_url]);

  if (!user) {
    return (
      <Avatar 
        sx={{ 
          bgcolor: 'grey.500',
          ...sx 
        }} 
        {...props}
      >
        {fallbackText ? fallbackText.charAt(0).toUpperCase() : '?'}
      </Avatar>
    );
  }

  // Get the first letter of the user's name, or use a fallback
  const getInitial = () => {
    if (user.full_name && user.full_name.length > 0) {
      return user.full_name.charAt(0).toUpperCase();
    }
    return fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
  };

  const handleAvatarError = () => {
    setAvatarSrc(undefined);
  };

  const avatar = (
    <Avatar
      src={avatarSrc}
      alt={user.full_name || ''}
      onError={handleAvatarError}
      sx={{
        bgcolor: !avatarSrc ? 'primary.main' : undefined,
        ...sx
      }}
      {...props}
    >
      {!avatarSrc && getInitial()}
    </Avatar>
  );

  if (showTooltip && user.full_name) {
    return (
      <Tooltip title={user.full_name} arrow>
        {avatar}
      </Tooltip>
    );
  }

  return avatar;
} 