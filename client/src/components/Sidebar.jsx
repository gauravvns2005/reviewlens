import React from 'react';
import { FiGrid, FiList, FiCheckCircle } from 'react-icons/fi';

function Sidebar({ currentView, setCurrentView, pendingCount }) {
  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <div className="sidebar-brand">
        <div className="brand-icon">RL</div>
        <div className="brand-text">
          <h2>ReviewLens</h2>
          <span>AI Intelligence</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentView === 'overview' ? 'active' : ''}`}
          onClick={() => setCurrentView('overview')}
        >
          <FiGrid className="nav-icon" />
          <span>Overview</span>
        </button>

        <button
          className={`nav-item ${currentView === 'reviews' ? 'active' : ''}`}
          onClick={() => setCurrentView('reviews')}
        >
          <FiList className="nav-icon" />
          <span>Reviews</span>
          {pendingCount > 0 && (
            <span className="nav-badge">{pendingCount}</span>
          )}
        </button>
      </nav>

      {/* System Status Footer */}
      <div className="sidebar-footer">
        <div className="system-status">
          <FiCheckCircle style={{ color: '#10b981' }} />
          <span>System Active</span>
        </div>
        <small>Assessment Build v1.0</small>
      </div>
    </aside>
  );
}

export default Sidebar;
