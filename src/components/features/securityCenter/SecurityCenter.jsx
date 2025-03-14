import { useState, useEffect } from "react";
import LockIcon from "@mui/icons-material/Lock";
import DevicesIcon from "@mui/icons-material/Devices";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import "../../../styles/securityCenter.css";
import { changePassword } from "../../../services/api";
import VaultKeyManager from "./VaultKeyManager";
import FileKeyManager from './FileKeyManager';

export default function SecurityCenter() {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showVaultKeyManager, setShowVaultKeyManager] = useState(false);
  const [showFileKeyManager, setShowFileKeyManager] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lastPasswordChange, setLastPasswordChange] = useState("");
  const [lastLogin, setLastLogin] = useState("");
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      const parsedUserData = JSON.parse(storedUserData);
      setUserData(parsedUserData);
      // Set password change and last login dates
      if (parsedUserData.passwordChangeDate) {
        setLastPasswordChange(parsedUserData.passwordChangeDate);
      }
      if (parsedUserData.lastLogin) {
        setLastLogin(parsedUserData.lastLogin);
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!userData?.email || !userData?.userId) {
      setError("User not found. Please sign in again.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (formData.newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const result = await changePassword(
        userData.email,
        formData.currentPassword,
        formData.newPassword,
        userData.userId
      );

      setSuccessMessage(result.message);
      setLastPasswordChange(result.passwordChangeDate);
      
      // Update the user data in localStorage with the new password change date
      const updatedUserData = {
        ...userData,
        passwordChangeDate: result.passwordChangeDate
      };
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      
      // Reset form
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Close dialog after a short delay
      setTimeout(() => {
        setShowPasswordDialog(false);
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="security-container">
      <div className="security-card">
        <h2 className="security-title">Security Center</h2>
        <p className="security-description">Monitor and enhance your account security</p>

        <div className="security-alert">
          <LockIcon className="icon" />
          <div>
            <h4>Security Status</h4>
            <p>Your account security is good. Last login: {formatDate(lastLogin)}</p>
          </div>
        </div>

        <div className="security-activity">
          <h3>Recent Activity</h3>
          <ul>
            <li>Password changed ({formatDate(lastPasswordChange)})</li>
            <li>Successful login ({formatDate(lastLogin)})</li>
          </ul>
        </div>

        <div className="security-actions">
          <button className="security-button" onClick={() => setShowPasswordDialog(true)}>
            <DevicesIcon className="icon" /> Manage Password
          </button>
          <button className="security-button" onClick={() => setShowVaultKeyManager(true)}>
            <DevicesIcon className="icon" /> Manage Vault Keys
          </button>
          <button className="security-button" onClick={() => setShowFileKeyManager(true)}>
            <DevicesIcon className="icon" /> Manage File Keys
          </button>
        </div>
      </div>

      {showPasswordDialog && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Change Password</h2>
            <form onSubmit={handlePasswordChange}>
              <div className="input-group">
                <label>Current Password</label>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>New Password</label>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Confirm New Password</label>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
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
                  onClick={() => setShowPasswordDialog(false)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-button"
                  disabled={isLoading}
                >
                  {isLoading ? "Changing Password..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVaultKeyManager && (
        <VaultKeyManager onClose={() => setShowVaultKeyManager(false)} />
      )}

      {showFileKeyManager && (
        <FileKeyManager
          onClose={() => setShowFileKeyManager(false)}
        />
      )}
    </div>
  );
}
