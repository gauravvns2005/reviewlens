import { parse } from 'csv-parse/sync';
import Review from '../models/Review.js';
import {
  cleanReviewText,
  validateRating,
  generateReviewHash,
  isEmojiOnly,
  chunkArray,
  retryWithBackoff
} from '../utils/helpers.js';
import { analyzeReviewWithAI } from '../services/aiService.js';

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

/**
 * Batch analyze pending reviews using Gemini AI with Caching and Retries
 * POST /api/reviews/analyze
 */
export async function analyzeReviews(req, res, next) {
  try {
    // 1. Find all pending reviews in MongoDB
    const pendingReviews = await Review.find({ analysisStatus: 'pending' });

    if (!pendingReviews || pendingReviews.length === 0) {
      return res.status(200).json({
        status: 'ok',
        message: 'No pending reviews to analyze.',
        stats: {
          totalPending: 0,
          processed: 0,
          aiCalls: 0,
          cacheHits: 0,
          failedAnalyses: 0,
          ratingMismatches: 0
        }
      });
    }

    // 2. Statistics tracker
    const stats = {
      totalPending: pendingReviews.length,
      processed: 0,
      aiCalls: 0,
      cacheHits: 0,
      failedAnalyses: 0,
      ratingMismatches: 0
    };

    // 3. Split into batches of 5
    const batches = chunkArray(pendingReviews, 5);

    // 4. Process each batch sequentially using simple loops
    for (const batch of batches) {
      // Process the reviews inside this batch
      for (const review of batch) {
        try {
          // STEP A: Cache Lookup using SHA-256 reviewHash
          // Check if an identical review was already analyzed previously
          const cachedReview = await Review.findOne({
            reviewHash: review.reviewHash,
            analysisStatus: 'analyzed',
            _id: { $ne: review._id }
          });

          if (cachedReview) {
            // Cache Hit: Reuse existing analysis without calling Gemini API
            review.sentiment = cachedReview.sentiment;
            review.topics = cachedReview.topics;
            review.summary = cachedReview.summary;
            review.needsReply = cachedReview.needsReply;
            review.analysisStatus = 'analyzed';
            stats.cacheHits++;
          } else {
            // STEP B: Cache Miss - Call Gemini API with Exponential Backoff Retry
            const aiResult = await retryWithBackoff(async () => {
              return await analyzeReviewWithAI(review.reviewText, review.product, review.rating);
            }, 3, 1000);

            stats.aiCalls++;

            if (aiResult.success && aiResult.data) {
              review.sentiment = aiResult.data.sentiment;
              review.topics = aiResult.data.topics;
              review.summary = aiResult.data.summary;
              review.needsReply = aiResult.data.needs_reply;
              review.analysisStatus = 'analyzed';
            } else {
              review.analysisStatus = 'analysis_failed';
              stats.failedAnalyses++;
            }
          }

          // STEP C: Contradiction / Rating Mismatch Detection
          // e.g. 5-star rating with negative text, or 1-star rating with positive praise
          if (review.rating !== null && review.sentiment) {
            if (review.rating >= 4 && review.sentiment === 'negative') {
              review.isRatingMismatch = true;
              stats.ratingMismatches++;
            } else if (review.rating <= 2 && review.sentiment === 'positive') {
              review.isRatingMismatch = true;
              stats.ratingMismatches++;
            } else {
              review.isRatingMismatch = false;
            }
          }

          // Save the analyzed record
          await review.save();
          stats.processed++;
        } catch (itemError) {
          console.error(`Error processing review ${review.reviewId}:`, itemError.message);
          review.analysisStatus = 'analysis_failed';
          await review.save();
          stats.failedAnalyses++;
          stats.processed++;
        }
      }
    }

    return res.status(200).json({
      status: 'ok',
      message: `Analysis complete: ${stats.processed} reviews processed (${stats.cacheHits} cache hits, ${stats.aiCalls} AI calls).`,
      stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get dashboard summary statistics
 * GET /api/reviews/stats
 */
export async function getReviewStats(req, res, next) {
  try {
    const allReviews = await Review.find();

    const totalReviews = allReviews.length;
    const analysedReviews = allReviews.filter(r => r.analysisStatus === 'analyzed');
    const totalAnalysed = analysedReviews.length;

    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let needsReplyCount = 0;
    let ratingMismatchCount = 0;

    for (const r of analysedReviews) {
      if (r.sentiment === 'positive') positiveCount++;
      if (r.sentiment === 'neutral') neutralCount++;
      if (r.sentiment === 'negative') negativeCount++;
      if (r.needsReply === true) needsReplyCount++;
      if (r.isRatingMismatch === true) ratingMismatchCount++;
    }

    // Calculate percentages safely (avoid divide by zero)
    const positivePercentage = totalAnalysed > 0 ? Number(((positiveCount / totalAnalysed) * 100).toFixed(1)) : 0;
    const neutralPercentage = totalAnalysed > 0 ? Number(((neutralCount / totalAnalysed) * 100).toFixed(1)) : 0;
    const negativePercentage = totalAnalysed > 0 ? Number(((negativeCount / totalAnalysed) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      status: 'ok',
      stats: {
        totalReviews,
        totalAnalysed,
        positiveCount,
        positivePercentage,
        neutralCount,
        neutralPercentage,
        negativeCount,
        negativePercentage,
        needsReplyCount,
        ratingMismatchCount
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Top Complaints & Top Praises
 * GET /api/reviews/insights
 */
export async function getReviewInsights(req, res, next) {
  try {
    const analysedReviews = await Review.find({ analysisStatus: 'analyzed' });

    // 1. Count topic frequencies among negative reviews (Top Complaints)
    const complaintCounts = {};
    for (const r of analysedReviews) {
      if (r.sentiment === 'negative' && Array.isArray(r.topics)) {
        for (const topic of r.topics) {
          complaintCounts[topic] = (complaintCounts[topic] || 0) + 1;
        }
      }
    }

    // 2. Count topic frequencies among positive reviews (Top Praises)
    const praiseCounts = {};
    for (const r of analysedReviews) {
      if (r.sentiment === 'positive' && Array.isArray(r.topics)) {
        for (const topic of r.topics) {
          praiseCounts[topic] = (praiseCounts[topic] || 0) + 1;
        }
      }
    }

    // Helper: sort object entries descending and take top 3
    function getTopThree(countsObj) {
      return Object.entries(countsObj)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    }

    const topComplaints = getTopThree(complaintCounts);
    const topPraises = getTopThree(praiseCounts);

    return res.status(200).json({
      status: 'ok',
      topComplaints,
      topPraises
    });
  } catch (error) {
    next(error);
  }
}
