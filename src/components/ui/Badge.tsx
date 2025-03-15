import React, { ReactNode } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'default';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ 
  children, 
  variant = 'default', 
  className = '',
  size = 'md'
}: BadgeProps) {
  const { isDark } = useDarkMode();

  const getVariantClasses = (variant: BadgeVariant): string => {
    switch (variant) {
      case 'primary':
        return 'badge-primary';
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'error':
        return 'badge-error';
      case 'info':
        return 'badge-info';
      default:
        return isDark 
          ? 'bg-gray-700 text-gray-200' 
          : 'bg-gray-100 text-gray-800';
    }
  };

  const getSizeClasses = (size: 'sm' | 'md' | 'lg'): string => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-0.5';
      case 'lg':
        return 'text-sm px-3 py-1';
      default:
        return 'text-xs px-2.5 py-0.5';
    }
  };

  return (
    <span className={`badge ${getVariantClasses(variant)} ${getSizeClasses(size)} ${className}`}>
      {children}
    </span>
  );
} 