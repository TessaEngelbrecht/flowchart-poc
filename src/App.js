import React, { useState, useCallback } from 'react';
import FlowchartEditor from './components/FlowchartEditor';
import Analytics from './components/Analytics';
import './App.css';

function App() {
  const [currentSession, setCurrentSession] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const startNewSession = useCallback(() => {
    // Clear the current session to force a new one
    setCurrentSession(null);
    // Force re-render which will create new session
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, []);

  const handleSessionChange = useCallback((sessionId) => {
    setCurrentSession(sessionId);
  }, []);

  return (
    <div className="App h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white p-3 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Algorithmic Thinking Assessment</h1>
          
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Flowchart Editor */}
        <div className="flex-1">
          <FlowchartEditor
            problemId="sample_problem_1"
            userId="student_123"
            onSessionChange={handleSessionChange}
          />
        </div>

        {/* Analytics at Bottom */}
        {showAnalytics && currentSession && (
          <div className="h-64 border-t bg-gray-50 p-4 overflow-y-auto">
            <Analytics sessionId={currentSession} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
