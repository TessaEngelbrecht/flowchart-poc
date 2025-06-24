import React, { useState, useCallback } from 'react';
import FlowchartEditor from './components/FlowchartEditor';
import Analytics from './components/Analytics';
import SessionGraph from './components/SessionGraph';
import './App.css';

function App() {
  const [currentSession, setCurrentSession] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const startNewSession = useCallback(() => {
    setCurrentSession(null);
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, []);

  const handleSessionChange = useCallback((sessionId) => {
    setCurrentSession(sessionId);
  }, []);

  return (
    <div className="app-container">
      {/* Enhanced Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">Algorithmic Thinking Assessment</h1>
          </div>
          <div className="header-controls">
            <button
              onClick={startNewSession}
              className="btn btn-secondary"
              title="Start New Session"
            >
              New Session
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Flowchart Editor */}
        <div className="editor-container">
          <FlowchartEditor
            problemId="sample_problem_1"
            userId="student_123"
            onSessionChange={handleSessionChange}
          />
        </div>
        {/* Analytics Panel fixed at bottom
        {showAnalytics && (
          <div className="analytics-panel">
            <Analytics sessionId={currentSession} />
          </div>
        )} */}
      </main>
      <div className="session-graph-container">
        <SessionGraph />
      </div>
    </div>
  );
}

export default App;
