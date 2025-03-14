import { useState } from "react";
import supabase from "../../lib/helper/supabaseClient";
import { useNavigate } from "react-router-dom";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerificationStep, setIsVerificationStep] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      // Supabase signup
      console.log("this is the formData", formData);
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: 'http://localhost:5001/auth/callback',
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
          },
      
        },
      });

      if (error) {
        console.log("Failed to sign up", error);
        setError(error.message || "Failed to sign up. Please try again.");
      } else if (data) {
        setIsVerificationStep(true);
        setSuccess(`Registration successful! Please check your email (${formData.email}) to verify your account.`);
      }
    } catch (err) {
      setError(err.message || "Failed to sign up. Please try again.");
      console.log("Failed to sign up", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    navigate("/signin");
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
        <form onSubmit={handleSubmit} className="signup-form" autoComplete="off">
          <div className="input-group">
            <label htmlFor="username">First Name</label>
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
          </div>
          {error && <p className="error-message">{error}</p>}
          <button 
            className="signup-button" 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        <p className="signin-text">
          Already have an account? <a href="/signin" className="signin-link">Sign in</a>
        </p>
      </div>
    </div>
  );
}
