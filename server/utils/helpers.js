import crypto from 'crypto';

/**
 * Normalizes text for consistent hashing:
 * - Trims leading/trailing whitespace
 * - Converts to lowercase
 * - Collapses consecutive spaces/newlines into a single space
 * Preserves unicode characters (Hindi, Hinglish, emojis)
 *
 * @param {string} text 
 * @returns {string} normalized text
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Generates a SHA-256 hash of normalized text using Node.js crypto module.
 * Used for duplicate detection and fast database cache lookups.
 *
 * @param {string} text 
 * @returns {string} 64-character hexadecimal hash
 */
export function generateReviewHash(text) {
  const normalized = normalizeText(text);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Checks if a string contains only emojis, whitespace, or symbols without words.
 *
 * @param {string} text 
 * @returns {boolean} true if review is emoji-only
 */
export function isEmojiOnly(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  // Remove all whitespace
  const stripped = text.trim();
  if (stripped.length === 0) {
    return false;
  }

  // Regex matching emojis, symbols, and pictographs
  const emojiRegex = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\s\p{Punctuation}]+$/u;
  // Also check that it does not contain letters or digits in any language (\p{L} or \p{N})
  const hasAlphanumeric = /[\p{L}\p{N}]/u.test(stripped);

  return emojiRegex.test(stripped) && !hasAlphanumeric;
}

/**
 * Cleans review text:
 * - Handles null or undefined
 * - Replaces \r\n with standard \n
 * - Trims leading and trailing whitespace
 * - Keeps original casing, emojis, Hindi, Hinglish
 *
 * @param {string} rawText 
 * @returns {string} cleaned review text
 */
export function cleanReviewText(rawText) {
  if (rawText === null || rawText === undefined) {
    return '';
  }
  return String(rawText).replace(/\r\n/g, '\n').trim();
}

/**
 * Validates and converts the rating column:
 * - Accept only integers from 1 to 5
 * - Return null for missing, empty, or invalid ratings (e.g. "five", 0, 6)
 *
 * @param {any} rawRating 
 * @returns {number|null} 1-5 or null
 */
export function validateRating(rawRating) {
  if (rawRating === null || rawRating === undefined) {
    return null;
  }

  const str = String(rawRating).trim();
  if (str === '') {
    return null;
  }

  // Parse as integer
  const parsedNumber = Number(str);

  // Check if it's a valid integer between 1 and 5
  if (Number.isInteger(parsedNumber) && parsedNumber >= 1 && parsedNumber <= 5) {
    return parsedNumber;
  }

  return null;
}

/**
 * Splits an array into smaller chunks of a specified size.
 * Used for batch processing reviews in groups of 5.
 *
 * @param {Array} array 
 * @param {number} size 
 * @returns {Array[]} array of chunks
 */
export function chunkArray(array, size = 5) {
  if (!Array.isArray(array) || size <= 0) {
    return [];
  }
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Executes an async function with exponential backoff retries.
 * Used for handling rate limits (429) or transient server errors.
 * Example delays: 1s -> 2s -> 4s
 *
 * @param {Function} asyncFn - asynchronous function returning a Promise
 * @param {number} maxRetries - maximum attempts (default: 3)
 * @param {number} initialDelayMs - base delay in milliseconds (default: 1000)
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(asyncFn, maxRetries = 3, initialDelayMs = 1000) {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.warn(`[RetryWithBackoff] Attempt ${attempt} failed: ${error.message}. Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff: 1s, 2s, 4s
    }
  }
}
