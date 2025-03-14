import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import supabase from '../../lib/helper/supabaseClient';
import '../../styles/emailVerification.css';

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verifyUserEmail = async () => {
      try {
        // Check if this is a Supabase auth callback
        if (location.pathname === '/auth/callback') {
                 
        // Standard token verification 
        const token = searchParams.get('token_hash');
        
        if (!token) {
          setStatus('error');
          setMessage('Verification token is missing. Please check your email link.');
          return;
        }

        // For Supabase, we need to verify using their API
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email',
        });

        if (error) {
          console.error('Supabase verification error:', error);
          setStatus('error');
          setMessage(error.message || 'Email verification failed. Please try again.');
          return;
        }

        setStatus('success');
        setMessage('Your email has been successfully verified! You can now sign in.');
        console.log('Email verified successfully');
    }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Email verification failed. Please try again.');
      }
    };

    verifyUserEmail();
  }, [searchParams, location.pathname]);

  const handleRedirect = () => {
    navigate('/signin');
  };

  return (
    <div className="email-verification-container">
      <div className="email-verification-card">
        <h1 className="email-verification-title">
          {status === 'verifying' ? 'Verifying Email' : 
           status === 'success' ? 'Email Verified' : 'Verification Failed'}
        </h1>
        
        <div className={`email-verification-status ${status}`}>
          {status === 'verifying' && (
            <div className="verification-loader"></div>
          )}
          
          {status === 'success' && (
            <div className="verification-success-icon">✓</div>
          )}
          
          {status === 'error' && (
            <div className="verification-error-icon">✗</div>
          )}
        </div>
        
        <p className="email-verification-message">{message}</p>
        
        {(status === 'success' || status === 'error') && (
          <button 
            className="email-verification-button"
            onClick={handleRedirect}
          >
            Go to Sign In
          </button>
        )}
      </div>
    </div>
  );
} 