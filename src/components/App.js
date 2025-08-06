import React, { useState, useCallback } from 'react';
import RoleSelector from './RoleSelector';
import LecturerProblemForm from './LecturerProblemForm';
import LecturerSolutionList from './LecturerSolutionList';
import SolutionFlowchartEditor from './SolutionFlowchartEditor';
import StudentInterface from './StudentInterface';
import '../App.css';

function App() {
  const [currentView, setCurrentView] = useState('role-selector');
  const [currentProblem, setCurrentProblem] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [editingSolutionId, setEditingSolutionId] = useState(null);

  const startNewSession = useCallback(() => {
    setCurrentSession(null);
    setCurrentView('role-selector');
    setCurrentProblem(null);
    setEditingSolutionId(null);
  }, []);

  const handleRoleSelect = (role) => {
    if (role === 'lecturer') {
      setCurrentView('problem-form');
    } else {
      setCurrentView('student-interface');
    }
  };

  const handleProblemCreated = (problem) => {
    setCurrentProblem(problem);
    setCurrentView('solution-list');
  };

  const handleCreateSolution = () => {
    setEditingSolutionId(null);
    setCurrentView('solution-editor');
  };

  const handleEditSolution = (solutionId) => {
    setEditingSolutionId(solutionId);
    setCurrentView('solution-editor');
  };

  const handleSolutionSaved = () => {
    setCurrentView('solution-list');
    setEditingSolutionId(null);
  };

  const handleBackToProblems = () => {
    setCurrentProblem(null);
    setCurrentView('problem-form');
  };

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
            {currentProblem && (
              <div className="problem-info">
                <span className="problem-title">{currentProblem.title}</span>
                <span className="problem-code">Code: {currentProblem.problem_code}</span>
              </div>
            )}
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
        {currentView === 'role-selector' && (
          <RoleSelector onRoleSelect={handleRoleSelect} />
        )}

        {currentView === 'problem-form' && (
          <LecturerProblemForm onCreated={handleProblemCreated} />
        )}

        {currentView === 'solution-list' && currentProblem && (
          <LecturerSolutionList
            problem={currentProblem}
            onCreateSolution={handleCreateSolution}
            onEditSolution={handleEditSolution}
            onBackToProblems={handleBackToProblems}
          />
        )}

        {currentView === 'solution-editor' && currentProblem && (
          <SolutionFlowchartEditor
            problem={currentProblem}
            solutionId={editingSolutionId}
            onSolutionSaved={handleSolutionSaved}
            onCancel={() => setCurrentView('solution-list')}
          />
        )}

        {currentView === 'student-interface' && (
          <StudentInterface onSessionChange={handleSessionChange} />
        )}
      </main>
    </div>
  );
}

export default App;
