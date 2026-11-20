import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import {
  cleanReviewText,
  validateRating,
  generateReviewHash,
  isEmojiOnly,
  chunkArray,
  retryWithBackoff
} from '../utils/helpers.js';
import { analyzeReviewWithAI, generateSupportReply } from '../services/aiService.js';

// In-memory fallback array when MongoDB is not connected (e.g. offline demo or test)
let memoryStore = [];

/**
 * Helper: Find reviews matching query from MongoDB or in-memory fallback
 */
async function getStoredReviews(filter = {}) {
  if (mongoose.connection.readyState === 1) {
    return await Review.find(filter).sort({ reviewId: 1 });
  }

  // In-memory filter
  return memoryStore.filter(r => {
    if (filter.sentiment && r.sentiment !== filter.sentiment) return false;
    if (filter.product && r.product !== filter.product) return false;
    if (filter.needsReply !== undefined && r.needsReply !== filter.needsReply) return false;
    if (filter.analysisStatus) {
      if (filter.analysisStatus.$in && Array.isArray(filter.analysisStatus.$in)) {
        if (!filter.analysisStatus.$in.includes(r.analysisStatus)) return false;
      } else if (r.analysisStatus !== filter.analysisStatus) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Helper: Find a single review by query
 */
async function findSingleReview(query) {
  if (mongoose.connection.readyState === 1) {
    return await Review.findOne(query);
  }
  return memoryStore.find(r => {
    if (query.reviewId && r.reviewId === query.reviewId) return true;
    if (query.reviewHash && r.reviewHash === query.reviewHash && query.analysisStatus && r.analysisStatus === query.analysisStatus) {
      if (query._id && query._id.$ne && r._id === query._id.$ne) return false;
      return true;
    }
    return false;
  }) || null;
}

/**
 * Helper: Save or update a review
 */
async function saveReviewDoc(reviewData) {
  if (mongoose.connection.readyState === 1) {
    const existing = await Review.findOne({ reviewId: reviewData.reviewId });
    if (existing) {
      existing.product = reviewData.product;
      existing.rating = reviewData.rating;
      existing.date = reviewData.date;
      existing.reviewText = reviewData.reviewText;
      existing.reviewHash = reviewData.reviewHash;
      // If it was never analyzed or previously failed, allow re-analysis
      if (existing.analysisStatus !== 'analyzed') {
        existing.analysisStatus = reviewData.analysisStatus;
      }
      return await existing.save();
    }
    return await Review.create(reviewData);
  }

  // In-memory update or insert
  const existingIndex = memoryStore.findIndex(r => r.reviewId === reviewData.reviewId);
  const doc = {
    _id: reviewData._id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...reviewData,
    createdAt: reviewData.createdAt || new Date(),
    updatedAt: new Date(),
    save: async function() { return this; }
  };

  if (existingIndex >= 0) {
    if (memoryStore[existingIndex].analysisStatus !== 'analyzed') {
      memoryStore[existingIndex] = { ...memoryStore[existingIndex], ...doc };
    } else {
      memoryStore[existingIndex].product = reviewData.product;
      memoryStore[existingIndex].rating = reviewData.rating;
      memoryStore[existingIndex].date = reviewData.date;
      memoryStore[existingIndex].reviewText = reviewData.reviewText;
      memoryStore[existingIndex].reviewHash = reviewData.reviewHash;
    }
    return memoryStore[existingIndex];
  } else {
    memoryStore.push(doc);
    return doc;
  }
}

/**
 * Upload and process CSV reviews
 * POST /api/reviews/upload
 */
export async function uploadReviews(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded. Please upload a valid .csv file.'
      });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    let records = [];

    try {
      records = parse(fileContent, {
        columns: true,
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

    const stats = {
      totalRows: records.length,
      saved: 0,
      skippedDuplicates: 0,
      insufficientContent: 0
    };

    const savedReviews = [];
    const seenHashesInBatch = new Set();

    for (const row of records) {
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

      if (!reviewId) continue;

      if (seenHashesInBatch.has(reviewHash) && cleanedText.length > 0) {
        stats.skippedDuplicates++;
        continue;
      }
      if (cleanedText.length > 0) {
        seenHashesInBatch.add(reviewHash);
      }

      let analysisStatus = 'pending';
      if (cleanedText.length === 0 || isEmojiOnly(cleanedText)) {
        analysisStatus = 'insufficient_content';
        stats.insufficientContent++;
      }

      const reviewData = {
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
      };

      try {
        const savedDoc = await saveReviewDoc(reviewData);
        savedReviews.push(savedDoc);
        stats.saved++;
      } catch (rowError) {
        console.error(`Error saving review ${reviewId}:`, rowError.message);
      }
    }

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
 * Fetch all reviews from MongoDB or memory
 * GET /api/reviews
 */
export async function getReviews(req, res, next) {
  try {
    const { sentiment, product, needsReply } = req.query;
    const filter = {};

    if (sentiment) filter.sentiment = sentiment;
    if (product) filter.product = product;
    if (needsReply !== undefined) filter.needsReply = needsReply === 'true';

    const reviews = await getStoredReviews(filter);

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
      return res.status(400).json({
        status: 'error',
        message: 'GEMINI_API_KEY is not configured in server/.env. Please configure your Google Gemini API key before running AI analysis.'
      });
    }

    const pendingReviews = await getStoredReviews({
      analysisStatus: { $in: ['pending', 'analysis_failed'] }
    });

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

    const stats = {
      totalPending: pendingReviews.length,
      processed: 0,
      aiCalls: 0,
      cacheHits: 0,
      failedAnalyses: 0,
      ratingMismatches: 0
    };

    const batches = chunkArray(pendingReviews, 5);

    for (const batch of batches) {
      for (const review of batch) {
        try {
          // STEP A: Cache Lookup
          const cachedReview = await findSingleReview({
            reviewHash: review.reviewHash,
            analysisStatus: 'analyzed',
            _id: { $ne: review._id }
          });

          if (cachedReview) {
            review.sentiment = cachedReview.sentiment;
            review.topics = cachedReview.topics;
            review.summary = cachedReview.summary;
            review.needsReply = cachedReview.needsReply;
            review.analysisStatus = 'analyzed';
            stats.cacheHits++;
          } else {
            // STEP B: Cache Miss - Call Gemini with Retry
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

          // STEP C: Rating Mismatch Detection
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

          await saveReviewDoc(review);
          stats.processed++;
        } catch (itemError) {
          console.error(`Error processing review ${review.reviewId}:`, itemError.message);
          review.analysisStatus = 'analysis_failed';
          await saveReviewDoc(review);
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
    const allReviews = await getStoredReviews();

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
    const analysedReviews = await getStoredReviews({ analysisStatus: 'analyzed' });

    const complaintCounts = {};
    for (const r of analysedReviews) {
      if (r.sentiment === 'negative' && Array.isArray(r.topics)) {
        for (const topic of r.topics) {
          complaintCounts[topic] = (complaintCounts[topic] || 0) + 1;
        }
      }
    }

    const praiseCounts = {};
    for (const r of analysedReviews) {
      if (r.sentiment === 'positive' && Array.isArray(r.topics)) {
        for (const topic of r.topics) {
          praiseCounts[topic] = (praiseCounts[topic] || 0) + 1;
        }
      }
    }

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

/**
 * Generate a suggested support reply for a review
 * POST /api/reviews/:id/reply
 */
export async function generateReviewReply(req, res, next) {
  try {
    const { id } = req.params;

    // Search by reviewId (e.g. 'R002') or MongoDB ObjectId
    const review = await findSingleReview({ reviewId: id }) || await findSingleReview({ _id: id });

    if (!review) {
      return res.status(404).json({
        status: 'error',
        message: `Review with ID "${id}" was not found.`
      });
    }

    // Call AI service to generate reply
    const replyText = await generateSupportReply(review);

    // Save generated reply on the document
    review.suggestedReply = replyText;
    await saveReviewDoc(review);

    return res.status(200).json({
      status: 'ok',
      message: 'Suggested reply generated successfully.',
      reviewId: review.reviewId,
      suggestedReply: replyText
    });
  } catch (error) {
    next(error);
  }
}
