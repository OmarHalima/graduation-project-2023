import React, { ReactNode } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  noPadding?: boolean;
}

export function Card({ 
  children, 
  className = '', 
  title, 
  subtitle, 
  footer,
  noPadding = false
}: CardProps) {
  const { isDark } = useDarkMode();

  return (
    <div className={`card ${className}`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          {title && (
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
      
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-border rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
} 