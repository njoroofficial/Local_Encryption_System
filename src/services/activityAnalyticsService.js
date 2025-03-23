import api from './api';

/**
 * Get file activity statistics grouped by day of week
 * @param {string} userId - User ID
 * @param {string} period - Time period (week, month, quarter, year)
 * @returns {Promise<Array>} - Activity data for chart
 */
export async function getWeeklyActivityStats(userId, period = 'month') {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Calculate the start date based on the period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'quarter':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'year':
        startDate.setDate(endDate.getDate() - 365);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30); // Default to month
    }

    const filters = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };

    const response = await api.get(`/analytics/activity/${userId}`, { params: { 
      period, 
      startDate: filters.startDate, 
      endDate: filters.endDate 
    }});

    return response.data;
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch activity statistics');
  }
}

/**
 * Get weekly user session activity data
 * @param {string} userId - User ID
 * @param {string} period - Time period (week, month, quarter, year)
 * @returns {Promise<Array>} - Weekly session data for chart
 */
export async function getWeeklySessionStats(userId, period = 'month') {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Calculate the start date based on the period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'quarter':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'year':
        startDate.setDate(endDate.getDate() - 365);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30); // Default to month
    }

    const filters = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };

    const response = await api.get(`/analytics/sessions/${userId}`, { params: { 
      period, 
      startDate: filters.startDate, 
      endDate: filters.endDate 
    }});

    return response.data;
  } catch (error) {
    console.error('Error fetching session stats:', error);
    
    // Return default data in case of error
    return getDefaultWeeklySessionData();
  }
}

/**
 * Get default weekly session data when API is not available
 * @returns {Array} - Default weekly session data
 */
function getDefaultWeeklySessionData() {
  return [
    { name: 'Mon', activity: 20 },
    { name: 'Tue', activity: 35 },
    { name: 'Wed', activity: 45 },
    { name: 'Thu', activity: 30 },
    { name: 'Fri', activity: 50 },
    { name: 'Sat', activity: 15 },
    { name: 'Sun', activity: 10 },
  ];
}

/**
 * Calculate activity trend (percentage change) compared to previous period
 * @param {Array} currentData - Current period data
 * @param {Array} previousData - Previous period data 
 * @returns {number} - Percentage change
 */
export function calculateActivityTrend(currentData, previousData) {
  if (!currentData || !previousData || !currentData.length || !previousData.length) {
    return 0;
  }
  
  // Calculate total counts for both periods
  const currentTotal = currentData.reduce((sum, item) => {
    return sum + (item.uploads || 0) + (item.downloads || 0) + (item.deletes || 0);
  }, 0);
  
  const previousTotal = previousData.reduce((sum, item) => {
    return sum + (item.uploads || 0) + (item.downloads || 0) + (item.deletes || 0);
  }, 0);
  
  // Calculate percentage change
  if (previousTotal === 0) return currentTotal > 0 ? 100 : 0;
  
  const percentChange = ((currentTotal - previousTotal) / previousTotal) * 100;
  return Math.round(percentChange);
}

/**
 * Format activity data into the format needed for the chart
 * @param {Array} activityData - Raw activity data from API
 * @returns {Array} - Formatted data for chart
 */
export function formatActivityData(activityData) {
  // Default data structure with days of the week
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Create a map with zero counts for all days
  const defaultData = dayNames.map(name => ({
    name,
    uploads: 0,
    downloads: 0,
    deletes: 0
  }));
  
  // If no data, return the default structure
  if (!activityData || !activityData.length) {
    return defaultData;
  }
  
  // Process the activity data and aggregate by day of week
  activityData.forEach(item => {
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const date = new Date(item.date);
    let dayIndex = date.getDay() - 1; // Convert to 0 = Monday, ..., 6 = Sunday
    
    // Handle Sunday (convert from 0 to 6)
    if (dayIndex === -1) dayIndex = 6;
    
    // Update the counts
    if (item.action_type === 'FILE_UPLOAD') {
      defaultData[dayIndex].uploads += item.count;
    } else if (item.action_type === 'FILE_DOWNLOAD') {
      defaultData[dayIndex].downloads += item.count;
    } else if (item.action_type === 'FILE_DELETE') {
      defaultData[dayIndex].deletes += item.count;
    }
  });
  
  return defaultData;
} 