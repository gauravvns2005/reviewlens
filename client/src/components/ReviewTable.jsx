import React, { useState, useMemo } from 'react';
import { FiFilter, FiSearch, FiMessageSquare, FiCopy, FiCheck } from 'react-icons/fi';

function ReviewTable({
  reviews = [],
  onGenerateReply,
  generatingReplyId
}) {
  // Filter States
  const [selectedProduct, setSelectedProduct] = useState('All');
  const [selectedSentiment, setSelectedSentiment] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Copy indicator state: stores reviewId that was copied
  const [copiedId, setCopiedId] = useState(null);

  // Extract unique products for dropdown
  const productOptions = useMemo(() => {
    const set = new Set();
    reviews.forEach(r => {
      if (r.product) set.add(r.product);
    });
    return ['All', ...Array.from(set)];
  }, [reviews]);

  // Allowed topic options
  const topicOptions = [
    'All',
    'quality',
    'delivery',
    'price',
    'packaging',
    'support',
    'size_fit',
    'other'
  ];

  // Filtered reviews using simple if/else logic
  const filteredReviews = useMemo(() => {
    return reviews.filter(rev => {
      // 1. Filter by Product
      if (selectedProduct !== 'All' && rev.product !== selectedProduct) {
        return false;
      }

      // 2. Filter by Sentiment
      if (selectedSentiment !== 'All' && rev.sentiment !== selectedSentiment) {
        return false;
      }

      // 3. Filter by Topic
      if (selectedTopic !== 'All') {
        if (!Array.isArray(rev.topics) || !rev.topics.includes(selectedTopic)) {
          return false;
        }
      }

      // 4. Search Query (matches reviewId, text, or product)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesId = rev.reviewId.toLowerCase().includes(query);
        const matchesText = rev.reviewText.toLowerCase().includes(query);
        const matchesProd = rev.product.toLowerCase().includes(query);
        if (!matchesId && !matchesText && !matchesProd) {
          return false;
        }
      }

      return true;
    });
  }, [reviews, selectedProduct, selectedSentiment, selectedTopic, searchQuery]);

  // Copy text to clipboard helper
  function handleCopyReply(reviewId, text) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(reviewId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  return (
    <div className="table-card">
      <div className="table-header">
        <div>
          <h3>All Customer Reviews ({filteredReviews.length} of {reviews.length})</h3>
          <p>Inspect cleaned customer feedback, detected topics, and AI summaries</p>
        </div>

        {/* Search Input */}
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search reviews, products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="filters-bar">
        <div className="filter-group">
          <FiFilter className="filter-icon" />
          <span className="filter-label">Filters:</span>
        </div>

        {/* Product Filter */}
        <div className="filter-item">
          <label>Product:</label>
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
            {productOptions.map(prod => (
              <option key={prod} value={prod}>{prod}</option>
            ))}
          </select>
        </div>

        {/* Sentiment Filter */}
        <div className="filter-item">
          <label>Sentiment:</label>
          <select value={selectedSentiment} onChange={(e) => setSelectedSentiment(e.target.value)}>
            <option value="All">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>

        {/* Topic Filter */}
        <div className="filter-item">
          <label>Topic:</label>
          <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
            {topicOptions.map(t => (
              <option key={t} value={t}>{t === 'All' ? 'All Topics' : t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {/* Reset Filters Button */}
        {(selectedProduct !== 'All' || selectedSentiment !== 'All' || selectedTopic !== 'All' || searchQuery !== '') && (
          <button
            onClick={() => {
              setSelectedProduct('All');
              setSelectedSentiment('All');
              setSelectedTopic('All');
              setSearchQuery('');
            }}
            className="btn btn-secondary btn-sm"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Data Table */}
      {filteredReviews.length === 0 ? (
        <div className="table-empty">
          No reviews match your current filters.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="review-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>ID</th>
                <th style={{ width: '160px' }}>Product</th>
                <th style={{ width: '90px' }}>Rating</th>
                <th>Review Text</th>
                <th style={{ width: '100px' }}>Sentiment</th>
                <th style={{ width: '150px' }}>Topics</th>
                <th>AI Summary</th>
                <th style={{ width: '95px' }}>Needs Reply</th>
                <th style={{ width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map(rev => (
                <tr key={rev.reviewId}>
                  {/* Review ID */}
                  <td className="col-id">{rev.reviewId}</td>

                  {/* Product */}
                  <td className="col-product" title={rev.product}>{rev.product}</td>

                  {/* Rating */}
                  <td className="col-rating">
                    {rev.rating !== null ? (
                      <span className="rating-pill">★ {rev.rating}</span>
                    ) : (
                      <span className="rating-null">null</span>
                    )}
                    {rev.isRatingMismatch && (
                      <span className="mismatch-badge" title="Rating & Sentiment Mismatch Detected!">⚠️</span>
                    )}
                  </td>

                  {/* Review Text */}
                  <td className="col-text">
                    <div className="review-text-wrap">
                      {rev.reviewText ? rev.reviewText : <em className="text-muted">[Empty Review]</em>}
                    </div>

                    {/* Suggested Reply Card if generated */}
                    {rev.suggestedReply && (
                      <div className="suggested-reply-box">
                        <div className="suggested-reply-header">
                          <span>AI Suggested Response:</span>
                          <button
                            onClick={() => handleCopyReply(rev._id || rev.reviewId, rev.suggestedReply)}
                            className="btn-copy"
                            title="Copy to clipboard"
                          >
                            {copiedId === (rev._id || rev.reviewId) ? <FiCheck /> : <FiCopy />}
                            <span>{copiedId === (rev._id || rev.reviewId) ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <p className="suggested-reply-text">{rev.suggestedReply}</p>
                      </div>
                    )}
                  </td>

                  {/* Sentiment Badge */}
                  <td>
                    {rev.sentiment ? (
                      <span className={`sentiment-badge badge-${rev.sentiment}`}>
                        {rev.sentiment}
                      </span>
                    ) : (
                      <span className="sentiment-badge badge-pending">
                        {rev.analysisStatus}
                      </span>
                    )}
                  </td>

                  {/* Topics Pill Tags */}
                  <td>
                    {rev.topics && rev.topics.length > 0 ? (
                      <div className="topics-wrap">
                        {rev.topics.map(t => (
                          <span key={t} className="topic-tag">
                            {t.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>

                  {/* AI Summary */}
                  <td className="col-summary">
                    {rev.summary ? rev.summary : <span className="text-muted">-</span>}
                  </td>

                  {/* Needs Reply */}
                  <td style={{ textAlign: 'center' }}>
                    {rev.needsReply ? (
                      <span className="badge-urgent">Urgent</span>
                    ) : (
                      <span className="text-muted">No</span>
                    )}
                  </td>

                  {/* Action Column */}
                  <td>
                    {rev.needsReply && (
                      <button
                        onClick={() => onGenerateReply && onGenerateReply(rev)}
                        disabled={generatingReplyId === (rev._id || rev.reviewId)}
                        className="btn-action"
                      >
                        <FiMessageSquare />
                        <span>
                          {generatingReplyId === (rev._id || rev.reviewId)
                            ? 'Generating...'
                            : rev.suggestedReply
                            ? 'Regenerate'
                            : 'Generate Reply'}
                        </span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ReviewTable;
