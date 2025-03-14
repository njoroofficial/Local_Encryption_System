import express from "express"
import cors from "cors";
import apiRoutes from "./routes/api.js"
import 'dotenv/config';
import { connectDB } from './database.js';

// Validate environment config
const validateConfig = () => {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => {
    const value = process.env[varName];
    return value === undefined || value === null || value === '';
  });
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    return false;
  }
  
  console.log('All required environment variables are set');
  return true;
};

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Start server
const startServer = async () => {
  try {
    // Validate config first
    if (!validateConfig()) {
      throw new Error('Invalid configuration. Please check your environment variables.');
    }
    
    // Connect to database
    await connectDB();
    
    // Then start the server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Run the server
startServer(); 