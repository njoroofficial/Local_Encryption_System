import { useState, useEffect } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { fetchUserFiles, changeFileKey } from "../../../services/api";

export default function FileKeyManager({ onClose }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
      loadFiles(parsedUserData.userId);
    }
  }, []);

  const loadFiles = async (userId) => {
    try {
      const response = await fetchUserFiles(userId);
      setFiles(response.files);
    } catch (err) {
      setError("Failed to load files");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      await changeFileKey(
        selectedFile.fileId,
        formData.currentKey,
        formData.newKey,
        userData.userId
      );

      // Reload files to get updated encryption types
      await loadFiles(userData.userId);
      
      setSuccessMessage("File encryption key changed successfully");
      setFormData({
        currentKey: "",
        newKey: "",
        confirmNewKey: "",
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to change file encryption key");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Manage File Encryption Keys</h2>
        
        {!selectedFile ? (
          <div className="files-list">
            <h3>Your Files</h3>
            {files.length === 0 ? (
              <div className="info-message">
                <p>No files found in your vaults.</p>
                <p>Upload files to your vaults to manage their encryption keys.</p>
              </div>
            ) : (
              <ul className="file-items">
                {files.map((file) => (
                  <li
                    key={file.fileId}
                    className="file-item"
                    onClick={() => handleFileSelect(file)}
                  >
                    <div>
                      <span className="file-name">{file.fileName}</span>
                      <span className="file-info">
                        Created: {new Date(file.createdAt).toLocaleDateString()}
                        <br />
                        Encryption: {file.encryptionType === 'vault' ? 'Using Vault Key' : 'Custom Key'}
                      </span>
                    </div>
                    <div className="file-vault">
                      Vault: {file.vaultName}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="selected-file-info">
              <button 
                type="button" 
                className="back-button"
                onClick={() => {
                  setSelectedFile(null);
                  setFormData({
                    currentKey: "",
                    newKey: "",
                    confirmNewKey: "",
                  });
                  setError("");
                  setSuccessMessage("");
                }}
              >
                ← Back to Files
              </button>
              <div className="file-details">
                <h3>{selectedFile.fileName}</h3>
                <p className="file-meta">
                  Vault: {selectedFile.vaultName}
                  <br />
                  Current Encryption: {selectedFile.encryptionType === 'vault' ? 'Using Vault Key' : 'Custom Key'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>
                  Current {selectedFile.encryptionType === 'vault' ? 'Vault' : 'Encryption'} Key
                </label>
                <div className="password-input">
                  <input
                    type={showKeys ? "text" : "password"}
                    name="currentKey"
                    value={formData.currentKey}
                    onChange={handleInputChange}
                    required
                    autoComplete="new-password"
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
                <label>New Custom Encryption Key</label>
                <div className="password-input">
                  <input
                    type={showKeys ? "text" : "password"}
                    name="newKey"
                    value={formData.newKey}
                    onChange={handleInputChange}
                    required
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
          </>
        )}
      </div>
    </div>
  );
} 