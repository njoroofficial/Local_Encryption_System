import { useState, useEffect, useCallback } from "react";
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
  const [fieldTouched, setFieldTouched] = useState({
    first_name: false,
    last_name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  // Password strength evaluation function
  const evaluatePasswordStrength = (password) => {
    if (!password) return '';
    
    // Check various password criteria
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    
    // Calculate a score based on criteria
    let score = 0;
    if (checks.length) score += 1;
    if (checks.lowercase) score += 1;
    if (checks.uppercase) score += 1;
    if (checks.number) score += 1;
    if (checks.special) score += 1;
    
    // Determine strength based on score
    if (score === 0) return '';
    if (score < 3) return 'weak';
    if (score < 5) return 'medium';
    return 'strong';
  };

  // Client-side validation function
  const validateForm = useCallback((data = formData, validateAll = true) => {
    const newErrors = {};
    
    // First name validation
    if (validateAll || fieldTouched.first_name) {
      if (!data.first_name.trim()) {
        newErrors.first_name = "First name is required";
      } else if (data.first_name.trim().length < 2) {
        newErrors.first_name = "First name must be at least 2 characters";
      } else if (data.first_name.trim().length > 50) {
        newErrors.first_name = "First name cannot exceed 50 characters";
      }
    }
    
    // Last name validation
    if (validateAll || fieldTouched.last_name) {
      if (!data.last_name.trim()) {
        newErrors.last_name = "Last name is required";
      } else if (data.last_name.trim().length < 2) {
        newErrors.last_name = "Last name must be at least 2 characters";
      } else if (data.last_name.trim().length > 50) {
        newErrors.last_name = "Last name cannot exceed 50 characters";
      }
    }
    
    // Email validation
    if (validateAll || fieldTouched.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!data.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!emailRegex.test(data.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }
    
    // Password validation
    if (validateAll || fieldTouched.password) {
      if (!data.password) {
        newErrors.password = "Password is required";
      } else if (data.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters long";
      } else if (data.password.length > 50) {
        newErrors.password = "Password cannot exceed 50 characters";
      } else {
        const passwordChecks = {
          lowercase: /[a-z]/.test(data.password),
          uppercase: /[A-Z]/.test(data.password),
          number: /\d/.test(data.password),
          special: /[!@#$%^&*(),.?":{}|<>]/.test(data.password),
        };
        
        const missingRequirements = [];
        if (!passwordChecks.lowercase) missingRequirements.push("lowercase letter");
        if (!passwordChecks.uppercase) missingRequirements.push("uppercase letter");
        if (!passwordChecks.number) missingRequirements.push("number");
        
        if (missingRequirements.length > 0) {
          newErrors.password = `Password must include: ${missingRequirements.join(", ")}`;
        }
      }
    }
    
    // Confirm password validation
    if (validateAll || fieldTouched.confirmPassword) {
      if (!data.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (data.password !== data.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }
    
    if (!validateAll) {
      setErrors(prev => ({ ...prev, ...newErrors }));
    } else {
      setErrors(newErrors);
    }
    
    return Object.keys(newErrors).length === 0;
  }, [formData, fieldTouched]);

  // Validate fields when they lose focus
  const handleBlur = (e) => {
    const { name } = e.target;
    setFieldTouched(prev => ({ ...prev, [name]: true }));
    validateForm({ ...formData }, false);
  };

  // Validate specific field on change
  useEffect(() => {
    // Only validate if the field has been touched
    if (Object.values(fieldTouched).some(touched => touched)) {
      validateForm(formData, false);
    }
  }, [formData, fieldTouched, validateForm]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError("");
    setSuccess("");
    
    // Mark all fields as touched
    const allTouched = Object.keys(fieldTouched).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setFieldTouched(allTouched);
    
    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      // Scroll to the first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        document.getElementById(firstErrorField)?.focus();
      }
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
        } else if (error.response.status === 409) {
          setErrors(prev => ({ ...prev, email: "This email is already registered. Please try a different one or sign in." }));
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
            <div className={`input-wrapper ${errors.first_name && fieldTouched.first_name ? 'error' : fieldTouched.first_name && !errors.first_name ? 'valid' : ''}`}>
              <PersonIcon className="icon" />
              <input
                id="first_name"
                name="first_name"
                type="text"
                placeholder="Enter your first name"
                value={formData.first_name}
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                autoComplete="off"
              />
            </div>
            {errors.first_name && fieldTouched.first_name && <p className="field-error">{errors.first_name}</p>}
          </div>
          <div className="input-group">
            <label htmlFor="last_name">Last Name</label>
            <div className={`input-wrapper ${errors.last_name && fieldTouched.last_name ? 'error' : fieldTouched.last_name && !errors.last_name ? 'valid' : ''}`}>
              <PersonIcon className="icon" />
              <input
                id="last_name"
                name="last_name"
                type="text"
                placeholder="Enter your last name"
                value={formData.last_name}
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                autoComplete="off"
              />
            </div>
            {errors.last_name && fieldTouched.last_name && <p className="field-error">{errors.last_name}</p>}
          </div>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <div className={`input-wrapper ${errors.email && fieldTouched.email ? 'error' : fieldTouched.email && !errors.email ? 'valid' : ''}`}>
              <EmailIcon className="icon" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                autoComplete="off"
              />
            </div>
            {errors.email && fieldTouched.email && <p className="field-error">{errors.email}</p>}
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className={`input-wrapper ${errors.password && fieldTouched.password ? 'error' : fieldTouched.password && !errors.password ? 'valid' : ''}`}>
              <LockIcon className="icon" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                onBlur={handleBlur}
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
            {errors.password && fieldTouched.password && <p className="field-error">{errors.password}</p>}
            {fieldTouched.password && formData.password && !errors.password && formData.password.length >= 1 && (
              <div className="password-requirements">
                <p className="password-strength">
                  Strength: <span className={`strength-indicator ${evaluatePasswordStrength(formData.password)}`}>
                    {evaluatePasswordStrength(formData.password).charAt(0).toUpperCase() + evaluatePasswordStrength(formData.password).slice(1)}
                  </span>
                </p>
                <ul className="requirements-list">
                  <li className={formData.password.length >= 8 ? "met" : "not-met"}>
                    At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(formData.password) ? "met" : "not-met"}>
                    At least one uppercase letter
                  </li>
                  <li className={/[a-z]/.test(formData.password) ? "met" : "not-met"}>
                    At least one lowercase letter
                  </li>
                  <li className={/[0-9]/.test(formData.password) ? "met" : "not-met"}>
                    At least one number
                  </li>
                  <li className={/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? "met" : "not-met"}>
                    At least one special character
                  </li>
                </ul>
              </div>
            )}
          </div>
          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className={`input-wrapper ${errors.confirmPassword && fieldTouched.confirmPassword ? 'error' : fieldTouched.confirmPassword && !errors.confirmPassword ? 'valid' : ''}`}>
              <LockIcon className="icon" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                autoComplete="new-password"
              />
            </div>
            {errors.confirmPassword && fieldTouched.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
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
