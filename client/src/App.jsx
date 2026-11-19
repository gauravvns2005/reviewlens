import React, { useState, useEffect } from 'react';
import CSVUpload from './components/CSVUpload.jsx';
import { getReviews } from './api.js';

function App() {
  // State 1: Store the health check response from backend
  const [healthData, setHealthData] = useState(null);

  // State 2: Track whether the API request is in progress
  const [loadingHealth, setLoadingHealth] = useState(true);

  // State 3: Store any error message if request fails
  const [healthError, setHealthError] = useState(null);

  // State 4: List of reviews fetched from MongoDB
  const [reviewsList, setReviewsList] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Backend base URL
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Function to fetch the health status from Express backend
  async function checkServerHealth() {
    setLoadingHealth(true);
    setHealthError(null);

    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }
      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      setHealthError(err.message);
      setHealthData(null);
    } finally {
      setLoadingHealth(false);
    }
  }

  // Function to load all reviews from the backend
  async function loadAllReviews() {
    setLoadingReviews(true);
    try {
      const data = await getReviews();
      if (data && data.reviews) {
        setReviewsList(data.reviews);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err.message);
    } finally {
      setLoadingReviews(false);
    }
  }

  // Load health and existing reviews on initial mount
  useEffect(() => {
    checkServerHealth();
    loadAllReviews();
  }, []);

  // Callback when a new CSV upload succeeds
  function handleUploadSuccess(result) {
    if (result && result.reviews) {
      setReviewsList(result.reviews);
    } else {
      loadAllReviews();
    }
  }

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <div className="card">
        {/* Brand Header */}
        <div className="header">
          <div className="logo-badge">RL</div>
          <div className="header-text">
            <h1>ReviewLens</h1>
            <p>Simple AI Product Review Analysis System</p>
          </div>
        </div>

        {/* Phase 3 Status Banner */}
        <div className="status-box">
          <h2>Phase 3: CSV Upload, Data Cleaning & Edge Case Handling</h2>
          <p>
            Connected to <strong>{API_URL}</strong>. Test uploading <code>reviews.csv</code> to clean, validate ratings, detect duplicates, and store cleaned reviews in MongoDB.
          </p>

          {/* Connection Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {loadingHealth && (
              <span className="badge badge-loading">
                <span className="dot dot-loading"></span>
                Checking backend health...
              </span>
            )}

            {!loadingHealth && healthData && (
              <>
                <span className="badge badge-online">
                  <span className="dot dot-online"></span>
                  Backend: Online (Port 5000)
                </span>

                <span className={`badge ${healthData.database?.connected ? 'badge-online' : 'badge-offline'}`}>
                  <span className={`dot ${healthData.database?.connected ? 'dot-online' : 'dot-offline'}`}></span>
                  MongoDB: {healthData.database?.status || 'Unknown'}
                </span>
              </>
            )}

            {!loadingHealth && healthError && (
              <span className="badge badge-offline">
                <span className="dot dot-offline"></span>
                Backend Offline: {healthError}
              </span>
            )}

            <button
              onClick={checkServerHealth}
              disabled={loadingHealth}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              {loadingHealth ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>
        </div>

        {/* CSV Upload Component */}
        <CSVUpload onUploadSuccess={handleUploadSuccess} />

        {/* Cleaned Reviews Preview Section */}
        <div style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
              Cleaned Reviews in Database ({reviewsList.length})
            </h3>
            <button
              onClick={loadAllReviews}
              disabled={loadingReviews}
              className="btn btn-secondary"
              style={{ fontSize: '13px' }}
            >
              {loadingReviews ? 'Refreshing...' : 'Reload Reviews'}
            </button>
          </div>

          {reviewsList.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px', padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              No reviews stored yet. Upload <code>reviews.csv</code> above to see cleaned data.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>ID</th>
                    <th style={{ padding: '10px 14px' }}>Product</th>
                    <th style={{ padding: '10px 14px' }}>Rating</th>
                    <th style={{ padding: '10px 14px' }}>Review Text</th>
                    <th style={{ padding: '10px 14px' }}>Analysis Status</th>
                    <th style={{ padding: '10px 14px' }}>Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewsList.map((rev) => (
                    <tr key={rev.reviewId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '600', color: '#2563eb' }}>{rev.reviewId}</td>
                      <td style={{ padding: '10px 14px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rev.product}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {rev.rating !== null ? (
                          <span style={{ fontWeight: '600' }}>★ {rev.rating}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>null (invalid/missing)</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: '300px' }}>
                        {rev.reviewText ? rev.reviewText : <em style={{ color: '#94a3b8' }}>[Empty Text]</em>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: rev.analysisStatus === 'pending' ? '#fef3c7' : '#fee2e2',
                          color: rev.analysisStatus === 'pending' ? '#92400e' : '#991b1b'
                        }}>
                          {rev.analysisStatus}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b', fontSize: '11px' }}>
                        {rev.reviewHash ? rev.reviewHash.substring(0, 8) + '...' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
