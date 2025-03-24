import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VaultTable from './VaultTable';
import { fetchUserVaults } from '../../../../services/api';
import { useNavigate } from 'react-router-dom';
import "../../../../styles/managevault.css";

export default function VaultManager() {
  const [vaults, setVaults] = useState([]);
  const [filteredVaults, setFilteredVaults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadVaults = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        if (!userData || !userData.userId) {
          navigate('/signin');
          return;
        }

        const response = await fetchUserVaults(userData.userId);
        setVaults(response.vaults || []);
        setFilteredVaults(response.vaults || []);
      } catch (err) {
        setError(err.message || 'Failed to load vaults');
      } finally {
        setLoading(false);
      }
    };

    loadVaults();
  }, [navigate]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredVaults(vaults);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const filtered = vaults.filter((vault) => 
        vault.name?.toLowerCase().includes(lowercasedSearch) || 
        vault.description?.toLowerCase().includes(lowercasedSearch) ||
        vault.location?.toLowerCase().includes(lowercasedSearch)
      );
      setFilteredVaults(filtered);
    }
  }, [searchTerm, vaults]);

  const handleCreateVault = () => {
    navigate('/create-vault');
  };

  const handleVaultDeleted = (deletedVaultId) => {
    setVaults(prevVaults => {
      const updated = prevVaults.filter(vault => vault.id !== deletedVaultId);
      setFilteredVaults(updated);
      return updated;
    });
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  if (loading) return <div>Loading vaults...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="vault-container">
      <header>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
          Vault Manager
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage your secure encrypted folders
        </Typography>
      </header>

      <Box sx={{ mt: 4, mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search vaults by name, description, or location"
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              backgroundColor: '#f9fafb',
            }
          }}
        />
      </Box>

      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2 
      }}>
        <Typography variant="h5">Your Vaults</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateVault}
          sx={{
            backgroundColor: '#1a1a1a',
            '&:hover': {
              backgroundColor: '#333'
            }
          }}
        >
          Create New Vault
        </Button>
      </Box>

      <VaultTable vaults={filteredVaults} onVaultDeleted={handleVaultDeleted} />
    </div>
  );
}
