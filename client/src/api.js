import axios from 'axios';

// Base URL for the Express backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000
});

/**
 * Upload CSV file to backend
 * @param {File} file 
 * @returns {Promise<object>} upload result with stats
 */
export async function uploadReviewsCSV(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/reviews/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

/**
 * Fetch all reviews with optional filters
 * @param {object} params - query parameters like { sentiment, product }
 * @returns {Promise<object>}
 */
export async function getReviews(params = {}) {
  const response = await apiClient.get('/reviews', { params });
  return response.data;
}

/**
 * Trigger batch AI analysis of pending reviews
 * @returns {Promise<object>}
 */
export async function analyzePendingReviews() {
  const response = await apiClient.post('/reviews/analyze');
  return response.data;
}

/**
 * Fetch summary statistics for the dashboard
 * @returns {Promise<object>}
 */
export async function getReviewStats() {
  const response = await apiClient.get('/reviews/stats');
  return response.data;
}

/**
 * Fetch top complaints and praises
 * @returns {Promise<object>}
 */
export async function getReviewInsights() {
  const response = await apiClient.get('/reviews/insights');
  return response.data;
}

/**
 * Generate a suggested AI support response for a specific review
 * @param {string} reviewId
 * @returns {Promise<object>}
 */
export async function generateSuggestedReply(reviewId) {
  const response = await apiClient.post(`/reviews/${reviewId}/reply`);
  return response.data;
}

/**
 * Check backend health status
 * @returns {Promise<object>}
 */
export async function getHealthStatus() {
  const response = await apiClient.get('/health');
  return response.data;
}

export default apiClient;
