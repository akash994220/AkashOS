import React from 'react';
import { useTheme } from '../../theme/ThemeContext';

export interface ResponsiveListItemProps {
  id?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;

  // Dual rendering pattern
  // If desktopContent and mobileContent are provided, it cleanly switches between them at the sm breakpoint (640px)
  desktopContent?: React.ReactNode;
  mobileContent?: React.ReactNode;

  // Slot-based pattern (used when desktopContent/mobileContent are not manually supplied)
  leading?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  details?: React.ReactNode;
  metrics?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;

  // Style overrides
  cardStyle?: React.CSSProperties;
}

/**
 * ResponsiveListItem
 * Shared, reusable list item component that renders:
 * - A clean horizontal row-style layout on desktop (>= 640px)
 * - A self-contained, card-based layout on mobile (< 640px)
 * Respects active theme tokens (colors, border, radius, shadow, spacing).
 */
export const ResponsiveListItem: React.FC<ResponsiveListItemProps> = ({
  id,
  onClick,
  className = '',
  desktopContent,
  mobileContent,
  leading,
  title,
  subtitle,
  badges,
  details,
  metrics,
  actions,
  footer,
  cardStyle,
}) => {
  const { theme } = useTheme();

  const defaultContainerStyle: React.CSSProperties = {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.borderLight}`,
    boxShadow: theme.shadows.sm,
    padding: theme.spacing.md,
    ...cardStyle,
  };

  // If custom dual slots are provided, render desktop / mobile accordingly
  if (desktopContent || mobileContent) {
    return (
      <div
        id={id}
        onClick={onClick}
        style={defaultContainerStyle}
        className={`transition-colors hover:border-zinc-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {/* Desktop row view (>= 640px) */}
        <div className="hidden sm:block">
          {desktopContent}
        </div>

        {/* Mobile card view (< 640px) */}
        <div className="block sm:hidden">
          {mobileContent}
        </div>
      </div>
    );
  }

  // Slot-based automatic layout
  return (
    <div
      id={id}
      onClick={onClick}
      style={defaultContainerStyle}
      className={`transition-colors hover:border-zinc-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Desktop Row Layout (>= 640px) */}
      <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {typeof title === 'string' ? (
                <h4 className="text-xs sm:text-sm font-bold truncate" style={{ color: theme.colors.textPrimary }}>
                  {title}
                </h4>
              ) : (
                title
              )}
              {badges}
            </div>
            {subtitle && (
              <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
                {subtitle}
              </div>
            )}
            {details && <div className="text-xs text-zinc-500">{details}</div>}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {metrics && <div className="shrink-0">{metrics}</div>}
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
      </div>

      {/* Mobile Card Layout (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {/* Card Header: Leading icon, Prominent Title, Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {leading && <div className="shrink-0 mt-0.5">{leading}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {typeof title === 'string' ? (
                  <h4 className="text-sm font-bold leading-snug" style={{ color: theme.colors.textPrimary }}>
                    {title}
                  </h4>
                ) : (
                  title
                )}
                {badges}
              </div>
              {subtitle && (
                <div className="text-xs mt-0.5" style={{ color: theme.colors.textSecondary }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Details / Body */}
        {details && (
          <div className="text-xs leading-relaxed text-zinc-600">
            {details}
          </div>
        )}

        {/* Card Bottom / Footer Row: Metrics and Action Buttons */}
        {(metrics || actions || footer) && (
          <div
            style={{
              borderTop: `1px solid ${theme.colors.borderLight}`,
              paddingTop: theme.spacing.xs,
            }}
            className="flex items-center justify-between gap-2 flex-wrap pt-2"
          >
            <div className="min-w-0">{metrics}</div>
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
            {footer && <div className="w-full">{footer}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
