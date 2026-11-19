import React, { useState, useEffect } from 'react';

function App() {
  // State 1: Store the health check response from backend
  const [healthData, setHealthData] = useState(null);

  // State 2: Track whether the API request is in progress
  const [loading, setLoading] = useState(true);

  // State 3: Store any error message if request fails
  const [error, setError] = useState(null);

  // Backend base URL from environment variable or default to localhost:5000
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Function to fetch the health status from the Express backend
  async function checkServerHealth() {
    setLoading(true);
    setError(null);

    try {
      // Make a GET request to the Express backend health endpoint
      const response = await fetch(`${API_URL}/api/health`);

      // Check if response status is HTTP 200-299
      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }

      // Parse JSON response body
      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      // If server is unreachable or an error occurred
      setError(err.message);
      setHealthData(null);
    } finally {
      // Always stop loading spinner / state
      setLoading(false);
    }
  }

  // useEffect runs once when the component mounts on the screen
  useEffect(() => {
    checkServerHealth();
  }, []);

  return (
    <div className="container">
      <div className="card">
        {/* Brand Header */}
        <div className="header">
          <div className="logo-badge">RL</div>
          <div className="header-text">
            <h1>ReviewLens</h1>
            <p>Simple AI Product Review Analysis System</p>
          </div>
        </div>

        {/* Phase 2 Verification Box */}
        <div className="status-box">
          <h2>Phase 2: Database Connectivity & Health Status</h2>
          <p>
            Vite React client running on <strong>http://localhost:5173</strong> communicating with Express server on <strong>{API_URL}</strong>.
          </p>

          {/* Connection Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {loading && (
              <span className="badge badge-loading">
                <span className="dot dot-loading"></span>
                Checking backend health...
              </span>
            )}

            {!loading && healthData && (
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

            {!loading && error && (
              <span className="badge badge-offline">
                <span className="dot dot-offline"></span>
                Backend Offline: {error}
              </span>
            )}

            {/* Manual Refresh Button */}
            <button
              onClick={checkServerHealth}
              disabled={loading}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              {loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          {/* Backend Response JSON Viewer */}
          {healthData && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                Response from <code>GET /api/health</code>:
              </p>
              <pre className="response-block">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            </div>
          )}

          {/* Help box if backend failed to connect */}
          {error && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', color: '#991b1b', fontSize: '13px' }}>
              <strong>Troubleshooting Tip:</strong> Ensure your Express backend server is running on port 5000 using <code>npm run dev:server</code>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
