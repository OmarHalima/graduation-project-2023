export const theme = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    success: {
      50: '#f0fdf4',
      500: '#22c55e',
      700: '#15803d',
    },
    warning: {
      50: '#fffbeb',
      500: '#f59e0b',
      700: '#b45309',
    },
    error: {
      50: '#fef2f2',
      500: '#ef4444',
      700: '#b91c1c',
    },
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  spacing: {
    page: '1.5rem',
    section: '2rem',
    element: '1rem',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    heading: {
      fontWeight: '600',
      lineHeight: '1.25',
      color: '#111827',
    },
    body: {
      fontWeight: '400',
      lineHeight: '1.5',
      color: '#374151',
    },
  },
  transitions: {
    default: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

export const commonStyles = {
  card: `
    bg-white rounded-lg shadow-sm border border-gray-200
    hover:shadow-md transition-shadow duration-200
  `,
  button: {
    base: `
      inline-flex items-center justify-center rounded-md
      font-medium transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
    `,
    primary: `
      bg-primary-600 text-white
      hover:bg-primary-700
      focus:ring-primary-500
    `,
    secondary: `
      bg-white text-gray-700 border border-gray-300
      hover:bg-gray-50
      focus:ring-primary-500
    `,
    danger: `
      bg-error-600 text-white
      hover:bg-error-700
      focus:ring-error-500
    `,
  },
  input: `
    block w-full rounded-md border-gray-300
    focus:border-primary-500 focus:ring-primary-500
    sm:text-sm
  `,
  badge: {
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-700',
    info: 'bg-primary-50 text-primary-700',
  },
}; 