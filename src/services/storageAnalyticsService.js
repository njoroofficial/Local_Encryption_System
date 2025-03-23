import { fetchUserVaults, fetchFiles } from './api';

/**
 * Get the distribution of files across user vaults
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} - Promise resolving to formatted storage distribution data
 */
export const getStorageDistribution = async (userId) => {
  try {
    // Fetch all vaults for the user
    const vaultResponse = await fetchUserVaults(userId);
    
    if (!vaultResponse || !vaultResponse.vaults || !Array.isArray(vaultResponse.vaults)) {
      return [];
    }
    
    const vaults = vaultResponse.vaults;
    
    // For each vault, fetch files to get counts
    const vaultDataPromises = vaults.map(async (vault) => {
      try {
        const filesResponse = await fetchFiles(vault.id);
        const fileCount = (filesResponse && filesResponse.files) ? filesResponse.files.length : 0;
        
        return {
          id: vault.id,
          name: vault.name,
          fileCount: fileCount,
          // Additional metadata
          createdAt: vault.created_at,
          lastAccessed: vault.last_accessed,
          encryptionType: vault.encryption_type
        };
      } catch (error) {
        console.error(`Error fetching files for vault ${vault.id}:`, error);
        return {
          id: vault.id,
          name: vault.name,
          fileCount: 0,
          createdAt: vault.created_at,
          lastAccessed: vault.last_accessed,
          encryptionType: vault.encryption_type
        };
      }
    });
    
    const vaultsWithFileCount = await Promise.all(vaultDataPromises);
    
    // Format data for pie chart
    return formatStorageData(vaultsWithFileCount);
  } catch (error) {
    console.error('Error getting storage distribution:', error);
    throw new Error('Failed to retrieve storage distribution');
  }
};

/**
 * Format vault data for visualization
 * @param {Array} vaultsData - Array of vault objects with file counts
 * @returns {Array} - Formatted data for charts
 */
export const formatStorageData = (vaultsData) => {
  if (!vaultsData || !Array.isArray(vaultsData) || vaultsData.length === 0) {
    return [];
  }
  
  // Sort by file count (descending)
  return vaultsData
    .filter(vault => vault.name) // Filter out any vaults with no name
    .map(vault => ({
      name: vault.name,
      value: vault.fileCount,
      id: vault.id,
      createdAt: vault.createdAt,
      lastAccessed: vault.lastAccessed,
      encryptionType: vault.encryptionType
    }));
};

/**
 * Generate insights based on storage data
 * @param {Array} storageData - Formatted storage data
 * @returns {Array} - Array of insight objects
 */
export const generateStorageInsights = (storageData) => {
  if (!storageData || !Array.isArray(storageData) || storageData.length === 0) {
    return [
      {
        type: 'info',
        heading: 'No vaults found',
        text: 'Create your first vault to get started'
      }
    ];
  }
  
  const insights = [];
  const totalFiles = storageData.reduce((sum, vault) => sum + vault.value, 0);
  
  // Sort vaults by file count (descending)
  const sortedVaults = [...storageData].sort((a, b) => b.value - a.value);
  
  // Insight 1: Vault with most files
  if (sortedVaults.length > 0 && sortedVaults[0].value > 0) {
    const topVault = sortedVaults[0];
    const percentage = totalFiles > 0 
      ? Math.round((topVault.value / totalFiles) * 100) 
      : 0;
    
    insights.push({
      type: topVault.value > 50 ? 'warning' : 'success',
      heading: `${topVault.name} vault contains the most files (${percentage}%)`,
      text: topVault.value > 50 
        ? 'Consider distributing files across multiple vaults for better organization' 
        : 'Good distribution of files across vaults'
    });
  }
  
  // Insight 2: Empty vaults
  const emptyVaults = storageData.filter(vault => vault.value === 0);
  if (emptyVaults.length > 0) {
    insights.push({
      type: 'warning',
      heading: `${emptyVaults.length} empty vault${emptyVaults.length > 1 ? 's' : ''}`,
      text: 'Consider adding files or removing unused vaults'
    });
  }
  
  // Insight 3: Overall vault usage
  insights.push({
    type: 'info',
    heading: `Total of ${totalFiles} file${totalFiles !== 1 ? 's' : ''} across ${storageData.length} vault${storageData.length !== 1 ? 's' : ''}`,
    text: totalFiles > 100 
      ? 'Consider organizing files into more specific vaults for easier management' 
      : 'Keep adding files to your vaults for secure storage'
  });
  
  return insights;
}; 