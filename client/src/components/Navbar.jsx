import React from 'react';
import { FiUpload, FiCpu, FiRefreshCw } from 'react-icons/fi';

function Navbar({
  onOpenUpload,
  onAnalyze,
  analyzing,
  pendingCount,
  onRefresh,
  loading
}) {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <h1>Product Review Analysis</h1>
        <p>AI-powered sentiment classification, topic detection & smart responses</p>
      </div>

      <div className="navbar-right">
        {/* Refresh Data Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn btn-secondary"
          title="Reload reviews and stats"
        >
          <FiRefreshCw className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>

        {/* Upload CSV Trigger Button */}
        <button
          onClick={onOpenUpload}
          className="btn btn-secondary"
        >
          <FiUpload />
          <span>Upload CSV</span>
        </button>

        {/* Batch Analyze AI Button */}
        <button
          onClick={onAnalyze}
          disabled={analyzing || pendingCount === 0}
          className="btn btn-primary"
          style={{ opacity: analyzing || pendingCount === 0 ? 0.6 : 1 }}
        >
          <FiCpu className={analyzing ? 'spin' : ''} />
          <span>{analyzing ? 'Analyzing in Batches...' : `Analyze (${pendingCount} Pending)`}</span>
        </button>
      </div>
    </header>
  );
}

export default Navbar;
