import pg from "pg";
import 'dotenv/config';

// Create a client with database connection parameters
const createDbClient = () => {
  
  return new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: String(process.env.DB_PASSWORD), 
    port: process.env.DB_PORT,
  });
};

// Create the client
const db = createDbClient();

// Export connect function to be called after all modules are loaded
export const connectDB = async () => {
  try {
    await db.connect();
    console.log('Connected to PostgreSQL database');
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
};

export default db;