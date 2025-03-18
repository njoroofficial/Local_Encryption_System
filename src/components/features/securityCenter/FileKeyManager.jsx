import { useState, useEffect } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import WarningIcon from "@mui/icons-material/Warning";
import KeyIcon from "@mui/icons-material/Key";
import { fetchUserVaults, fetchFiles, changeFileKey } from "../../../services/api";

export default function FileKeyManager({ onClose }) {
  const [vaults, setVaults] = useState([]);
  const [selectedVault, setSelectedVault] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    currentKey: "",
    newKey: "",
    confirmNewKey: "",
  });

  const [userData, setUserData] = useState(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState(null);

  useEffect(() => {
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      const parsedUserData = JSON.parse(storedUserData);
      setUserData(parsedUserData);
      loadVaults(parsedUserData.userId);
    }
  }, []);

  useEffect(() => {
    if (recentlyUpdated) {
      const timer = setTimeout(() => {
        setRecentlyUpdated(null);
      }, 2000); // Match the animation duration
      
      return () => clearTimeout(timer);
    }
  }, [recentlyUpdated]);

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

  const loadFiles = async (vaultId) => {
    setIsLoadingFiles(true);
    setFiles([]);
    try {
      const response = await fetchFiles(vaultId);
      setFiles(response.files || []);
    } catch (err) {
      setError("Failed to load files: " + (err.message || "Unknown error"));
    } finally {
      setIsLoadingFiles(false);
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
    setSelectedFile(null);
    loadFiles(vault.id);
    setFormData({
      currentKey: "",
      newKey: "",
      confirmNewKey: "",
    });
    setError("");
    setSuccessMessage("");
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setFormData({
      currentKey: "",
      newKey: "",
      confirmNewKey: "",
    });
    setError("");
    setSuccessMessage("");
  };

  const getEncryptionTypeMessage = (file) => {
    if (!file) return null;
    
    if (file.encryption_type === 'vault') {
      return (
        <div className="vault-key-info">
          <p><strong>File uses vault encryption</strong></p>
          <p>This file is currently encrypted with the vault key. Changing to a custom key will make it use a separate encryption key.</p>
        </div>
      );
    } else {
      return (
        <div className="custom-key-info">
          <p><strong>File uses custom encryption</strong></p>
          <p>This file has its own encryption key, separate from the vault key.</p>
        </div>
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!selectedFile) {
      setError("Please select a file");
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
      console.log("Changing encryption key for file:", selectedFile.fileId);
      
      const result = await changeFileKey(
        selectedFile.fileId,
        formData.currentKey,
        formData.newKey
      );

      console.log("File key change response:", result);
      
      // Update the file in the list to reflect the new encryption type
      const updatedFiles = files.map(file => {
        if (file.fileId === selectedFile.fileId) {
          return {
            ...file,
            encryption_type: result.file.encryptionType
          };
        }
        return file;
      });
      setFiles(updatedFiles);
      
      // Update the selected file too
      setSelectedFile({
        ...selectedFile,
        encryption_type: result.file.encryptionType
      });
      
      // Mark this file as recently updated for animation
      setRecentlyUpdated({...selectedFile, fileId: selectedFile.fileId});
      
      if (selectedFile.encryption_type === 'vault' && result.file.encryptionType === 'custom') {
        setSuccessMessage(`File encryption changed from vault key to custom key successfully. The file is now using its own encryption key.`);
      } else {
        setSuccessMessage(`Encryption key for "${selectedFile.fileName}" changed successfully.`);
      }
      
      setFormData({
        currentKey: "",
        newKey: "",
        confirmNewKey: "",
      });

      // Reload the files list after a short delay to reflect changes
      setTimeout(() => {
        if (selectedVault) {
          loadFiles(selectedVault.id);
        }
      }, 2000);
    } catch (err) {
      console.error("File key change error:", err);
      
      // Handle specific error messages in a user-friendly way
      const errorMessage = err.message || "Failed to change file encryption key";
      
      if (errorMessage.includes('incorrect')) {
        setError("The current encryption key you entered is incorrect");
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
  
  const getFileIcon = (fileType) => {
    // You could implement more detailed file type icons here
    return <KeyIcon style={{ marginRight: '4px', fontSize: '16px' }} />;
  };

  const refreshFiles = async () => {
    if (selectedVault) {
      setIsLoadingFiles(true);
      try {
        const response = await fetchFiles(selectedVault.id);
        setFiles(response.files || []);
        
        // Maintain selection after refresh if the file still exists
        if (selectedFile) {
          const updatedSelectedFile = response.files?.find(f => f.fileId === selectedFile.fileId);
          if (updatedSelectedFile) {
            setSelectedFile(updatedSelectedFile);
          }
        }
      } catch (err) {
        console.error("Error refreshing files:", err);
      } finally {
        setIsLoadingFiles(false);
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2><LockIcon style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Manage File Encryption Keys</h2>
        
        <div className="key-management-instructions">
          <p>Select a vault and file to change its encryption key. The current key is required to verify your identity.</p>
          <p className="key-management-warning">
            <WarningIcon style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }} />
            Remember to save your new key in a secure location. Lost keys cannot be recovered!
          </p>
        </div>
        
        <div className="vaults-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
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

        {selectedVault && (
          <div className="files-list" style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '20px' }}>
            <h3>Files in {selectedVault.name}</h3>
            {isLoadingFiles ? (
              <p>Loading files...</p>
            ) : files.length === 0 ? (
              <p>No files found in this vault</p>
            ) : (
              <ul className="file-items">
                {files.map((file) => (
                  <li
                    key={file.fileId}
                    className={`file-item ${selectedFile?.fileId === file.fileId ? 'selected' : ''} ${recentlyUpdated?.fileId === file.fileId ? 'updated' : ''}`}
                    onClick={() => handleFileSelect(file)}
                  >
                    <div className="file-item-details">
                      <div>
                        <div className="file-item-name">
                          {getFileIcon(file.fileType)} {file.fileName}
                        </div>
                        <div className="file-item-info">
                          Type: {file.fileType.toUpperCase()} • Size: {Math.round(file.fileSize / 1024)} KB
                          {file.encryption_type && (
                            <span className={`encryption-badge ${file.encryption_type === 'vault' ? 'vault' : 'custom'}`}>
                              • {file.encryption_type === 'vault' ? 'Vault Key' : 'Custom Key'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!selectedVault && vaults.length > 0 && (
          <div className="vault-selection-prompt">
            ← Select a vault to manage its files' encryption keys
          </div>
        )}

        {selectedVault && !selectedFile && files.length > 0 && (
          <div className="file-selection-prompt">
            ← Select a file to manage its encryption key
          </div>
        )}

        {selectedFile && (
          <form onSubmit={handleSubmit}>
            <h3>Change Key for "{selectedFile.fileName}"</h3>
            
            {getEncryptionTypeMessage(selectedFile)}
            
            <div className="input-group">
              <label>Current {selectedFile.encryption_type === 'vault' ? 'Vault' : 'Encryption'} Key</label>
              <div className="password-input">
                <input
                  type={showKeys ? "text" : "password"}
                  name="currentKey"
                  value={formData.currentKey}
                  onChange={handleInputChange}
                  required
                  autoComplete="new-password"
                  placeholder="Enter current encryption key"
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
              <label>New Encryption Key</label>
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
              <label>Confirm New Encryption Key</label>
              <div className="password-input">
                <input
                  type={showKeys ? "text" : "password"}
                  name="confirmNewKey"
                  value={formData.confirmNewKey}
                  onChange={handleInputChange}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter new encryption key"
                />
              </div>
            </div>

            {error && <p className="error-message">{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}

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