import React from "react";
import FeatureCard from "../features/FeatureCard";
import { features } from "../../data/featureData";
import "../../styles/main.css";

function WelcomePage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="container">
      <header className="header">
        <h1 className="header-title">Welcome to Your Secure Vault</h1>
        <p className="header-description">
          Your personal encryption and storage management system
        </p>
      </header>
      <main className="features-grid">
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            id={index}
            title={feature.title}
            description={feature.description}
            content={feature.content}
            actionText={feature.actionText}
          />
        ))}
      </main>
      <footer className="footer">
        <p>Local Encryption and Storage System @{currentYear}</p>
      </footer>
    </div>
  );
}

export default WelcomePage;
