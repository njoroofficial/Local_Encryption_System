import { useState, useEffect } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import WarningIcon from "@mui/icons-material/Warning";
import { fetchUserVaults, changeVaultKey } from "../../../services/api";

export default function VaultKeyManager({ onClose }) {
  const [vaults, setVaults] = useState([]);
  const [selectedVault, setSelectedVault] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatedFiles, setUpdatedFiles] = useState([]);
  const [formData, setFormData] = useState({
    currentKey: "",
    newKey: "",
    confirmNewKey: "",
  });

  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      const parsedUserData = JSON.parse(storedUserData);
      setUserData(parsedUserData);
      loadVaults(parsedUserData.userId);
    }
  }, []);

  const loadVaults = async (userId) => {
    setIsLoading(true);
    try {
      const response = await fetchUserVaults(userId);
      setVaults(response.vaults || []);
    } catch (err) {
      setError("Failed to load vaults: " + (err.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVaultSelect = (vault) => {
    setSelectedVault(vault);
    setFormData({
      currentKey: "",
      newKey: "",
      confirmNewKey: "",
    });
    setError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setUpdatedFiles([]);

    if (!selectedVault) {
      setError("Please select a vault");
      return;
    }

    if (!formData.currentKey || !formData.newKey || !formData.confirmNewKey) {
      setError("All fields are required");
      return;
    }

    if (formData.newKey !== formData.confirmNewKey) {
      setError("New keys do not match");
      return;
    }

    if (formData.newKey.length < 8) {
      setError("New key must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      console.log("Changing vault key for vault:", selectedVault.id);
      
      const result = await changeVaultKey(
        selectedVault.id,
        formData.currentKey,
        formData.newKey,
        userData.userId
      );

      console.log("Vault key change response:", result);
      
      // Check if any files were updated with the new vault key
      if (result.filesUpdated > 0 && result.updatedFiles && result.updatedFiles.length > 0) {
        setUpdatedFiles(result.updatedFiles);
        setSuccessMessage(`Vault key for "${selectedVault.name}" changed successfully. ${result.filesUpdated} file(s) were automatically updated with the new key.`);
      } else {
        setSuccessMessage(`Vault key for "${selectedVault.name}" changed successfully`);
      }
      
      setFormData({
        currentKey: "",
        newKey: "",
        confirmNewKey: "",
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err) {
      console.error("Vault key change error:", err);
      
      // Handle specific error messages in a user-friendly way
      const errorMessage = err.message || "Failed to change vault key";
      
      if (errorMessage.includes('incorrect')) {
        setError("The current vault key you entered is incorrect");
      } else if (errorMessage.includes('encryption')) {
        setError("There was a problem with the encryption process. Please try again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2><LockIcon style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Manage Vault Keys</h2>
        
        <div className="key-management-instructions">
          <p>Select a vault to change its encryption key. The current key is required to verify your identity.</p>
          <p className="key-management-warning">
            <WarningIcon style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }} />
            Remember to save your new key in a secure location. Lost keys cannot be recovered!
          </p>
        </div>
        
        <div className="vaults-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <h3>Your Vaults</h3>
          {isLoading && !vaults.length ? (
            <p>Loading vaults...</p>
          ) : vaults.length === 0 ? (
            <p>No vaults found</p>
          ) : (
            <ul className="vault-items">
              {vaults.map((vault) => (
                <li
                  key={vault.id}
                  className={`vault-item ${selectedVault?.id === vault.id ? 'selected' : ''}`}
                  onClick={() => handleVaultSelect(vault)}
                >
                  <div className="vault-item-details">
                    <div>
                      <div className="vault-item-name">{vault.name}</div>
                      <div className="vault-item-info">
                        {vault.filesCount} file{vault.filesCount !== 1 ? 's' : ''} • Last accessed: {formatDate(vault.lastAccessed)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!selectedVault && vaults.length > 0 && (
          <div className="vault-selection-prompt">
            ← Select a vault to manage its encryption key
          </div>
        )}

        {selectedVault && (
          <form onSubmit={handleSubmit}>
            <h3>Change Key for "{selectedVault.name}"</h3>
            
            <div className="input-group">
              <label>Current Vault Key</label>
              <div className="password-input">
                <input
                  type={showKeys ? "text" : "password"}
                  name="currentKey"
                  value={formData.currentKey}
                  onChange={handleInputChange}
                  required
                  autoComplete="new-password"
                  placeholder="Enter current vault key"
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowKeys(!showKeys)}
                >
                  {showKeys ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>New Vault Key</label>
              <div className="password-input">
                <input
                  type={showKeys ? "text" : "password"}
                  name="newKey"
                  value={formData.newKey}
                  onChange={handleInputChange}
                  required
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Confirm New Vault Key</label>
              <div className="password-input">
                <input
                  type={showKeys ? "text" : "password"}
                  name="confirmNewKey"
                  value={formData.confirmNewKey}
                  onChange={handleInputChange}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter new vault key"
                />
              </div>
            </div>

            {error && <p className="error-message">{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}
            
            {updatedFiles.length > 0 && (
              <div className="updated-files-info">
                <p>Updated files:</p>
                <ul className="updated-files-list">
                  {updatedFiles.map((fileName, index) => (
                    <li key={index}>{fileName}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? "Changing Key..." : "Change Key"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 