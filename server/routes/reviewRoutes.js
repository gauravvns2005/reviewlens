import express from 'express';
import multer from 'multer';
import {
  uploadReviews,
  getReviews,
  analyzeReviews,
  getReviewStats,
  getReviewInsights
} from '../controllers/reviewController.js';

const router = express.Router();

// Configure Multer storage in memory for efficient processing
const storage = multer.memoryStorage();

// File filter: accept only CSV files
function fileFilter(req, file, cb) {
  const isCsv = file.mimetype === 'text/csv' ||
                file.mimetype === 'application/vnd.ms-excel' ||
                file.originalname.toLowerCase().endsWith('.csv');

  if (isCsv) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV files (.csv) are allowed.'), false);
  }
}

// Multer upload middleware with 5MB limit
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 Megabytes
});

// Route: Upload CSV file
// POST /api/reviews/upload
router.post('/upload', upload.single('file'), uploadReviews);

// Route: Batch analyze pending reviews
// POST /api/reviews/analyze
router.post('/analyze', analyzeReviews);

// Route: Dashboard summary statistics
// GET /api/reviews/stats
router.get('/stats', getReviewStats);

// Route: Top complaints and praises
// GET /api/reviews/insights
router.get('/insights', getReviewInsights);

// Route: Get all reviews (supports ?sentiment=negative etc.)
// GET /api/reviews
router.get('/', getReviews);

export default router;
