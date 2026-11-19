import React from 'react';
import { FiCheckSquare, FiSmile, FiMeh, FiFrown, FiAlertCircle } from 'react-icons/fi';

function SummaryCards({ stats }) {
  const {
    totalAnalysed = 0,
    positiveCount = 0,
    positivePercentage = 0,
    neutralCount = 0,
    neutralPercentage = 0,
    negativeCount = 0,
    negativePercentage = 0,
    needsReplyCount = 0
  } = stats || {};

  return (
    <div className="summary-grid">
      {/* 1. Total Analysed Reviews */}
      <div className="summary-card">
        <div className="card-top">
          <span className="card-title">Total Analysed</span>
          <div className="card-icon icon-blue">
            <FiCheckSquare />
          </div>
        </div>
        <div className="card-value">{totalAnalysed}</div>
        <div className="card-subtext">Completed AI Evaluations</div>
      </div>

      {/* 2. Positive Percentage */}
      <div className="summary-card">
        <div className="card-top">
          <span className="card-title">Positive Reviews</span>
          <div className="card-icon icon-green">
            <FiSmile />
          </div>
        </div>
        <div className="card-value value-green">{positivePercentage}%</div>
        <div className="card-subtext">{positiveCount} positive customer reviews</div>
      </div>

      {/* 3. Neutral Percentage */}
      <div className="summary-card">
        <div className="card-top">
          <span className="card-title">Neutral Reviews</span>
          <div className="card-icon icon-slate">
            <FiMeh />
          </div>
        </div>
        <div className="card-value value-slate">{neutralPercentage}%</div>
        <div className="card-subtext">{neutralCount} neutral customer reviews</div>
      </div>

      {/* 4. Negative Percentage */}
      <div className="summary-card">
        <div className="card-top">
          <span className="card-title">Negative Reviews</span>
          <div className="card-icon icon-red">
            <FiFrown />
          </div>
        </div>
        <div className="card-value value-red">{negativePercentage}%</div>
        <div className="card-subtext">{negativeCount} negative complaints</div>
      </div>

      {/* 5. Reviews Needing Reply */}
      <div className="summary-card">
        <div className="card-top">
          <span className="card-title">Needs Reply</span>
          <div className="card-icon icon-amber">
            <FiAlertCircle />
          </div>
        </div>
        <div className="card-value value-amber">{needsReplyCount}</div>
        <div className="card-subtext">Unresolved support issues</div>
      </div>
    </div>
  );
}

export default SummaryCards;
