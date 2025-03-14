import React, { useState } from "react";
import LockIcon from '@mui/icons-material/Lock';
import EmailIcon from '@mui/icons-material/Email';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import "../../styles/signIn.css";
import { useNavigate } from "react-router-dom";
import supabase from "../../lib/helper/supabaseClient";
import PropTypes from 'prop-types';

export default function SignIn({ setUserId }) {
  const navigate = useNavigate();

  // State to manage visibility of the password
  const [showPassword, setShowPassword] = useState(false);

  // State to hold form data for email and password
  const [formData, setFormData] = useState({ email: "", password: "" });

  // State to hold any error messages
  const [error, setError] = useState("");

  // State to manage loading state
  const [isLoading, setIsLoading] = useState(false);

  // State for email verification error
  const [verificationError, setVerificationError] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // function that handle changes in input fields
  function handleInputChange(event) {
    const { name, value } = event.target;
    // Update the formData state with new input values
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  // handle signin function
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setVerificationError(false);
    setIsLoading(true);

    try {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      
      if (error) {
        // Check if it's an email verification error
        if (error.message.includes("Email not confirmed")) {
          setVerificationError(true);
          setUserEmail(formData.email);
        } else {
          setError(error.message || "Invalid email or password");
        }
        return;
      }
      
      if (!data || !data.user) {
        setError("Sign in failed. Please try again.");
        return;
      }
      
      // Create a user data object with Supabase info
      const userData = {
        userId: data.user.id,
        email: data.user.email,
        fullname: data.user.user_metadata?.fullname || data.user.email
      };
      
      // Store user data in localStorage
      localStorage.setItem('userData', JSON.stringify(userData));
      
      // Update the user ID in the parent component
      setUserId(userData.userId);
      
      // Navigate to welcome page
      navigate("/welcome-page");
    } catch (err) {
      setError(err.message || "An error occurred during sign in");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend verification email
  const handleResendVerification = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });
      
      if (error) {
        setError(error.message || "Failed to resend verification email");
      } else {
        alert(`Verification email resent to ${userEmail}. Please check your inbox.`);
      }
    } catch (err) {
      setError(err.message || "Failed to resend verification email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="cardHeader">
          <h2 className="cardTitle">Sign in to your account</h2>
          <p className="cardDescription">
            Enter your email and password to access the encryption system
          </p>
        </div>

        <div className="cardContent">
          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="inputGroup">
              <label htmlFor="email" className="label">
                Email
              </label>
              <div className="inputContainer">
                <EmailIcon className="icon" />

                <input
                  id="email"
                  name="email"
                  placeholder="Enter your email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="inputGroup">
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="inputContainer">
                <LockIcon className="icon" />

                <input
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="input"
                  required
                  autoComplete="new-password"
                />

                {/* Toggle password visibility button */}

                <button
                  type="button"
                  className="toggleButton"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <VisibilityOffIcon className="icon" />
                  ) : (
                    <VisibilityIcon className="icon" />
                  )}
                </button>
              </div>
            </div>

            {/* Display error message if exists */}
            {error && (
              <div className="alert">
                <span className="alertText">{error}</span>
              </div>
            )}

            {verificationError && (
              <div className="verification-error">
                <p>Your email is not verified. Please check your inbox for the verification link.</p>
                <p>If you didn't receive the email, click the button below to resend.</p>
                <button
                  type="button"
                  className="resend-verification"
                  onClick={handleResendVerification}
                >
                  Resend Verification Email
                </button>
              </div>
            )}

            {/*SignIn Button*/}
            <button
              type="submit"
              className="submitButton"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div className="cardFooter">
          <a href="/forgot-password" className="link">
            {" "}
            {/* Link to forgot password page */}
            Forgot your password?
          </a>
          <p className="footerText">
            Don't have an account?{" "}
            <a href="/signup" className="link">
              {" "}
              {/* Link to sign-up page */}
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

SignIn.propTypes = {
  setUserId: PropTypes.func.isRequired
};
