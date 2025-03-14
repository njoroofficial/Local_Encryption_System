import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VaultTable from './VaultTable';
import { fetchUserVaults } from '../../../../services/api';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  LinearProgress,
} from "@mui/material";
import "../../../../styles/managevault.css";

export default function VaultManager() {
  const [vaults, setVaults] = useState([]);
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
      } catch (err) {
        setError(err.message || 'Failed to load vaults');
      } finally {
        setLoading(false);
      }
    };

    loadVaults();
  }, [navigate]);

  const handleCreateVault = () => {
    navigate('/create-vault');
  };

  const handleVaultDeleted = (deletedVaultId) => {
    setVaults(prevVaults => prevVaults.filter(vault => vault.id !== deletedVaultId));
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

      <Card sx={{ mt: 4, mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Storage Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your vault storage usage
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              5.4 GB of 10 GB used
            </Typography>
            <Typography variant="body2" color="text.secondary">
              54% used
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={54} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              backgroundColor: '#f3f4f6',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#000'
              }
            }} 
          />
        </CardContent>
      </Card>

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

      <VaultTable vaults={vaults} onVaultDeleted={handleVaultDeleted} />
    </div>
  );
}
