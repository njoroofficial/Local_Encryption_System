import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  Box, 
  Typography, 
  TextField, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Paper,
  Button,
  InputAdornment,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Tooltip,
  Pagination,
  Autocomplete,
  Alert,
  Snackbar
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import LockIcon from '@mui/icons-material/Lock';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import InfoIcon from '@mui/icons-material/Info';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { getActivities, searchActivities, exportActivities } from '../../../services/activityLogService';
import '../../../styles/activityLog.css';

const ACTION_LABELS = {
  VAULT_CREATE: 'Vault Created',
  VAULT_ACCESS: 'Vault Accessed',
  VAULT_DELETE: 'Vault Deleted',
  FILE_UPLOAD: 'File Upload',
  FILE_DOWNLOAD: 'File Download',
  FILE_DELETE: 'File Delete',
  PASSWORD_CHANGE: 'Password Changed',
  VAULT_KEY_CHANGE: 'Vault Key Changed',
  FILE_KEY_CHANGE: 'File Key Changed',
  FILE_DECRYPT: 'File Decrypted',
};

const ActivityLog = ({ userId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    actionType: '',
    startDate: '',
    endDate: ''
  });
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionOptions, setActionOptions] = useState([]);
  const [matchingSuggestions, setMatchingSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Export related states
  const [showExportDialog, setShowExportDialog] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportFilters, setExportFilters] = useState({
    actionType: '',
    startDate: '',
    endDate: ''
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // Create action options for autocomplete
  useEffect(() => {
    const options = Object.entries(ACTION_LABELS).map(([key, label]) => ({
      key,
      label
    }));
    setActionOptions(options);
  }, []);
  
  // Initialize export filters with current applied filters when opening export dialog
  useEffect(() => {
    if (showExportDialog) {
      const currentFilters = { ...filters };
      setExportFilters(currentFilters);
    }
  }, [showExportDialog, filters]);

  const handleSearch = useCallback(async () => {
    console.log('ActivityLog: handleSearch called with:', { userId, searchTerm, filters, page });
    if (!userId) {
      setError('User ID is required');
      return;
    }

    // Clear previous suggestions
    setShowSuggestions(false);
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if search term matches any action label, apply as action type filter if it does
      const searchFilters = { ...filters };
      const searchTermLower = searchTerm.toLowerCase();
      let exactActionMatch = false;
      
      
      // Look for exact action label matches first
      const actionEntry = Object.entries(ACTION_LABELS).find(([key, label]) => 
        label.toLowerCase() === searchTermLower
      );
      
      // If no exact match, look for partial matches (action label contains search term)
      const partialMatches = !actionEntry && searchTermLower.length > 2 
        ? Object.entries(ACTION_LABELS).filter(([key, label]) => 
            label.toLowerCase().includes(searchTermLower)
          )
        : [];
      
      if (actionEntry) {
        // If search term exactly matches an action label, apply it as an action type filter
        searchFilters.actionType = actionEntry[0];
        exactActionMatch = true;
        
        // Update applied filters to show the action filter chip
        const actionFilterExists = appliedFilters.some(f => f.type === 'action');
        
        if (!actionFilterExists) {
          const newFilters = [...appliedFilters];
          newFilters.push({
            type: 'action',
            value: ACTION_LABELS[actionEntry[0]]
          });
          setAppliedFilters(newFilters);
        } else {
          // Update existing action filter
          const newFilters = appliedFilters.map(f => {
            if (f.type === 'action') {
              return { 
                type: 'action', 
                value: ACTION_LABELS[actionEntry[0]]
              };
            }
            return f;
          });
          setAppliedFilters(newFilters);
        }
        
        // If we've applied an exact action match, clear the search term for the API call
        const apiSearchTerm = exactActionMatch ? '' : searchTerm;
        const data = await searchActivities(userId, apiSearchTerm, searchFilters, page, 10);
        console.log('Search results:', data);
        setActivities(data.activities || []);
        setTotalPages(data.totalPages || 1);
      } else if (partialMatches.length === 1) {
        // If there's exactly one partial match, use it (similar to "did you mean?")
        const matchedAction = partialMatches[0];
        searchFilters.actionType = matchedAction[0];
        
        
        // Update applied filters to show the action filter chip
        const actionFilterExists = appliedFilters.some(f => f.type === 'action');
        
        if (!actionFilterExists) {
          const newFilters = [...appliedFilters];
          newFilters.push({
            type: 'action',
            value: ACTION_LABELS[matchedAction[0]]
          });
          setAppliedFilters(newFilters);
        } else {
          // Update existing action filter
          const newFilters = appliedFilters.map(f => {
            if (f.type === 'action') {
              return { 
                type: 'action', 
                value: ACTION_LABELS[matchedAction[0]]
              };
            }
            return f;
          });
          setAppliedFilters(newFilters);
        }
        
        // Show feedback about the partial match by updating the search term
        setSearchTerm(ACTION_LABELS[matchedAction[0]]);
        
        // Clear the search term for the API call as we're using the action type filter
        const data = await searchActivities(userId, '', searchFilters, page, 10);
        console.log('Search results (partial match):', data);
        setActivities(data.activities || []);
        setTotalPages(data.totalPages || 1);
      } else if (partialMatches.length > 1) {
        // Multiple partial matches, show suggestions and search normally
        const suggestions = partialMatches.map(([key, label]) => ({
          key,
          label
        }));
        setMatchingSuggestions(suggestions);
        setShowSuggestions(true);
        
        // Continue with normal search
        const data = await searchActivities(userId, searchTerm, filters, page, 10);
        console.log('Search results (multiple partial matches):', data);
        setActivities(data.activities || []);
        setTotalPages(data.totalPages || 1);
      } else {
        // Multiple partial matches or no matches, search normally
        const data = await searchActivities(userId, searchTerm, filters, page, 10);
        console.log('Search results (normal):', data);
        setActivities(data.activities || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error searching activities:', err);
      setError(err.message || 'Failed to search activities');
    } finally {
      setLoading(false);
    }
  }, [userId, searchTerm, filters, page, appliedFilters]);

  const handleFilterApply = () => {
    const newFilters = [];
    if (filters.actionType) {
      newFilters.push({
        type: 'action',
        value: ACTION_LABELS[filters.actionType] || filters.actionType
      });
    }
    if (filters.startDate) {
      newFilters.push({
        type: 'date',
        value: `From: ${new Date(filters.startDate).toLocaleDateString()}`
      });
    }
    if (filters.endDate) {
      newFilters.push({
        type: 'date',
        value: `To: ${new Date(filters.endDate).toLocaleDateString()}`
      });
    }
    setAppliedFilters(newFilters);
    setShowFilterDialog(false);
    handleSearch();
  };

  const handleFilterRemove = (filterToRemove) => {
    const newFilters = { ...filters };
    if (filterToRemove.type === 'action') {
      newFilters.actionType = '';
    } else if (filterToRemove.type === 'date') {
      if (filterToRemove.value.startsWith('From')) {
        newFilters.startDate = '';
      } else {
        newFilters.endDate = '';
      }
    }
    setFilters(newFilters);
    setAppliedFilters(appliedFilters.filter(f => 
      f.type !== filterToRemove.type || 
      f.value !== filterToRemove.value
    ));
    handleSearch();
  };

  const fetchActivities = useCallback(async () => {
    console.log('ActivityLog: fetchActivities called with:', { userId, page });
    if (!userId) {
      setError('User ID is required');
      return;
    }

    if (!searchTerm && !filters.actionType && !filters.startDate && !filters.endDate) {
      try {
        setLoading(true);
        setError(null);
        
        const data = await getActivities(userId, page, 10);
        console.log('Fetched activities:', data);
        setActivities(data.activities || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error('Error fetching activities:', err);
        setError(err.message || 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    } else {
      handleSearch();
    }
  }, [userId, page, searchTerm, filters, handleSearch]);

  // Effect for initial load and userId changes
  useEffect(() => {
    console.log('ActivityLog: userId changed:', userId);
    if (!userId) {
      setError('User ID is required');
      return;
    }
    fetchActivities();
  }, [userId, fetchActivities]);

  // Effect for page changes
  useEffect(() => {
    if (userId) {
      fetchActivities();
    }
  }, [userId, fetchActivities]);

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'VAULT_CREATE':
        return <LockIcon color="primary" />;
      case 'VAULT_ACCESS':
        return <LockOpenIcon color="success" />;
      case 'VAULT_DELETE':
        return <DeleteIcon color="error" />;
      case 'FILE_UPLOAD':
        return <CloudUploadIcon color="primary" />;
      case 'FILE_PREVIEW':
        return <VisibilityIcon color="primary" />;
      case 'FILE_DOWNLOAD':
        return <CloudDownloadIcon color="primary" />;
      case 'FILE_DELETE':
        return <DeleteIcon color="error" />;
      case 'PASSWORD_CHANGE':
        return <VpnKeyIcon color="primary" />;
      case 'VAULT_KEY_CHANGE':
        return <KeyIcon color="primary" />;
      case 'FILE_KEY_CHANGE':
        return <KeyIcon color="primary" />;
      case 'FILE_DECRYPT':
        return <LockOpenIcon color="primary" />;
      case 'FILE_REPAIR':
        return <KeyIcon color="warning" />;
      default:
        return <InfoIcon />;
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setSearchTerm(suggestion.label);
    setShowSuggestions(false);
    
    // Update filters
    const newFilters = { ...filters, actionType: suggestion.key };
    setFilters(newFilters);
    
    // Update applied filters chips
    const actionFilterExists = appliedFilters.some(f => f.type === 'action');
    if (!actionFilterExists) {
      setAppliedFilters([...appliedFilters, {
        type: 'action',
        value: suggestion.label
      }]);
    } else {
      setAppliedFilters(appliedFilters.map(f => {
        if (f.type === 'action') {
          return { type: 'action', value: suggestion.label };
        }
        return f;
      }));
    }
    
    // Trigger search with the selected action
    setTimeout(() => {
      handleSearch();
    }, 0);
  };
  
  // Handle export dialog open
  const handleExportOpen = () => {
    setShowExportDialog(true);
  };
  
  // Handle export dialog close
  const handleExportClose = () => {
    setShowExportDialog(false);
  };
  
  // Handle export submit
  const handleExportSubmit = async () => {
    setExportLoading(true);
    
    try {
      await exportActivities(userId, exportFilters, 'csv');
      
      setSnackbarMessage(`Activity logs exported successfully as CSV`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setShowExportDialog(false);
    } catch (err) {
      console.error('Error exporting activities:', err);
      setSnackbarMessage(`Failed to export logs: ${err.message || 'Unknown error'}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setExportLoading(false);
    }
  };
  
  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <div className="activity-log-container">
      {!userId ? (
        <Typography color="error" sx={{ p: 2 }}>
          User ID is required to view activity logs
        </Typography>
      ) : (
        <>
          <Box className="activity-log-header">
            <Typography variant="h4" component="h1">
              Activity Log
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Track all actions within your vaults
            </Typography>
          </Box>

          <Box className="search-filter-container" sx={{ mb: 2, display: 'flex', gap: 2 }}>
            <Autocomplete
              className="search-field"
              freeSolo
              options={actionOptions}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
              inputValue={searchTerm}
              onInputChange={(event, newValue) => {
                setSearchTerm(newValue);
                // Clear suggestions when search term is cleared
                if (!newValue || newValue.trim() === '') {
                  setShowSuggestions(false);
                  setMatchingSuggestions([]);
                }
              }}
              onChange={(event, newValue) => {
                if (newValue && typeof newValue !== 'string') {
                  // If user selects an action from dropdown
                  setSearchTerm(newValue.label);
                  setShowSuggestions(false);
                  setMatchingSuggestions([]);
                  // Automatically trigger search after selection
                  setTimeout(() => handleSearch(), 0);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search activities or select an action..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                />
              )}
              sx={{ flexGrow: 1 }}
            />
            <Box className="button-group" sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
              >
                Search
              </Button>
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                onClick={() => setShowFilterDialog(true)}
              >
                Filter
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportOpen}
              >
                Export
              </Button>
            </Box>
          </Box>

          {appliedFilters.length > 0 && (
            <Box className="applied-filters" sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {appliedFilters.map((filter, index) => (
                <Chip
                  key={index}
                  label={filter.value}
                  onDelete={() => handleFilterRemove(filter)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          )}

          {showSuggestions && matchingSuggestions.length > 0 && (
            <Box className="action-suggestions" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Did you mean one of these actions?
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {matchingSuggestions.map((suggestion, index) => (
                  <Chip
                    key={index}
                    label={suggestion.label}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    color="primary"
                    variant="outlined"
                    clickable
                  />
                ))}
              </Box>
            </Box>
          )}

          {error && (
            <Typography color="error" className="error-message" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          <TableContainer 
            component={Paper} 
            className="activity-table"
            sx={{ 
              maxHeight: 600,
              overflow: 'auto',
              '& .MuiTableRow-root:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width="5%"></TableCell>
                  <TableCell width="25%">Action</TableCell>
                  <TableCell width="20%">Time</TableCell>
                  <TableCell width="50%">Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Box sx={{ py: 3 }}>
                        <Typography variant="body1" color="textSecondary">
                          No activities found
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <Tooltip title={ACTION_LABELS[activity.actionType] || activity.actionType}>
                          {getActionIcon(activity.actionType)}
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="primary">
                          {ACTION_LABELS[activity.actionType] || activity.actionType}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {activity.formattedTime}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {activity.details}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, newPage) => setPage(newPage)}
              color="primary"
              size="large"
            />
          </Box>

          {/* Filter Dialog */}
          <Dialog open={showFilterDialog} onClose={() => setShowFilterDialog(false)}>
            <DialogTitle>Filter Activities</DialogTitle>
            <DialogContent sx={{ minWidth: 300 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Action Type</InputLabel>
                <Select
                  value={filters.actionType}
                  onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                >
                  <MenuItem value="">All Actions</MenuItem>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                margin="normal"
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                margin="normal"
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowFilterDialog(false)}>Cancel</Button>
              <Button onClick={handleFilterApply} variant="contained" color="primary">
                Apply Filters
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Export Dialog */}
          <Dialog open={showExportDialog} onClose={handleExportClose}>
            <DialogTitle>Export Activity Logs</DialogTitle>
            <DialogContent sx={{ minWidth: 400 }}>
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Filter Logs for Export
                </Typography>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Action Type</InputLabel>
                  <Select
                    value={exportFilters.actionType}
                    onChange={(e) => setExportFilters({ ...exportFilters, actionType: e.target.value })}
                  >
                    <MenuItem value="">All Actions</MenuItem>
                    {Object.entries(ACTION_LABELS).map(([key, label]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  margin="normal"
                  label="Start Date"
                  type="date"
                  value={exportFilters.startDate}
                  onChange={(e) => setExportFilters({ ...exportFilters, startDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  margin="normal"
                  label="End Date"
                  type="date"
                  value={exportFilters.endDate}
                  onChange={(e) => setExportFilters({ ...exportFilters, endDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleExportClose} disabled={exportLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleExportSubmit} 
                variant="contained" 
                color="primary"
                disabled={exportLoading}
                startIcon={exportLoading ? <CircularProgress size={20} /> : <FileDownloadIcon />}
              >
                {exportLoading ? 'Exporting...' : 'Export as CSV'}
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* Snackbar for notifications */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert 
              onClose={handleSnackbarClose} 
              severity={snackbarSeverity}
              sx={{ width: '100%' }}
            >
              {snackbarMessage}
            </Alert>
          </Snackbar>
        </>
      )}
    </div>
  );
};

ActivityLog.propTypes = {
  userId: PropTypes.string.isRequired
};

export default ActivityLog;
