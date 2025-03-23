import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./components/pages/LandingPage";
import WelcomePage from "./components/pages/WelcomePage";
import CreateVault from "./components/features/vaults/CreateVault";
import ManageFiles from "./components/features/files/ManageFiles";
import VaultManager from "./components/features/vaults/vaultsManager/VaultManager";
import SignIn from "./components/pages/SignIn"; 
import SignUp from "./components/pages/SignUp"; 
import ActivityLog from "./components/features/activityLogs/ActivityLog";
import SecurityCenter from "./components/features/securityCenter/SecurityCenter";
import EmailVerification from "./components/pages/EmailVerification";
import SystemReport from "./components/features/systemReport/System_Report";

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const getUserIdFromStorage = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsedUserData = JSON.parse(userData);
      if (parsedUserData && parsedUserData.userId) {
        return parsedUserData.userId;
      }
    }
    return null;
  };

  const userId = getUserIdFromStorage();
  
  if (!userId) {
    // Redirect to sign in page if not authenticated
    return <Navigate to="/SignIn" replace />;
  }

  return children;
};

function App() {
  const [currentUserId, setCurrentUserId] = useState(null);

  // Function to get user ID from localStorage
  const getUserIdFromStorage = () => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsedUserData = JSON.parse(userData);
      if (parsedUserData && parsedUserData.userId) {
        return parsedUserData.userId;
      }
    }
    return null;
  };

  useEffect(() => {
    // Set initial user ID
    setCurrentUserId(getUserIdFromStorage());

    // Add event listeners for storage changes
    const handleStorageChange = () => {
      setCurrentUserId(getUserIdFromStorage());
    };

    const handleUserDataChange = () => {
      setCurrentUserId(getUserIdFromStorage());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userDataChange', handleUserDataChange);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataChange', handleUserDataChange);
    };
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/SignIn" element={<SignIn setUserId={setCurrentUserId} />} />
        <Route path="/SignUp" element={<SignUp/>}/>
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="/auth/callback" element={<EmailVerification />} />
        
        {/* Protected routes */}
        <Route path="/welcome-page" element={
          <ProtectedRoute>
            <WelcomePage />
          </ProtectedRoute>
        } />
        <Route path="/create-vault" element={
          <ProtectedRoute>
            <CreateVault />
          </ProtectedRoute>
        } />
        <Route path="/manage-files" element={
          <ProtectedRoute>
            <ManageFiles />
          </ProtectedRoute>
        } />
        <Route path="/vault-manager" element={
          <ProtectedRoute>
            <VaultManager />
          </ProtectedRoute>
        } />
        <Route path="/vault/:vaultId/files" element={
          <ProtectedRoute>
            <ManageFiles />
          </ProtectedRoute>
        } />
        <Route path="/security-center" element={
          <ProtectedRoute>
            <SecurityCenter />
          </ProtectedRoute>
        } />
        <Route path="/activity-log" element={
          <ProtectedRoute>
            <ActivityLog userId={currentUserId} />
          </ProtectedRoute>
        } />
        <Route path="/system-report" element={
          <ProtectedRoute>
            <SystemReport />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
