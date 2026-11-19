import { describe, it, expect, vi } from 'vitest';
import {
  cleanReviewText,
  validateRating,
  generateReviewHash,
  isEmojiOnly,
  retryWithBackoff,
  chunkArray
} from '../utils/helpers.js';
import { validateAnalysis } from '../services/aiService.js';

// =========================================================================
// TEST SUITE 1: CSV Cleaning and Rating Validation
// =========================================================================
describe('Test 1: CSV Cleaning and Rating Validation', () => {
  it('should accept only valid integers between 1 and 5 as ratings', () => {
    // Valid cases
    expect(validateRating(1)).toBe(1);
    expect(validateRating(5)).toBe(5);
    expect(validateRating('3')).toBe(3);
    expect(validateRating('4')).toBe(4);

    // Invalid numbers out of range
    expect(validateRating(0)).toBeNull();
    expect(validateRating(6)).toBeNull();
    expect(validateRating(-1)).toBeNull();
    expect(validateRating(4.5)).toBeNull(); // Decimals not allowed

    // Word ratings (e.g., R022: "five")
    expect(validateRating('five')).toBeNull();
    expect(validateRating('four')).toBeNull();

    // Missing and empty ratings (e.g., R010)
    expect(validateRating('')).toBeNull();
    expect(validateRating('   ')).toBeNull();
    expect(validateRating(null)).toBeNull();
    expect(validateRating(undefined)).toBeNull();
  });

  it('should clean review text and normalize line endings while preserving Unicode and Hindi', () => {
    // Multiline normalizations (\r\n -> \n)
    const multilineRaw = 'Line 1\r\nLine 2\r\nLine 3';
    expect(cleanReviewText(multilineRaw)).toBe('Line 1\nLine 2\nLine 3');

    // Trimming
    expect(cleanReviewText('   Great product!   ')).toBe('Great product!');

    // Preserving Hindi and Hinglish
    const hindiText = 'यह घड़ी दो दिन में ही खराब हो गई और स्क्रीन बिल्कुल काम नहीं कर रही है।';
    expect(cleanReviewText(hindiText)).toBe(hindiText);

    const hinglishText = 'Sound quality bohot acchi hai, bass bhi deep hai.';
    expect(cleanReviewText(hinglishText)).toBe(hinglishText);

    // Null/undefined handling
    expect(cleanReviewText(null)).toBe('');
    expect(cleanReviewText(undefined)).toBe('');
  });

  it('should accurately detect emoji-only reviews as insufficient content', () => {
    // Emoji-only reviews (e.g., R009)
    expect(isEmojiOnly('🔥😍👍🎉')).toBe(true);
    expect(isEmojiOnly('👍 👍 👍')).toBe(true);
    expect(isEmojiOnly('⭐️⭐️⭐️⭐️⭐️')).toBe(true);

    // Reviews with text + emojis (should NOT be flagged as emoji-only)
    expect(isEmojiOnly('Great sound quality 👍')).toBe(false);
    expect(isEmojiOnly('Loved it! 😍')).toBe(false);
    expect(isEmojiOnly('Standard text review')).toBe(false);
  });

  it('should generate consistent 64-char SHA-256 hashes for duplicate detection', () => {
    const text1 = 'Battery life is outstanding and sound quality is crystal clear.';
    const text2 = '   battery life is outstanding and sound quality is crystal clear.   ';

    const hash1 = generateReviewHash(text1);
    const hash2 = generateReviewHash(text2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

// =========================================================================
// TEST SUITE 2: AI Response Validation (validateAnalysis)
// =========================================================================
describe('Test 2: AI Response Validation', () => {
  it('should approve valid structured JSON output matching all schema rules', () => {
    const validOutput = {
      sentiment: 'negative',
      topics: ['quality', 'delivery'],
      summary: 'The customer reported defective battery and delayed shipping.',
      needs_reply: true
    };

    const result = validateAnalysis(validOutput);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject invalid sentiment values', () => {
    const invalidSentiment = {
      sentiment: 'super_angry', // Not positive, neutral, or negative
      topics: ['quality'],
      summary: 'Product broke down.',
      needs_reply: true
    };

    const result = validateAnalysis(invalidSentiment);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid sentiment "super_angry"');
  });

  it('should reject unauthorized topic categories', () => {
    const invalidTopics = {
      sentiment: 'positive',
      topics: ['quality', 'battery_life_custom_tag'], // Unauthorized topic
      summary: 'Great long lasting battery.',
      needs_reply: false
    };

    const result = validateAnalysis(invalidTopics);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid topic "battery_life_custom_tag"');
  });

  it('should reject empty summaries or non-string summaries', () => {
    const emptySummary = {
      sentiment: 'neutral',
      topics: ['price'],
      summary: '   ', // Empty string
      needs_reply: false
    };

    const result = validateAnalysis(emptySummary);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Summary must be a non-empty string');
  });

  it('should reject non-boolean needs_reply flags', () => {
    const nonBooleanNeedsReply = {
      sentiment: 'negative',
      topics: ['support'],
      summary: 'Support was unhelpful.',
      needs_reply: 'yes' // String instead of boolean
    };

    const result = validateAnalysis(nonBooleanNeedsReply);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('needs_reply must be a boolean');
  });

  it('should reject unexpected extra fields (strict schema adherence)', () => {
    const extraFields = {
      sentiment: 'positive',
      topics: ['packaging'],
      summary: 'Arrived safely.',
      needs_reply: false,
      hallucinated_field: 'unknown data'
    };

    const result = validateAnalysis(extraFields);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Unexpected field "hallucinated_field"');
  });
});

// =========================================================================
// TEST SUITE 3: Retry Logic with Exponential Backoff
// =========================================================================
describe('Test 3: Retry Logic with Exponential Backoff', () => {
  it('should succeed when a transient API error recovers on retry', async () => {
    let callCount = 0;

    // Simulated flaky Gemini API call: fails 2 times with 429, succeeds on 3rd attempt
    const mockGeminiCall = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('429 Too Many Requests (Rate limit exceeded)');
      }
      return {
        sentiment: 'positive',
        topics: ['quality'],
        summary: 'Excellent build quality.',
        needs_reply: false
      };
    });

    // Use small base delay (10ms) to keep unit test execution fast
    const result = await retryWithBackoff(mockGeminiCall, 3, 10);

    expect(result).toBeDefined();
    expect(result.sentiment).toBe('positive');
    expect(callCount).toBe(3);
    expect(mockGeminiCall).toHaveBeenCalledTimes(3);
  });

  it('should throw the final error if max retry attempts are exhausted', async () => {
    const failingCall = vi.fn(async () => {
      throw new Error('503 Service Unavailable: Gemini server is down');
    });

    await expect(retryWithBackoff(failingCall, 3, 10)).rejects.toThrow(
      '503 Service Unavailable: Gemini server is down'
    );

    expect(failingCall).toHaveBeenCalledTimes(3);
  });

  it('should split arrays into batches of 5 correctly', () => {
    const reviewsList = Array.from({ length: 13 }, (_, i) => `R00${i + 1}`);
    const batches = chunkArray(reviewsList, 5);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(5);
    expect(batches[1]).toHaveLength(5);
    expect(batches[2]).toHaveLength(3);
  });
});
