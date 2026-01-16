import app from './app.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/init.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Initialize database before starting server
await initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
