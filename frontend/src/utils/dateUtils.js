import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

/**
 * Format duration in seconds to human readable string
 * @param {number} seconds - Duration in seconds
 * @param {boolean} short - Use short format (e.g., "2h 30m" vs "2 hours 30 minutes")
 * @returns {string} Formatted duration string
 */
export function formatDuration(seconds, short = false) {
  if (!seconds || seconds < 0) return short ? '0m' : '0 minutes';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];

  if (hours > 0) {
    parts.push(short ? `${hours}h` : `${hours} hour${hours !== 1 ? 's' : ''}`);
  }

  if (minutes > 0) {
    parts.push(short ? `${minutes}m` : `${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  if (parts.length === 0 && remainingSeconds > 0) {
    parts.push(short ? `${remainingSeconds}s` : `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return short ? '0m' : '0 minutes';
  }

  return parts.join(' ');
}

/**
 * Format time to human readable string
 * @param {string|Date} dateTime - Date/time to format
 * @param {boolean} includeDate - Include date in the output
 * @returns {string} Formatted time string
 */
export function formatTime(dateTime, includeDate = false) {
  if (!dateTime) return 'Unknown';

  const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;

  if (includeDate) {
    if (isToday(date)) {
      return `Today at ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM dd, yyyy HH:mm');
    }
  }

  return format(date, 'HH:mm');
}

/**
 * Format date to human readable string
 * @param {string|Date} date - Date to format
 * @param {string} formatString - Custom format string
 * @returns {string} Formatted date string
 */
export function formatDate(date, formatString = 'MMM dd, yyyy') {
  if (!date) return 'Unknown';

  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatString);
}

/**
 * Format relative time (e.g., "2 hours ago", "in 30 minutes")
 * @param {string|Date} dateTime - Date/time to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(dateTime) {
  if (!dateTime) return 'Unknown';

  const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Get time remaining until a future date
 * @param {string|Date} futureDate - Future date
 * @returns {object} Object with days, hours, minutes, seconds remaining
 */
export function getTimeRemaining(futureDate) {
  if (!futureDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };

  const future = typeof futureDate === 'string' ? parseISO(futureDate) : futureDate;
  const now = new Date();
  const total = future.getTime() - now.getTime();

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, total };
}

/**
 * Format countdown timer
 * @param {number} seconds - Seconds remaining
 * @param {boolean} showSeconds - Whether to show seconds
 * @returns {string} Formatted countdown string
 */
export function formatCountdown(seconds, showSeconds = true) {
  if (seconds <= 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}${showSeconds ? `:${secs.toString().padStart(2, '0')}` : ''}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get business hours status
 * @param {Date} date - Date to check (defaults to now)
 * @returns {object} Business hours status
 */
export function getBusinessHoursStatus(date = new Date()) {
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday

  const isWeekend = day === 0 || day === 6;
  const isBusinessHours = hour >= 8 && hour < 18; // 8 AM to 6 PM

  let status = 'closed';
  let nextChange = null;

  if (!isWeekend && isBusinessHours) {
    status = 'open';
    // Next change is closing time today
    nextChange = new Date(date);
    nextChange.setHours(18, 0, 0, 0);
  } else if (!isWeekend && hour < 8) {
    status = 'closed';
    // Next change is opening time today
    nextChange = new Date(date);
    nextChange.setHours(8, 0, 0, 0);
  } else {
    status = 'closed';
    // Next change is opening time on next business day
    nextChange = new Date(date);
    let daysToAdd = 1;
    
    // If it's Friday evening/night or weekend, skip to Monday
    if (day === 5 && hour >= 18) daysToAdd = 3; // Friday to Monday
    else if (day === 6) daysToAdd = 2; // Saturday to Monday
    else if (day === 0) daysToAdd = 1; // Sunday to Monday
    
    nextChange.setDate(nextChange.getDate() + daysToAdd);
    nextChange.setHours(8, 0, 0, 0);
  }

  return {
    status,
    isBusinessHours: status === 'open',
    nextChange,
    timeUntilChange: nextChange ? getTimeRemaining(nextChange) : null
  };
}

/**
 * Format business hours status for display
 * @param {Date} date - Date to check (defaults to now)
 * @returns {string} Formatted status string
 */
export function formatBusinessHoursStatus(date = new Date()) {
  const status = getBusinessHoursStatus(date);
  
  if (status.isBusinessHours) {
    return `Open • Closes at ${format(status.nextChange, 'HH:mm')}`;
  } else {
    const timeUntil = status.timeUntilChange;
    if (timeUntil && timeUntil.total > 0) {
      if (timeUntil.days > 0) {
        return `Closed • Opens ${format(status.nextChange, 'EEEE')} at ${format(status.nextChange, 'HH:mm')}`;
      } else if (timeUntil.hours > 0) {
        return `Closed • Opens in ${timeUntil.hours}h ${timeUntil.minutes}m`;
      } else {
        return `Closed • Opens in ${timeUntil.minutes}m`;
      }
    }
    return 'Closed';
  }
}

/**
 * Get peak hours information
 * @param {Array} analyticsData - Array of hourly analytics data
 * @returns {object} Peak hours information
 */
export function getPeakHours(analyticsData) {
  if (!analyticsData || analyticsData.length === 0) {
    return { peak: null, low: null, average: 0 };
  }

  const hourlyData = analyticsData.reduce((acc, data) => {
    const hour = data.hour;
    if (!acc[hour]) {
      acc[hour] = { hour, total: 0, count: 0 };
    }
    acc[hour].total += data.occupancy_rate || 0;
    acc[hour].count += 1;
    return acc;
  }, {});

  const averages = Object.values(hourlyData).map(data => ({
    hour: data.hour,
    average: data.total / data.count
  }));

  const peak = averages.reduce((max, current) => 
    current.average > max.average ? current : max
  );

  const low = averages.reduce((min, current) => 
    current.average < min.average ? current : min
  );

  const overallAverage = averages.reduce((sum, data) => sum + data.average, 0) / averages.length;

  return {
    peak: {
      hour: peak.hour,
      rate: Math.round(peak.average * 10) / 10,
      time: format(new Date().setHours(peak.hour, 0, 0, 0), 'HH:mm')
    },
    low: {
      hour: low.hour,
      rate: Math.round(low.average * 10) / 10,
      time: format(new Date().setHours(low.hour, 0, 0, 0), 'HH:mm')
    },
    average: Math.round(overallAverage * 10) / 10
  };
}

/**
 * Check if a time is within a range
 * @param {Date} time - Time to check
 * @param {number} startHour - Start hour (0-23)
 * @param {number} endHour - End hour (0-23)
 * @returns {boolean} Whether time is in range
 */
export function isTimeInRange(time, startHour, endHour) {
  const hour = time.getHours();
  
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  } else {
    // Handle overnight ranges (e.g., 22:00 to 06:00)
    return hour >= startHour || hour < endHour;
  }
}

/**
 * Get time-based greeting
 * @param {Date} date - Date to check (defaults to now)
 * @returns {string} Greeting string
 */
export function getTimeBasedGreeting(date = new Date()) {
  const hour = date.getHours();
  
  if (hour < 12) {
    return 'Good morning';
  } else if (hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

/**
 * Format date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {string} Formatted date range
 */
export function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return '';
  
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    // Same day
    return `${format(start, 'MMM dd, yyyy')} ${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  } else {
    // Different days
    return `${format(start, 'MMM dd, yyyy HH:mm')} - ${format(end, 'MMM dd, yyyy HH:mm')}`;
  }
}

/**
 * Get parking duration category
 * @param {number} seconds - Duration in seconds
 * @returns {string} Duration category
 */
export function getParkingDurationCategory(seconds) {
  if (seconds < 1800) return 'short'; // Less than 30 minutes
  if (seconds < 7200) return 'medium'; // 30 minutes to 2 hours
  if (seconds < 28800) return 'long'; // 2 to 8 hours
  return 'extended'; // More than 8 hours
}

/**
 * Get parking duration color
 * @param {number} seconds - Duration in seconds
 * @returns {string} Color class
 */
export function getParkingDurationColor(seconds) {
  const category = getParkingDurationCategory(seconds);
  
  switch (category) {
    case 'short': return 'text-green-600';
    case 'medium': return 'text-blue-600';
    case 'long': return 'text-yellow-600';
    case 'extended': return 'text-red-600';
    default: return 'text-gray-600';
  }
}
