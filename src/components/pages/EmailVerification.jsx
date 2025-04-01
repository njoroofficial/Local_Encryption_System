import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/emailVerification.css';

export default function EmailVerification() {
  const navigate = useNavigate();
  const [status] = useState('success'); // Changed default to success
  const [message] = useState('Your email has been automatically verified! You can now sign in.');

  useEffect(() => {
    // Automatically redirect to sign in after a short delay
    const timer = setTimeout(() => {
      navigate('/signin');
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  const handleRedirect = () => {
    navigate('/signin');
  };

  return (
    <div className="email-verification-container">
      <div className="email-verification-card">
        <h1 className="email-verification-title">Email Verified</h1>
        
        <div className={`email-verification-status ${status}`}>
          <div className="verification-success-icon">✓</div>
        </div>
        
        <p className="email-verification-message">{message}</p>
        
        <button 
          className="email-verification-button"
          onClick={handleRedirect}
        >
          Go to Sign In
        </button>
      </div>
    </div>
  );
} 