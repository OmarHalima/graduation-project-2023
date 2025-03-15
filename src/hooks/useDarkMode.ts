import { useTheme } from '../contexts/ThemeContext';

/**
 * A custom hook that provides utility functions for dark mode styling
 */
export function useDarkMode() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  /**
   * Returns the appropriate class based on the current theme
   * @param lightClass - The class to use in light mode
   * @param darkClass - The class to use in dark mode
   */
  const getThemeClass = (lightClass: string, darkClass: string): string => {
    return isDark ? darkClass : lightClass;
  };

  /**
   * Returns the appropriate style based on the current theme
   * @param lightStyle - The style to use in light mode
   * @param darkStyle - The style to use in dark mode
   */
  const getThemeStyle = <T>(lightStyle: T, darkStyle: T): T => {
    return isDark ? darkStyle : lightStyle;
  };

  /**
   * Returns the appropriate color based on the current theme
   * @param lightColor - The color to use in light mode
   * @param darkColor - The color to use in dark mode
   */
  const getThemeColor = (lightColor: string, darkColor: string): string => {
    return isDark ? darkColor : lightColor;
  };

  /**
   * Returns the appropriate background color based on the current theme
   * @param lightBg - The background color to use in light mode
   * @param darkBg - The background color to use in dark mode
   */
  const getThemeBg = (lightBg: string, darkBg: string): string => {
    return isDark ? darkBg : lightBg;
  };

  /**
   * Returns the appropriate text color based on the current theme
   * @param lightText - The text color to use in light mode
   * @param darkText - The text color to use in dark mode
   */
  const getThemeText = (lightText: string, darkText: string): string => {
    return isDark ? darkText : lightText;
  };

  /**
   * Returns the appropriate border color based on the current theme
   * @param lightBorder - The border color to use in light mode
   * @param darkBorder - The border color to use in dark mode
   */
  const getThemeBorder = (lightBorder: string, darkBorder: string): string => {
    return isDark ? darkBorder : lightBorder;
  };

  return {
    theme,
    toggleTheme,
    isDark,
    getThemeClass,
    getThemeStyle,
    getThemeColor,
    getThemeBg,
    getThemeText,
    getThemeBorder,
  };
} 