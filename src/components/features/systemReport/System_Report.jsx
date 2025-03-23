import React, { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Tabs,
  Tab,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  CircularProgress
} from '@mui/material'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import DownloadIcon from '@mui/icons-material/Download'
import FileTextIcon from '@mui/icons-material/Description'
import CalendarIcon from '@mui/icons-material/CalendarToday'
import BarChart3Icon from '@mui/icons-material/BarChart'
import PieChartIcon from '@mui/icons-material/PieChart'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ShieldIcon from '@mui/icons-material/Shield'
import FolderIcon from '@mui/icons-material/Folder'
import FileIcon from '@mui/icons-material/InsertDriveFile'
import AlertTriangleIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import '../../../styles/systemReport.css'
import { 
  getWeeklyActivityStats, 
  formatActivityData, 
  getWeeklySessionStats,
  calculateActivityTrend
} from '../../../services/activityAnalyticsService'
import {
  getEncryptionStatus,
  getSecurityMetrics,
  getSecurityRecommendations,
  formatSecurityData
} from '../../../services/securityAnalyticsService'
import {
  getStorageDistribution,
  generateStorageInsights
} from '../../../services/storageAnalyticsService'

// TabPanel component for Material UI tabs
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function SystemReport() {
  const [reportPeriod, setReportPeriod] = useState("month")
  const [reportType, setReportType] = useState("all")
  const [activeTab, setActiveTab] = useState(0);
  const [activityData, setActivityData] = useState([]);
  const [userSessionData, setUserSessionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [activityTrend, setActivityTrend] = useState(0);
  const [error, setError] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  
  // Security data states
  const [securityData, setSecurityData] = useState([]);
  const [securityMetrics, setSecurityMetrics] = useState({
    overallScore: 0,
    encryptionCoverage: 0,
    encryptionStrength: 0
  });
  const [securityRecommendations, setSecurityRecommendations] = useState([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState(null);
  
  // Storage data states
  const [storageData, setStorageData] = useState([]);
  const [storageInsights, setStorageInsights] = useState([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [totalVaults, setTotalVaults] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']
  const SECURITY_COLORS = ['#4ade80', '#f87171'] // green for encrypted, red for unencrypted
  
  // Fetch storage data when tab changes to storage or on first load
  useEffect(() => {
    const fetchStorageData = async () => {
      // Only fetch if on storage tab or first load
      if (activeTab !== 0 && storageData.length > 0) return;
      
      setStorageLoading(true);
      setStorageError(null);
      
      try {
        // Get userId from localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !userData.userId) {
          setStorageError('User data not found. Please log in again.');
          setStorageLoading(false);
          return;
        }
        
        const userId = userData.userId;
        
        // Fetch storage distribution data
        const distributionData = await getStorageDistribution(userId);
        setStorageData(distributionData);
        
        // Calculate totals for summary cards
        if (distributionData && Array.isArray(distributionData)) {
          setTotalVaults(distributionData.length);
          const files = distributionData.reduce((sum, vault) => sum + vault.value, 0);
          setTotalFiles(files);
        }
        
        // Generate insights based on distribution data
        const insights = generateStorageInsights(distributionData);
        setStorageInsights(insights);
      } catch (err) {
        console.error('Error fetching storage data:', err);
        setStorageError(err.message || 'Failed to load storage data');
        
        // Set default data if error occurs
        setStorageData([
          { name: 'Personal Documents', value: 0 },
          { name: 'Work Projects', value: 0 }
        ]);
      } finally {
        setStorageLoading(false);
      }
    };
    
    fetchStorageData();
  }, [activeTab, storageData.length]);
  
  // Fetch activity data when report period changes
  useEffect(() => {
    const fetchActivityData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get userId from localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !userData.userId) {
          setError('User data not found. Please log in again.');
          setLoading(false);
          return;
        }
        
        const userId = userData.userId;
        
        // Fetch current period data
        const data = await getWeeklyActivityStats(userId, reportPeriod);
        const formattedData = formatActivityData(data);
        setActivityData(formattedData);
        
        // Calculate previous period for comparison
        const previousPeriod = calculatePreviousPeriod(reportPeriod);
        const previousData = await getWeeklyActivityStats(userId, previousPeriod);
        const formattedPreviousData = formatActivityData(previousData);
        
        // Calculate activity trend
        const trend = calculateActivityTrend(formattedData, formattedPreviousData);
        setActivityTrend(trend);
      } catch (err) {
        console.error('Error fetching activity data:', err);
        setError(err.message || 'Failed to load activity data');
        // Set default data if error occurs
        setActivityData([
          { name: 'Monday', uploads: 0, downloads: 0, deletes: 0 },
          { name: 'Tuesday', uploads: 0, downloads: 0, deletes: 0 },
          { name: 'Wednesday', uploads: 0, downloads: 0, deletes: 0 },
          { name: 'Thursday', uploads: 0, downloads: 0, deletes: 0 },
          { name: 'Friday', uploads: 0, downloads: 0, deletes: 0 },
          { name: 'Saturday', uploads: 0, downloads: 0, deletes: 0 },
          { name: 'Sunday', uploads: 0, downloads: 0, deletes: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivityData();
  }, [reportPeriod]);
  
  // Fetch user session data when report period changes
  useEffect(() => {
    const fetchSessionData = async () => {
      setSessionLoading(true);
      setSessionError(null);
      try {
        // Get userId from localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !userData.userId) {
          setSessionError('User data not found. Please log in again.');
          setSessionLoading(false);
          return;
        }
        
        const userId = userData.userId;
        const data = await getWeeklySessionStats(userId, reportPeriod);
        setUserSessionData(data);
      } catch (err) {
        console.error('Error fetching session data:', err);
        setSessionError(err.message || 'Failed to load session data');
      } finally {
        setSessionLoading(false);
      }
    };
    
    fetchSessionData();
  }, [reportPeriod]);
  
  // Fetch security data when tab changes to security or on first load
  useEffect(() => {
    const fetchSecurityData = async () => {
      // Only fetch if on security tab or first load
      if (activeTab !== 2 && securityData.length > 0) return;
      
      setSecurityLoading(true);
      setSecurityError(null);
      
      try {
        // Get userId from localStorage
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !userData.userId) {
          setSecurityError('User data not found. Please log in again.');
          setSecurityLoading(false);
          return;
        }
        
        const userId = userData.userId;
        
        // Fetch all security data in parallel
        const [encryptionData, metrics, recommendations] = await Promise.all([
          getEncryptionStatus(userId),
          getSecurityMetrics(userId),
          getSecurityRecommendations(userId)
        ]);
        
        // Format encryption data for pie chart
        const formattedSecurityData = formatSecurityData(encryptionData);
        setSecurityData(formattedSecurityData);
        setSecurityMetrics(metrics);
        setSecurityRecommendations(recommendations);
      } catch (err) {
        console.error('Error fetching security data:', err);
        setSecurityError(err.message || 'Failed to load security data');
        
        // Set default data if error occurs
        setSecurityData([
          { name: 'Encrypted', value: 0 },
          { name: 'Unencrypted', value: 0 }
        ]);
      } finally {
        setSecurityLoading(false);
      }
    };
    
    fetchSecurityData();
  }, [activeTab, securityData.length]);
  
  // Helper function to calculate previous period for comparison
  const calculatePreviousPeriod = (currentPeriod) => {
    switch (currentPeriod) {
      case 'week':
        return 'week'; // Previous week (same duration)
      case 'month':
        return 'month'; // Previous month (same duration)
      case 'quarter':
        return 'quarter'; // Previous quarter (same duration)
      case 'year':
        return 'year'; // Previous year (same duration)
      default:
        return 'month';
    }
  };
  
  const handleDownloadPDF = () => {
    // Logic to generate and download PDF
    console.log('Downloading PDF report...')
  }
  
  const handleDownloadCSV = () => {
    // Logic to generate and download CSV
    console.log('Downloading CSV data...')
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Calculate the peak activity day
  const getPeakActivityDay = () => {
    if (!activityData || activityData.length === 0) return { name: 'N/A', total: 0 };
    
    return activityData.reduce((max, day) => {
      const dayTotal = (day.uploads || 0) + (day.downloads || 0) + (day.deletes || 0);
      const maxTotal = (max.uploads || 0) + (max.downloads || 0) + (max.deletes || 0);
      
      return dayTotal > maxTotal ? day : max;
    }, { name: 'N/A', uploads: 0, downloads: 0, deletes: 0 });
  };
  
  // Calculate the most common operation
  const getMostCommonOperation = () => {
    if (!activityData || activityData.length === 0) {
      return { type: 'N/A', count: 0, percentage: 0 };
    }
    
    // Sum all operations by type
    const totals = activityData.reduce(
      (sum, day) => {
        sum.uploads += day.uploads || 0;
        sum.downloads += day.downloads || 0;
        sum.deletes += day.deletes || 0;
        return sum;
      },
      { uploads: 0, downloads: 0, deletes: 0 }
    );
    
    // Find the operation with the highest count
    let highestType = 'uploads';
    let highestCount = totals.uploads;
    
    if (totals.downloads > highestCount) {
      highestType = 'downloads';
      highestCount = totals.downloads;
    }
    
    if (totals.deletes > highestCount) {
      highestType = 'deletes';
      highestCount = totals.deletes;
    }
    
    // Calculate total operations and percentage
    const totalOperations = totals.uploads + totals.downloads + totals.deletes;
    const percentage = totalOperations > 0 
      ? Math.round((highestCount / totalOperations) * 100)
      : 0;
    
    // Map type to display name
    const typeNames = {
      'uploads': 'File Upload',
      'downloads': 'File Download',
      'deletes': 'File Deletion'
    };
    
    return {
      type: typeNames[highestType] || 'N/A',
      count: highestCount,
      percentage
    };
  };
  
  // Get peak activity day
  const peakDay = getPeakActivityDay();
  
  // Get most common operation
  const mostCommonOp = getMostCommonOperation();

  // Render icon based on recommendation type
  const getRecommendationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="icon-success" />;
      case 'warning':
        return <AlertTriangleIcon className="icon-warning" />;
      case 'info':
        return <TrendingUpIcon className="icon-info" />;
      default:
        return <AlertTriangleIcon className="icon-warning" />;
    }
  };

  return (
    <div className="system-container">
      <div className="system-content">
        {/* Report Header */}
        <div className="report-header">
          <div>
            <h1 className="report-title">System Performance Report</h1>
            <p className="report-date">
              <CalendarIcon className="icon-sm" />
              Generated on {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="report-actions">
            <Button 
              variant="contained" 
              onClick={handleDownloadPDF} 
              className="btn-with-icon"
              startIcon={<FileTextIcon />}
            >
              Download PDF
            </Button>
            <Button 
              variant="outlined" 
              onClick={handleDownloadCSV} 
              className="btn-with-icon"
              startIcon={<DownloadIcon />}
            >
              Export CSV
            </Button>
          </div>
        </div>
        
        {/* Report Filters */}
        <Card>
          <CardContent className="card-padding-top">
            <div className="filters-container">
              <div className="filter-item">
                <FormControl fullWidth>
                  <InputLabel>Report Period</InputLabel>
                  <Select
                    value={reportPeriod}
                    label="Report Period"
                    onChange={(e) => setReportPeriod(e.target.value)}
                  >
                    <MenuItem value="week">Last 7 Days</MenuItem>
                    <MenuItem value="month">Last 30 Days</MenuItem>
                    <MenuItem value="quarter">Last Quarter</MenuItem>
                    <MenuItem value="year">Last Year</MenuItem>
                  </Select>
                </FormControl>
              </div>
              <div className="filter-item">
                <FormControl fullWidth>
                  <InputLabel>Report Type</InputLabel>
                  <Select
                    value={reportType}
                    label="Report Type"
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <MenuItem value="all">All Metrics</MenuItem>
                    <MenuItem value="storage">Storage Usage</MenuItem>
                    <MenuItem value="activity">User Activity</MenuItem>
                    <MenuItem value="security">Security Status</MenuItem>
                  </Select>
                </FormControl>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Executive Summary */}
        <Paper elevation={0} sx={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
          <CardHeader 
            title="Executive Summary"
            subheader="Key performance indicators and system health"
            sx={{ 
              borderBottom: '1px solid #e5e7eb', 
              padding: '1.25rem 1.5rem',
              '& .MuiCardHeader-title': {
                fontSize: '1.25rem',
                fontWeight: '600'
              },
              '& .MuiCardHeader-subheader': {
                fontSize: '0.875rem',
                marginTop: '0.25rem'
              }
            }}
          />
          <CardContent sx={{ padding: '1rem' }}>
            <div className="summary-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '1.5rem',
              padding: '1rem 0.5rem' 
            }}>
              <div className="summary-card" style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }
              }}>
                <div className="summary-header">
                  <FolderIcon className="folder-icon" style={{ 
                    fontSize: '2rem', 
                    color: '#4f46e5',
                    marginBottom: '0.75rem'
                  }} />
                  <span className="summary-label" style={{
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#4b5563'
                  }}>Total Vaults</span>
                </div>
                <div className="summary-value" style={{
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: '#111827',
                  margin: '0.5rem 0'
                }}>{totalVaults}</div>
                <div className="summary-subtext" style={{
                  fontSize: '0.875rem',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>+3 since last month</div>
              </div>
              
              <div className="summary-card" style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }
              }}>
                <div className="summary-header">
                  <FileIcon className="file-icon" style={{ 
                    fontSize: '2rem', 
                    color: '#0ea5e9',
                    marginBottom: '0.75rem'
                  }} />
                  <span className="summary-label" style={{
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#4b5563'
                  }}>Total Files</span>
                </div>
                <div className="summary-value" style={{
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: '#111827',
                  margin: '0.5rem 0'
                }}>{totalFiles}</div>
                <div className="summary-subtext" style={{
                  fontSize: '0.875rem',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>+156 since last month</div>
              </div>
              
              <div className="summary-card" style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }
              }}>
                <div className="summary-header">
                  <ShieldIcon className="shield-icon" style={{ 
                    fontSize: '2rem', 
                    color: '#22c55e',
                    marginBottom: '0.75rem'
                  }} />
                  <span className="summary-label" style={{
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#4b5563'
                  }}>Encryption Rate</span>
                </div>
                <div className="summary-value" style={{
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: '#111827',
                  margin: '0.5rem 0'
                }}>{securityMetrics.encryptionCoverage}%</div>
                <div className="summary-subtext" style={{
                  fontSize: '0.875rem',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>+5% since last month</div>
              </div>
            </div>
          </CardContent>
        </Paper>
        
        {/* Detailed Reports */}
        <Paper elevation={0} sx={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            aria-label="report tabs"
            className="tabs-grid"
            variant="fullWidth"
            sx={{
              borderBottom: '1px solid #e5e7eb',
              '& .MuiTab-root': {
                padding: '1rem 0',
                minHeight: '56px'
              }
            }}
          >
            <Tab 
              icon={<PieChartIcon />} 
              label="Storage Analysis" 
              iconPosition="start"
              className="tab-with-icon" 
            />
            <Tab 
              icon={<BarChart3Icon />} 
              label="Activity Trends" 
              iconPosition="start"
              className="tab-with-icon" 
            />
            <Tab 
              icon={<ShieldIcon />} 
              label="Security Status" 
              iconPosition="start"
              className="tab-with-icon" 
            />
          </Tabs>
          
          {/* Storage Analysis Tab */}
          <TabPanel value={activeTab} index={0}>
            <Card elevation={0}>
              <CardHeader 
                title="Storage Distribution by Vault"
                subheader="Breakdown of storage usage across different vaults"
              />
              <CardContent>
                {storageLoading ? (
                  <div className="loading-container">
                    <CircularProgress />
                    <p>Loading storage data...</p>
                  </div>
                ) : storageError ? (
                  <div className="error-container">
                    <p className="error-message">{storageError}</p>
                  </div>
                ) : (
                <div className="two-column-grid">
                  <div className="chart-container">
                    {storageData.length === 0 ? (
                      <div className="empty-data-message">
                        <FolderIcon style={{ fontSize: 48, color: '#9ca3af' }} />
                        <p>No vaults found. Create your first vault to get started.</p>
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={storageData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => 
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {storageData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} files`, 'Count']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                  
                  <div className="insight-container">
                    <h3 className="insight-title">Storage Insights</h3>
                    {storageData.length === 0 ? (
                      <div className="empty-insights-message">
                        <p>Create vaults and add files to generate insights.</p>
                      </div>
                    ) : (
                    <ul className="insight-list">
                      {storageInsights.map((insight, index) => (
                        <li key={index} className="insight-item">
                          {insight.type === 'success' && <CheckCircleIcon className="icon-success" />}
                          {insight.type === 'warning' && <AlertTriangleIcon className="icon-warning" />}
                          {insight.type === 'info' && <TrendingUpIcon className="icon-info" />}
                          <div>
                            <p className="insight-heading">{insight.heading}</p>
                            <p className="insight-text">{insight.text}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    )}
                  </div>
                </div>
                )}
              </CardContent>
            </Card>
          </TabPanel>
          
          {/* Activity Trends Tab */}
          <TabPanel value={activeTab} index={1}>
            <Card elevation={0}>
              <CardHeader 
                title="Activity Trends"
                subheader="File operations over time"
              />
              <CardContent>
                {loading ? (
                  <div className="loading-container">
                    <CircularProgress />
                    <p>Loading activity data...</p>
                  </div>
                ) : error ? (
                  <div className="error-container">
                    <p className="error-message">{error}</p>
                  </div>
                ) : (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activityData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="uploads" fill="#8884d8" name="File Uploads" />
                      <Bar dataKey="downloads" fill="#82ca9d" name="File Downloads" />
                        <Bar dataKey="deletes" fill="#ffc658" name="File Deletions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                )}
                
                <div className="stats-grid">
                  <Card>
                    <CardHeader 
                      title="Peak Activity Day"
                      className="stat-card-header"
                      titleTypographyProps={{ className: "stat-card-title" }}
                    />
                    <CardContent>
                      <div className="stat-value">
                        {peakDay.name !== 'N/A' ? peakDay.name : 'N/A'}
                      </div>
                      <p className="stat-subtext">
                        {peakDay.name !== 'N/A' 
                          ? `${(peakDay.uploads || 0) + (peakDay.downloads || 0) + (peakDay.deletes || 0)} operations`
                          : 'No activity recorded'}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader 
                      title="Most Common Operation"
                      className="stat-card-header"
                      titleTypographyProps={{ className: "stat-card-title" }}
                    />
                    <CardContent>
                      <div className="stat-value">
                        {mostCommonOp.type}
                      </div>
                      <p className="stat-subtext">
                        {mostCommonOp.percentage > 0 
                          ? `${mostCommonOp.percentage}% of operations`
                          : '0% of operations'}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader 
                      title="Activity Trend"
                      className="stat-card-header"
                      titleTypographyProps={{ className: "stat-card-title" }}
                    />
                    <CardContent>
                      <div className={`stat-value ${activityTrend >= 0 ? 'stat-positive' : 'stat-negative'}`}>
                        {activityTrend > 0 ? `+${activityTrend}%` : activityTrend === 0 ? 'No change' : `${activityTrend}%`}
                      </div>
                      <p className="stat-subtext">
                        {activityTrend >= 0 
                          ? 'Increase in overall activity' 
                          : 'Decrease in overall activity'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="section-container">
                  <h3 className="section-title">Weekly User Activity</h3>
                  {sessionLoading ? (
                    <div className="loading-container" style={{ height: '200px' }}>
                      <CircularProgress size={30} />
                      <p>Loading session data...</p>
                    </div>
                  ) : sessionError ? (
                    <div className="error-container" style={{ height: '200px' }}>
                      <p className="error-message">{sessionError}</p>
                    </div>
                  ) : (
                  <div className="line-chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                          data={userSessionData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="activity" 
                            stroke="#8884d8" 
                            activeDot={{ r: 8 }} 
                            name="User Sessions" 
                          />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabPanel>
          
          {/* Security Status Tab */}
          <TabPanel value={activeTab} index={2}>
            <Card elevation={0}>
              <CardHeader 
                title="Security Status"
                subheader="Encryption status and security metrics"
              />
              <CardContent>
                {securityLoading ? (
                  <div className="loading-container">
                    <CircularProgress />
                    <p>Loading security data...</p>
                  </div>
                ) : securityError ? (
                  <div className="error-container">
                    <p className="error-message">{securityError}</p>
                  </div>
                ) : (
                <div className="two-column-grid">
                  <div className="chart-container">
                    {securityData.length === 0 ? (
                      <div className="empty-data-message">
                        <ShieldIcon style={{ fontSize: 48, color: '#9ca3af' }} />
                        <p>No encryption data available. Add files to your vaults to see encryption status.</p>
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={securityData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => 
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {securityData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={SECURITY_COLORS[index % SECURITY_COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} files`, 'Count']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="section-title">Security Insights</h3>
                    <div className="progress-container">
                      <div className="progress-item">
                        <div className="progress-header">
                          <span className="progress-label">Overall Security Score</span>
                          <span className="progress-label">{securityMetrics.overallScore}/100</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div 
                            className="progress-bar-fill progress-green" 
                            style={{ width: `${securityMetrics.overallScore}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="progress-item">
                        <div className="progress-header">
                          <span className="progress-label">Encryption Coverage</span>
                          <span className="progress-label">{securityMetrics.encryptionCoverage}%</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div 
                            className="progress-bar-fill progress-blue" 
                            style={{ width: `${securityMetrics.encryptionCoverage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="progress-item">
                        <div className="progress-header">
                          <span className="progress-label">Encryption Strength</span>
                          <span className="progress-label">{securityMetrics.encryptionStrength}%</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div 
                            className="progress-bar-fill progress-indigo" 
                            style={{ width: `${securityMetrics.encryptionStrength}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
                
                <div className="section-container">
                  <h3 className="section-title">Security Recommendations</h3>
                  {securityLoading ? (
                    <div className="loading-container" style={{ height: '150px' }}>
                      <CircularProgress size={30} />
                      <p>Loading recommendations...</p>
                    </div>
                  ) : securityError ? (
                    <div className="error-container" style={{ height: '150px' }}>
                      <p className="error-message">{securityError}</p>
                    </div>
                  ) : (
                  <ul className="recommendation-list">
                    {securityRecommendations.length > 0 ? (
                      securityRecommendations.map((recommendation, index) => (
                        <li key={index} className="recommendation-item">
                          {getRecommendationIcon(recommendation.type)}
                          <div>
                            <p className="recommendation-heading">{recommendation.heading}</p>
                            <p className="recommendation-text">{recommendation.text}</p>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="recommendation-item">
                        <CheckCircleIcon className="icon-success" />
                        <div>
                          <p className="recommendation-heading">All security checks passed</p>
                          <p className="recommendation-text">No issues found with your encryption security</p>
                        </div>
                      </li>
                    )}
                  </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabPanel>
        </Paper>
      </div>
    </div>
  )
}