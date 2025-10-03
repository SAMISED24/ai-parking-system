import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  CalendarIcon, 
  ChartBarIcon, 
  ClockIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { adminService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { formatTime, formatDate, getPeakHours } from '../utils/dateUtils';

const Analytics = ({ parkingLotId = null, days = 7 }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(days);
  const [chartType, setChartType] = useState('occupancy');

  useEffect(() => {
    loadAnalytics();
  }, [parkingLotId, selectedPeriod]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let response;
      if (parkingLotId) {
        response = await adminService.getParkingLotAnalytics(parkingLotId, selectedPeriod);
      } else {
        response = await adminService.getSystemAnalytics(selectedPeriod);
      }
      
      if (response.data.success) {
        setAnalyticsData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const processChartData = () => {
    if (!analyticsData) return [];

    const dailyData = analyticsData.daily_analytics || [];
    const hourlyData = analyticsData.hourly_analytics || [];

    return {
      daily: dailyData.map(day => ({
        date: formatDate(day.date, 'MMM dd'),
        occupancy: parseFloat(day.avg_occupancy_rate || 0),
        vehicles: parseInt(day.total_vehicles || 0),
        revenue: parseFloat(day.total_revenue || 0)
      })),
      hourly: hourlyData.map(hour => ({
        hour: `${hour.hour.toString().padStart(2, '0')}:00`,
        occupancy: parseFloat(hour.avg_occupancy_rate || 0),
        vehicles: parseInt(hour.total_vehicles || 0),
        revenue: parseFloat(hour.total_revenue || 0)
      }))
    };
  };

  const chartData = processChartData();
  const peakHours = analyticsData ? getPeakHours(analyticsData.hourly_analytics || []) : null;

  // Chart colors
  const colors = {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#F59E0B',
    danger: '#EF4444'
  };

  const pieColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" text="Loading analytics..." />
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
        <p className="text-gray-600">No analytics data available for the selected period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">
            {parkingLotId ? 'Parking lot' : 'System-wide'} analytics for the last {selectedPeriod} days
          </p>
        </div>
        
        <div className="flex space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
            className="form-input text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="form-input text-sm"
          >
            <option value="occupancy">Occupancy</option>
            <option value="vehicles">Vehicles</option>
            <option value="revenue">Revenue</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Occupancy</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.overall_statistics?.overall_occupancy_rate || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Vehicles</p>
              <p className="text-2xl font-bold text-gray-900">
                {chartData.daily.reduce((sum, day) => sum + day.vehicles, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${chartData.daily.reduce((sum, day) => sum + day.revenue, 0).toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Peak Hour</p>
              <p className="text-2xl font-bold text-gray-900">
                {peakHours?.peak?.time || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Daily {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Trend
          </h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    chartType === 'revenue' ? `$${value.toFixed(2)}` : 
                    chartType === 'occupancy' ? `${value.toFixed(1)}%` : value,
                    name
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={chartType}
                  stroke={colors.primary}
                  fill={colors.primary}
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Pattern Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Hourly {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Pattern
          </h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.hourly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    chartType === 'revenue' ? `$${value.toFixed(2)}` : 
                    chartType === 'occupancy' ? `${value.toFixed(1)}%` : value,
                    name
                  ]}
                />
                <Bar dataKey={chartType} fill={colors.secondary} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Occupancy Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Occupancy Distribution
          </h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Low (0-25%)', value: chartData.daily.filter(d => d.occupancy <= 25).length },
                    { name: 'Medium (26-50%)', value: chartData.daily.filter(d => d.occupancy > 25 && d.occupancy <= 50).length },
                    { name: 'High (51-75%)', value: chartData.daily.filter(d => d.occupancy > 50 && d.occupancy <= 75).length },
                    { name: 'Very High (76-100%)', value: chartData.daily.filter(d => d.occupancy > 75).length }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieColors.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Peak Hours Analysis
          </h3>
          {peakHours ? (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-800">Peak Hour</p>
                    <p className="text-lg font-bold text-red-900">{peakHours.peak.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-red-600">Occupancy</p>
                    <p className="text-lg font-bold text-red-900">{peakHours.peak.rate}%</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">Low Hour</p>
                    <p className="text-lg font-bold text-green-900">{peakHours.low.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600">Occupancy</p>
                    <p className="text-lg font-bold text-green-900">{peakHours.low.rate}%</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Average</p>
                    <p className="text-lg font-bold text-blue-900">{peakHours.average}%</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ClockIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No peak hours data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      {analyticsData.recent_activity && analyticsData.recent_activity.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyticsData.recent_activity.slice(0, 10).map((activity, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {activity.activity_type.replace('_', ' ').toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {activity.parking_lot_name} - {activity.slot_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(activity.timestamp, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
