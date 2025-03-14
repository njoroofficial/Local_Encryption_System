import { useState, useEffect } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { fetchUserVaults, changeVaultKey } from "../../../services/api";

export default function VaultKeyManager({ onClose }) {
  const [vaults, setVaults] = useState([]);
  const [selectedVault, setSelectedVault] = useState(null);
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
      loadVaults(parsedUserData.userId);
    }
  }, []);

  const loadVaults = async (userId) => {
    try {
      const response = await fetchUserVaults(userId);
      setVaults(response.vaults);
    } catch (err) {
      setError("Failed to load vaults");
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
      await changeVaultKey(
        selectedVault.id,
        formData.currentKey,
        formData.newKey,
        userData.userId
      );

      setSuccessMessage("Vault key changed successfully");
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
      setError(err.message || "Failed to change vault key");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Manage Vault Keys</h2>
        
        <div className="vaults-list">
          <h3>Your Vaults</h3>
          {vaults.length === 0 ? (
            <p>No vaults found</p>
          ) : (
            <ul className="vault-items">
              {vaults.map((vault) => (
                <li
                  key={vault.id}
                  className={`vault-item ${selectedVault?.id === vault.id ? 'selected' : ''}`}
                  onClick={() => handleVaultSelect(vault)}
                >
                  {vault.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedVault && (
          <form onSubmit={handleSubmit}>
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