import React, { useState } from 'react';
import { uploadReviewsCSV } from '../api.js';

function CSVUpload({ onUploadSuccess }) {
  // State 1: Currently selected file
  const [selectedFile, setSelectedFile] = useState(null);

  // State 2: Upload in progress indicator
  const [uploading, setUploading] = useState(false);

  // State 3: Upload success statistics from backend
  const [stats, setStats] = useState(null);

  // State 4: Error message if upload fails
  const [errorMessage, setErrorMessage] = useState(null);

  // Handle file selection from the input
  function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setErrorMessage('Please select a valid CSV (.csv) file.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      setStats(null);
    }
  }

  // Handle form submission and send file to backend
  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Please choose a CSV file first.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadReviewsCSV(selectedFile);
      setStats(result.stats);
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message;
      setErrorMessage(`Upload failed: ${serverMsg}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#0f172a' }}>
        Upload Product Reviews CSV
      </h3>
      <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
        Select your <code>reviews.csv</code> file. The system will automatically clean text, validate ratings, preserve Hindi/Hinglish, and flag edge cases.
      </p>

      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={uploading}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              fontSize: '14px'
            }}
          />

          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="btn"
            style={{ opacity: !selectedFile || uploading ? 0.6 : 1 }}
          >
            {uploading ? 'Processing CSV...' : 'Upload & Clean CSV'}
          </button>
        </div>

        {selectedFile && (
          <p style={{ fontSize: '13px', color: '#475569' }}>
            Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </form>

      {/* Error Message Box */}
      {errorMessage && (
        <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', color: '#991b1b', fontSize: '13px' }}>
          {errorMessage}
        </div>
      )}

      {/* Upload Results Stats Card */}
      {stats && (
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
            CSV Processing Complete!
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Total Rows</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{stats.totalRows}</div>
            </div>
            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Saved to DB</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#16a34a' }}>{stats.saved}</div>
            </div>
            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Skipped Duplicates</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#ea580c' }}>{stats.skippedDuplicates}</div>
            </div>
            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Insufficient Content</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#dc2626' }}>{stats.insufficientContent}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CSVUpload;
