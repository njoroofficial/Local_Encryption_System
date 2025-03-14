import React, { useState, useEffect } from "react";
import { createVault } from "../../../services/api";
import InfoIcon from '@mui/icons-material/Info';
import { useNavigate } from "react-router-dom";

function CreateVaultForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    vault_name: "",
    vault_key: "",
    user_id: "" 
  });
  

  const navigate = useNavigate();

  useEffect(() => {
    // Get user data from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      setError("Please login first");
      navigate('/signin');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      user_id: userData.userId
    }));
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.user_id) {
      setError("User not authenticated");
      navigate('/signin');
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await createVault(formData);
      alert("Vault created successfully!");
      navigate('/vault-manager');
    } catch (err) {
      setError(err.message || "Failed to create vault");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-vault-form">
      <div className="form-group">
        <label htmlFor="vault_name">Vault Name</label>
        <input
          type="text"
          id="vault_name"
          name="vault_name"
          value={formData.vault_name}
          onChange={handleInputChange}
          placeholder="Enter a name for your vault"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="vault_key">Encryption Key</label>
        <input
          type="password"
          id="vault_key"
          name="vault_key"
          value={formData.vault_key}
          onChange={handleInputChange}
          placeholder="Enter a strong encryption key"
          required
          autoComplete="new-password"
        />
      </div>

      <div className="info-box">
        <InfoIcon className="info-icon" />
        <div className="info-text">
          <strong>Important</strong>
          <p>
            Your encryption key is used to secure your vault.
            Make sure to remember it, as it cannot be recovered if lost.
          </p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        type="submit"
        className="create-vault-button"
        disabled={isLoading}
      >
        {isLoading ? "Creating..." : "Create Vault"}
      </button>
    </form>
  );
}

export default CreateVaultForm;