import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import reviewRoutes from './routes/reviewRoutes.js';

// 1. Load environment variables from .env file
dotenv.config();

// 2. Initialize the Express application
const app = express();

// 3. Connect to MongoDB Atlas
connectDB();

// 3. Define the server port and frontend client URL
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// 4. Security middleware - sets basic HTTP headers for security
app.use(helmet());

// 5. CORS middleware - allows requests from our React frontend
app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// 6. Body parsing middleware - parses incoming JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 7. Health Check API endpoint
// Used by the frontend or monitoring tools to verify the backend and database status
app.get('/api/health', (req, res) => {
  // Map Mongoose readyState numbers to readable text
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbStatus = dbStates[mongoose.connection.readyState] || 'unknown';

  res.status(200).json({
    status: 'ok',
    message: 'ReviewLens Backend API is running smoothly',
    database: {
      status: dbStatus,
      connected: mongoose.connection.readyState === 1
    },
    timestamp: new Date().toISOString()
  });
});

// 8. Main API Routes
app.use('/api/reviews', reviewRoutes);

// 9. Default root route
app.get('/', (req, res) => {
  res.send('Welcome to the ReviewLens API. Access /api/health for server status.');
});

// 9. 404 Route Handler - catches any request to routes that do not exist
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// 10. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

// 11. Start the HTTP server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` ReviewLens Server running on http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});

export default app;
