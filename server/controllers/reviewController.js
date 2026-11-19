import { parse } from 'csv-parse/sync';
import Review from '../models/Review.js';
import {
  cleanReviewText,
  validateRating,
  generateReviewHash,
  isEmojiOnly
} from '../utils/helpers.js';

/**
 * Upload and process CSV reviews
 * POST /api/reviews/upload
 */
export async function uploadReviews(req, res, next) {
  try {
    // 1. Verify a file was actually uploaded
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded. Please upload a valid .csv file.'
      });
    }

    // 2. Parse the CSV file from memory buffer
    const fileContent = req.file.buffer.toString('utf-8');
    let records = [];

    try {
      records = parse(fileContent, {
        columns: true, // Auto-map first row as object keys
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });
    } catch (parseError) {
      return res.status(400).json({
        status: 'error',
        message: `Failed to parse CSV file: ${parseError.message}`
      });
    }

    if (!records || records.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'The uploaded CSV file is empty.'
      });
    }

    // 3. Keep track of processing statistics
    const stats = {
      totalRows: records.length,
      saved: 0,
      skippedDuplicates: 0,
      insufficientContent: 0
    };

    const savedReviews = [];
    const seenHashesInBatch = new Set();

    // 4. Process each row using a clear, beginner-friendly loop
    for (const row of records) {
      // Normalize column names (support review_id or reviewId, review_text or reviewText)
      const rawId = row.review_id || row.reviewId || '';
      const rawProduct = row.product || 'Unknown Product';
      const rawRating = row.rating;
      const rawDate = row.date || new Date().toISOString().split('T')[0];
      const rawText = row.review_text || row.reviewText || '';

      const reviewId = rawId.trim();
      const product = rawProduct.trim();
      const cleanedText = cleanReviewText(rawText);
      const rating = validateRating(rawRating);
      const reviewHash = generateReviewHash(cleanedText);

      // Edge case 1: Missing review ID
      if (!reviewId) {
        continue;
      }

      // Edge case 2: Duplicate review in the same CSV upload
      if (seenHashesInBatch.has(reviewHash) && cleanedText.length > 0) {
        stats.skippedDuplicates++;
        continue;
      }
      if (cleanedText.length > 0) {
        seenHashesInBatch.add(reviewHash);
      }

      // Edge case 3: Empty review text
      let analysisStatus = 'pending';
      if (cleanedText.length === 0) {
        analysisStatus = 'insufficient_content';
        stats.insufficientContent++;
      } else if (isEmojiOnly(cleanedText)) {
        // Edge case 4: Emoji-only review text (e.g., R009)
        analysisStatus = 'insufficient_content';
        stats.insufficientContent++;
      }

      // Check if this reviewId already exists in database to prevent duplicates
      const existingReview = await Review.findOne({ reviewId: reviewId });

      if (existingReview) {
        // Update existing record with cleaned CSV data without overwriting already analyzed fields
        existingReview.product = product;
        existingReview.rating = rating;
        existingReview.date = rawDate;
        existingReview.reviewText = cleanedText;
        existingReview.reviewHash = reviewHash;
        if (existingReview.analysisStatus !== 'analyzed') {
          existingReview.analysisStatus = analysisStatus;
        }
        await existingReview.save();
        savedReviews.push(existingReview);
        stats.saved++;
      } else {
        // Create a new review document
        const newReview = await Review.create({
          reviewId,
          product,
          rating,
          date: rawDate,
          reviewText: cleanedText,
          analysisStatus,
          reviewHash,
          sentiment: null,
          topics: [],
          summary: '',
          needsReply: false,
          isRatingMismatch: false
        });

        savedReviews.push(newReview);
        stats.saved++;
      }
    }

    // 5. Return success response with stats
    return res.status(200).json({
      status: 'ok',
      message: `Successfully processed ${stats.totalRows} CSV records.`,
      stats,
      reviews: savedReviews
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch all reviews from MongoDB
 * GET /api/reviews
 */
export async function getReviews(req, res, next) {
  try {
    const { sentiment, product, needsReply } = req.query;

    // Build filter query object conditionally
    const filter = {};

    if (sentiment) {
      filter.sentiment = sentiment;
    }

    if (product) {
      filter.product = product;
    }

    if (needsReply !== undefined) {
      filter.needsReply = needsReply === 'true';
    }

    // Retrieve reviews sorted by reviewId or date
    const reviews = await Review.find(filter).sort({ reviewId: 1 });

    return res.status(200).json({
      status: 'ok',
      count: reviews.length,
      reviews
    });
  } catch (error) {
    next(error);
  }
}
