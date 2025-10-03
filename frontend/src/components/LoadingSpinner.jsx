import React from 'react';
import { clsx } from 'clsx';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'blue', 
  className = '',
  text = null,
  fullScreen = false 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
    xlarge: 'w-16 h-16'
  };

  const colorClasses = {
    blue: 'border-blue-600',
    green: 'border-green-600',
    red: 'border-red-600',
    yellow: 'border-yellow-600',
    gray: 'border-gray-600',
    white: 'border-white'
  };

  const spinnerClasses = clsx(
    'animate-spin rounded-full border-4 border-solid border-current border-r-transparent',
    sizeClasses[size],
    colorClasses[color],
    className
  );

  const content = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className={spinnerClasses} role="status" aria-label="Loading">
        <span className="sr-only">Loading...</span>
      </div>
      {text && (
        <p className="text-sm text-gray-600 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
};

// Skeleton loader component for content placeholders
export const SkeletonLoader = ({ 
  lines = 3, 
  className = '',
  animate = true 
}) => {
  return (
    <div className={clsx('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={clsx(
            'h-4 bg-gray-200 rounded',
            animate && 'animate-pulse',
            // Vary the width for more realistic skeleton
            index === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
};

// Card skeleton loader
export const CardSkeleton = ({ className = '' }) => {
  return (
    <div className={clsx('bg-white rounded-lg shadow-sm border border-gray-200 p-6', className)}>
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
        <div className="mt-6 flex space-x-3">
          <div className="h-8 bg-gray-200 rounded w-20"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    </div>
  );
};

// Table skeleton loader
export const TableSkeleton = ({ 
  rows = 5, 
  columns = 4, 
  className = '' 
}) => {
  return (
    <div className={clsx('bg-white rounded-lg shadow-sm border border-gray-200', className)}>
      <div className="animate-pulse">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <div key={index} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="border-b border-gray-100 p-4 last:border-b-0">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div 
                  key={colIndex} 
                  className={clsx(
                    'h-4 bg-gray-200 rounded',
                    // Vary widths for more realistic appearance
                    colIndex === 0 ? 'w-3/4' : colIndex === columns - 1 ? 'w-1/2' : 'w-full'
                  )}
                ></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Parking slot grid skeleton
export const ParkingGridSkeleton = ({ 
  slots = 20, 
  className = '' 
}) => {
  return (
    <div className={clsx('grid-parking-slots', className)}>
      {Array.from({ length: slots }).map((_, index) => (
        <div
          key={index}
          className="parking-slot bg-gray-200 animate-pulse border-gray-300"
          style={{ aspectRatio: '1 / 2', minHeight: '80px' }}
        >
          <div className="parking-slot-number">
            <div className="w-6 h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Loading overlay component
export const LoadingOverlay = ({ 
  isLoading, 
  text = 'Loading...', 
  children,
  blur = true 
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className={clsx(
          'absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10',
          blur && 'backdrop-blur-sm'
        )}>
          <LoadingSpinner text={text} />
        </div>
      )}
    </div>
  );
};

// Button with loading state
export const LoadingButton = ({
  isLoading = false,
  disabled = false,
  children,
  className = '',
  loadingText = 'Loading...',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={clsx(
        'btn inline-flex items-center justify-center',
        className,
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isLoading && (
        <LoadingSpinner 
          size="small" 
          color="white" 
          className="mr-2" 
        />
      )}
      {isLoading ? loadingText : children}
    </button>
  );
};

// Progress bar with loading animation
export const ProgressBar = ({
  progress = 0,
  isLoading = false,
  className = '',
  showPercentage = true,
  color = 'blue'
}) => {
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    yellow: 'bg-yellow-600'
  };

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex justify-between items-center mb-2">
        {showPercentage && (
          <span className="text-sm text-gray-600">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-300 ease-out',
            colorClasses[color],
            isLoading && 'animate-pulse'
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};

export default LoadingSpinner;
