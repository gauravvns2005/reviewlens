import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import Charts from '../components/Charts.jsx';
import ReviewTable from '../components/ReviewTable.jsx';
import CSVUpload from '../components/CSVUpload.jsx';
import {
  getReviews,
  getReviewStats,
  getReviewInsights,
  analyzePendingReviews
} from '../api.js';

function Dashboard() {
  // Navigation State: 'overview' or 'reviews'
  const [currentView, setCurrentView] = useState('overview');

  // Data States
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    totalReviews: 0,
    totalAnalysed: 0,
    positiveCount: 0,
    positivePercentage: 0,
    neutralCount: 0,
    neutralPercentage: 0,
    negativeCount: 0,
    negativePercentage: 0,
    needsReplyCount: 0
  });
  const [insights, setInsights] = useState({
    topComplaints: [],
    topPraises: []
  });

  // UI States
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [generatingReplyId, setGeneratingReplyId] = useState(null);

  // Load all data from backend
  async function loadDashboardData() {
    setLoading(true);
    try {
      // 1. Fetch reviews list
      const reviewsData = await getReviews();
      if (reviewsData && reviewsData.reviews) {
        setReviews(reviewsData.reviews);
      }

      // 2. Fetch stats
      const statsData = await getReviewStats();
      if (statsData && statsData.stats) {
        setStats(statsData.stats);
      }

      // 3. Fetch insights (top complaints/praises)
      const insightsData = await getReviewInsights();
      if (insightsData) {
        setInsights({
          topComplaints: insightsData.topComplaints || [],
          topPraises: insightsData.topPraises || []
        });
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setNotification({
        type: 'error',
        message: `Failed to load dashboard data: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  }

  // Initial load on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Handle Batch AI Analysis
  async function handleBatchAnalyze() {
    setAnalyzing(true);
    setNotification(null);

    try {
      const response = await analyzePendingReviews();
      setNotification({
        type: 'success',
        message: response.message || 'Batch analysis completed successfully!'
      });
      // Refresh dashboard data
      await loadDashboardData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setNotification({
        type: 'error',
        message: `Analysis failed: ${msg}. Make sure GEMINI_API_KEY is configured in server/.env.`
      });
    } finally {
      setAnalyzing(false);
    }
  }

  // Handle CSV Upload Success
  function handleUploadSuccess(result) {
    setNotification({
      type: 'success',
      message: `Uploaded ${result.stats?.totalRows} reviews (${result.stats?.saved} saved, ${result.stats?.skippedDuplicates} skipped duplicates).`
    });
    setShowUploadModal(false);
    loadDashboardData();
  }

  // Calculate pending reviews
  const pendingCount = reviews.filter(r => r.analysisStatus === 'pending').length;

  return (
    <div className="dashboard-layout">
      {/* 1. Left Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        pendingCount={pendingCount}
      />

      {/* 2. Main Content Area */}
      <div className="dashboard-main">
        {/* Top Navbar */}
        <Navbar
          onOpenUpload={() => setShowUploadModal(true)}
          onAnalyze={handleBatchAnalyze}
          analyzing={analyzing}
          pendingCount={pendingCount}
          onRefresh={loadDashboardData}
          loading={loading}
        />

        {/* Global Notification Banner */}
        {notification && (
          <div className={`notification-banner ${notification.type === 'error' ? 'banner-error' : 'banner-success'}`}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="banner-close">✕</button>
          </div>
        )}

        {/* Upload Modal / Dropdown */}
        {showUploadModal && (
          <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Upload Product Reviews CSV</h3>
                <button onClick={() => setShowUploadModal(false)} className="modal-close">✕</button>
              </div>
              <CSVUpload onUploadSuccess={handleUploadSuccess} />
            </div>
          </div>
        )}

        {/* View 1: Overview Dashboard */}
        {currentView === 'overview' && (
          <div className="view-content">
            {/* Summary Cards */}
            <SummaryCards stats={stats} />

            {/* Charts & Insights */}
            <Charts stats={stats} insights={insights} />

            {/* Recent Reviews Preview */}
            <div style={{ marginTop: '24px' }}>
              <ReviewTable
                reviews={reviews}
                generatingReplyId={generatingReplyId}
                onGenerateReply={() => setCurrentView('reviews')}
              />
            </div>
          </div>
        )}

        {/* View 2: Full Reviews Table */}
        {currentView === 'reviews' && (
          <div className="view-content">
            <ReviewTable
              reviews={reviews}
              generatingReplyId={generatingReplyId}
              onGenerateReply={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
