import React, { useState, useEffect } from 'react';
import CSVUpload from './components/CSVUpload.jsx';
import { getReviews, analyzePendingReviews } from './api.js';

function App() {
  // State 1: Store the health check response from backend
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState(null);

  // State 2: List of reviews fetched from MongoDB
  const [reviewsList, setReviewsList] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // State 3: AI Batch Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStats, setAnalysisStats] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

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

  // Function to trigger batch AI analysis
  async function handleStartAnalysis() {
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStats(null);

    try {
      const response = await analyzePendingReviews();
      setAnalysisStats(response.stats);
      // Reload reviews to show new AI data
      await loadAllReviews();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setAnalysisError(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  // Load health and existing reviews on initial mount
  useEffect(() => {
    checkServerHealth();
    loadAllReviews();
  }, []);

  function handleUploadSuccess() {
    loadAllReviews();
  }

  // Count pending reviews that need analysis
  const pendingCount = reviewsList.filter(r => r.analysisStatus === 'pending').length;
  const analyzedCount = reviewsList.filter(r => r.analysisStatus === 'analyzed').length;

  return (
    <div className="container" style={{ maxWidth: '1100px' }}>
      <div className="card">
        {/* Brand Header */}
        <div className="header">
          <div className="logo-badge">RL</div>
          <div className="header-text">
            <h1>ReviewLens</h1>
            <p>Simple AI Product Review Analysis System</p>
          </div>
        </div>

        {/* Phase 5 Status Banner */}
        <div className="status-box">
          <h2>Phase 5: Batching (Chunks of 5), Backoff Retries & SHA-256 Caching</h2>
          <p>
            Connected to <strong>{API_URL}</strong>. Batched Gemini requests with exponential backoff and instant database cache reuse.
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

        {/* AI Batch Analysis Trigger Section */}
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>
                Gemini AI Review Intelligence
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                Pending Reviews to Analyze: <strong>{pendingCount}</strong> | Already Analyzed: <strong>{analyzedCount}</strong>
              </p>
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={analyzing || pendingCount === 0}
              className="btn"
              style={{ opacity: analyzing || pendingCount === 0 ? 0.6 : 1, padding: '10px 20px' }}
            >
              {analyzing ? 'Analyzing in Batches of 5...' : `Start AI Batch Analysis (${pendingCount} Pending)`}
            </button>
          </div>

          {/* Analysis Error Notification */}
          {analysisError && (
            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', color: '#991b1b', fontSize: '13px' }}>
              <strong>Analysis Notice:</strong> {analysisError}
              <div style={{ marginTop: '4px', fontSize: '12px' }}>
                Make sure your <code>GEMINI_API_KEY</code> is added to <code>server/.env</code>.
              </div>
            </div>
          )}

          {/* Analysis Results Card */}
          {analysisStats && (
            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
                Batch Analysis Run Finished
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Processed</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{analysisStats.processed}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Cache Hits</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>{analysisStats.cacheHits}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>AI API Calls</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#2563eb' }}>{analysisStats.aiCalls}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Rating Mismatches</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#ea580c' }}>{analysisStats.ratingMismatches}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Failed</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#dc2626' }}>{analysisStats.failedAnalyses}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cleaned & Analyzed Reviews Table */}
        <div style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
              All Reviews in Database ({reviewsList.length})
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
              No reviews stored yet. Upload <code>reviews.csv</code> above to get started.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '10px 12px' }}>ID</th>
                    <th style={{ padding: '10px 12px' }}>Product</th>
                    <th style={{ padding: '10px 12px' }}>Rating</th>
                    <th style={{ padding: '10px 12px' }}>Review Text</th>
                    <th style={{ padding: '10px 12px' }}>Sentiment</th>
                    <th style={{ padding: '10px 12px' }}>Topics</th>
                    <th style={{ padding: '10px 12px' }}>Summary</th>
                    <th style={{ padding: '10px 12px' }}>Needs Reply</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewsList.map((rev) => (
                    <tr key={rev.reviewId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#2563eb' }}>{rev.reviewId}</td>
                      <td style={{ padding: '10px 12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rev.product}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {rev.rating !== null ? (
                          <span>★ {rev.rating}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>null</span>
                        )}
                        {rev.isRatingMismatch && (
                          <span title="Rating Mismatch Detected!" style={{ marginLeft: '4px', color: '#ea580c', fontWeight: 'bold' }}>⚠️</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '240px', whiteSpace: 'pre-wrap' }}>
                        {rev.reviewText ? rev.reviewText : <em style={{ color: '#94a3b8' }}>[Empty]</em>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {rev.sentiment ? (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: rev.sentiment === 'positive' ? '#dcfce7' : rev.sentiment === 'negative' ? '#fee2e2' : '#f1f5f9',
                            color: rev.sentiment === 'positive' ? '#15803d' : rev.sentiment === 'negative' ? '#b91c1c' : '#475569'
                          }}>
                            {rev.sentiment}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {rev.topics && rev.topics.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {rev.topics.map(t => (
                              <span key={t} style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '200px', fontSize: '12px', color: '#334155' }}>
                        {rev.summary || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {rev.needsReply ? (
                          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Yes</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: rev.analysisStatus === 'analyzed' ? '#dcfce7' : rev.analysisStatus === 'pending' ? '#fef3c7' : '#fee2e2',
                          color: rev.analysisStatus === 'analyzed' ? '#15803d' : rev.analysisStatus === 'pending' ? '#92400e' : '#991b1b'
                        }}>
                          {rev.analysisStatus}
                        </span>
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
