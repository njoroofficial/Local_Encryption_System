import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { signUp } from "../../services/api";
import "../../styles/sign_up.css";

export default function SignUp() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerificationStep, setIsVerificationStep] = useState(false);

  // Client-side validation function
  const validateForm = () => {
    const newErrors = {};
    
    // First name validation
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    
    // Last name validation
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = "Password must contain at least one letter and one number";
    }
    
    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError("");
    setSuccess("");
    
    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      return;
    }
    
    setIsLoading(true);

    try {
      // Use the API service for signup instead of direct fetch
      const userData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
      };
      
      // eslint-disable-next-line no-unused-vars
      const data = await signUp(userData);
      
      // Success case
      setIsVerificationStep(true);
      setSuccess(`Registration successful! Please check your email (${formData.email}) to verify your account.`);
    } catch (error) {
      console.error("Error during signup:", error);
      
      // Handle validation errors
      if (error.response && error.response.data) {
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          const backendErrors = {};
          error.response.data.errors.forEach(err => {
            backendErrors[err.param] = err.msg;
          });
          setErrors(backendErrors);
        } else {
          setGeneralError(error.response.data.error || "Registration failed. Please try again.");
        }
      } else {
        setGeneralError(error.message || "Connection error. Please check your internet connection and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    navigate("/SignIn");
  };

  // If we're showing verification instructions
  if (isVerificationStep) {
    return (
      <div className="signup-container">
        <div className="signup-card">
          <h2 className="signup-title">Verify Your Email</h2>
          <div className="verification-message">
            <p>{success}</p>
            <div className="verification-instructions">
              <h3>Next steps:</h3>
              <ol>
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the verification link in the email</li>
                <li>Once verified, you can sign in to your account</li>
              </ol>
            </div>
          </div>
          <button 
            className="signup-button" 
            onClick={handleBackToSignIn}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Regular signup form
  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2 className="signup-title">Create an account</h2>
        <p className="signup-description">Enter your details to get started</p>
        {generalError && <p className="error-message general-error">{generalError}</p>}
        <form onSubmit={handleSubmit} className="signup-form" autoComplete="off">
          <div className="input-group">
            <label htmlFor="first_name">First Name</label>
            <div className="input-wrapper">
              <PersonIcon className="icon" />
              <input
                id="first_name"
                name="first_name"
                type="text"
                placeholder="Enter your first name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
            </div>
            {errors.first_name && <p className="field-error">{errors.first_name}</p>}
          </div>
          <div className="input-group">
            <label htmlFor="last_name">Last Name</label>
            <div className="input-wrapper">
              <PersonIcon className="icon" />
              <input
                id="last_name"
                name="last_name"
                type="text"
                placeholder="Enter your last name"
                value={formData.last_name}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
            </div>
            {errors.last_name && <p className="field-error">{errors.last_name}</p>}
          </div>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <EmailIcon className="icon" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                required
                autoComplete="off"
              />
            </div>
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <LockIcon className="icon" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </button>
            </div>
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-wrapper">
              <LockIcon className="icon" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                autoComplete="new-password"
              />
            </div>
            {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
          </div>
          <button 
            className="signup-button" 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        <p className="signin-text">
          Already have an account? <a href="/SignIn" className="signin-link">Sign in</a>
        </p>
      </div>
    </div>
  );
}
