import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas (or local MongoDB fallback)
 * Uses simple async/await and try/catch for beginner-friendly error handling.
 */
async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.warn('[ReviewLens DB Warning] MONGODB_URI environment variable is not set.');
    console.warn('[ReviewLens DB Warning] Please set MONGODB_URI in server/.env file.');
    return false;
  }

  try {
    // Attempt connection with standard Mongoose options
    const connection = await mongoose.connect(mongoURI);
    
    console.log(`===============================================`);
    console.log(` MongoDB Connected Successfully!`);
    console.log(` Host: ${connection.connection.host}`);
    console.log(` Database: ${connection.connection.name}`);
    console.log(`===============================================`);
    return true;
  } catch (error) {
    console.error(`[ReviewLens DB Error] Connection failed: ${error.message}`);
    // We log the error without killing the process so health endpoint can still report DB status
    return false;
  }
}

export default connectDB;
