import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid
} from 'recharts';
import { FiThumbsDown, FiThumbsUp } from 'react-icons/fi';

function Charts({ stats, insights }) {
  const {
    positiveCount = 0,
    neutralCount = 0,
    negativeCount = 0
  } = stats || {};

  const { topComplaints = [], topPraises = [] } = insights || {};

  // Data format for Recharts
  const chartData = [
    { name: 'Positive', count: positiveCount, color: '#10b981' },
    { name: 'Neutral', count: neutralCount, color: '#64748b' },
    { name: 'Negative', count: negativeCount, color: '#ef4444' }
  ];

  return (
    <div className="charts-grid">
      {/* 1. Sentiment Distribution Bar Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <h3>Sentiment Breakdown</h3>
          <p>Distribution across positive, neutral, and negative reviews</p>
        </div>

        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={13} tickLine={false} />
              <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
                  fontSize: '13px'
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Top Complaints & Top Praises Side-by-Side */}
      <div className="insights-container">
        {/* Top 3 Complaints */}
        <div className="insight-card complaint-card">
          <div className="insight-title">
            <FiThumbsDown className="text-red" />
            <h4>Top Customer Complaints</h4>
          </div>
          <p className="insight-desc">Most frequent friction points in negative feedback</p>

          {topComplaints.length === 0 ? (
            <div className="insight-empty">No negative complaints recorded yet.</div>
          ) : (
            <div className="insight-list">
              {topComplaints.map((item, index) => (
                <div key={item.topic} className="insight-item">
                  <div className="insight-item-left">
                    <span className="rank-badge rank-red">#{index + 1}</span>
                    <span className="topic-name">{item.topic.replace('_', ' ')}</span>
                  </div>
                  <span className="insight-count count-red">{item.count} issues</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 3 Praises */}
        <div className="insight-card praise-card">
          <div className="insight-title">
            <FiThumbsUp className="text-green" />
            <h4>Top Customer Praises</h4>
          </div>
          <p className="insight-desc">Most loved product features and qualities</p>

          {topPraises.length === 0 ? (
            <div className="insight-empty">No positive praises recorded yet.</div>
          ) : (
            <div className="insight-list">
              {topPraises.map((item, index) => (
                <div key={item.topic} className="insight-item">
                  <div className="insight-item-left">
                    <span className="rank-badge rank-green">#{index + 1}</span>
                    <span className="topic-name">{item.topic.replace('_', ' ')}</span>
                  </div>
                  <span className="insight-count count-green">{item.count} mentions</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Charts;
