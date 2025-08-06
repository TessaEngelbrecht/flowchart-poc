import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { SolutionSpecificLTLService } from '../services/SolutionSpecificLTLService';
import { SolutionSpecificAssessmentService } from '../services/SolutionSpecificAssessmentService';
import FlowchartEditor from './FlowchartEditor';
import { toast } from 'react-toastify';

const StudentInterface = ({ onSessionChange }) => {
    const [problemCode, setProblemCode] = useState('');
    const [studentNumber, setStudentNumber] = useState(''); // New state
    const [currentProblem, setCurrentProblem] = useState(null);
    const [universalFormulas, setUniversalFormulas] = useState([]);
    const [problemFormulas, setProblemFormulas] = useState([]);
    const [currentSession, setCurrentSession] = useState(null);
    const [sessionLocked, setSessionLocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showFormulas, setShowFormulas] = useState(true);
    const [assessmentResult, setAssessmentResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const flowchartRef = React.useRef(null);

    const loadProblem = async () => {
        if (!problemCode.trim()) {
            toast.error('Please enter a problem code');
            return;
        }

        if (!studentNumber.trim()) {
            toast.error('Please enter your student number');
            return;
        }

        // Validate student number format (adjust regex as needed)
        const studentNumberRegex = /^[A-Za-z0-9]{6,20}$/;
        if (!studentNumberRegex.test(studentNumber.trim())) {
            toast.error('Please enter a valid student number (6-20 alphanumeric characters)');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('assessment_problems')
                .select('*')
                .eq('problem_code', problemCode.trim().toUpperCase())
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    toast.error('Problem not found. Please check the code.');
                } else {
                    throw error;
                }
                return;
            }

            setCurrentProblem(data);

            const [universal, problemSpecific] = await Promise.all([
                SolutionSpecificLTLService.getUniversalFormulas(),
                SolutionSpecificLTLService.getProblemFormulas(data.id)
            ]);

            setUniversalFormulas(universal);
            setProblemFormulas(problemSpecific);
            toast.success(`Problem loaded successfully for student ${studentNumber.trim()}!`);

        } catch (error) {
            console.error('Error loading problem:', error);
            toast.error('Failed to load problem');
        } finally {
            setLoading(false);
        }
    };

    const handleSessionChange = (sessionId) => {
        if (!sessionLocked || !currentSession) {
            console.log('Session changed to:', sessionId);
            setCurrentSession(sessionId);
            onSessionChange?.(sessionId);

            if (sessionId && !sessionLocked) {
                setSessionLocked(true);
                console.log('Session locked:', sessionId);
            }
        } else {
            console.log('Session change blocked - session is locked to:', currentSession);
        }
    };

    const handleSubmitAssessment = async () => {
        if (!currentSession || !currentProblem) {
            toast.error('No active session found');
            return;
        }

        if (!flowchartRef.current || !flowchartRef.current.getGraphXml) {
            toast.error('Cannot access flowchart data');
            return;
        }

        setSubmitting(true);
        try {
            const flowchartXml = flowchartRef.current.getGraphXml();

            if (!flowchartXml) {
                toast.error('No flowchart data found. Please create a flowchart first.');
                return;
            }

            console.log('Starting assessment with LOCKED session:', currentSession);
            toast.info('Evaluating your flowchart...');

            const result = await SolutionSpecificAssessmentService.assessStudentFlowchart(
                currentProblem.id,
                currentSession,
                flowchartXml,
                studentNumber.trim() // Pass student number
            );

            setAssessmentResult(result);
            toast.success(`Assessment complete! Score: ${result.combinedScore || result.score}%`);

        } catch (error) {
            console.error('Error submitting assessment:', error);
            toast.error('Failed to assess flowchart. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetProblem = () => {
        setCurrentProblem(null);
        setProblemCode('');
        setStudentNumber(''); // Reset student number
        setUniversalFormulas([]);
        setProblemFormulas([]);
        setCurrentSession(null);
        setSessionLocked(false);
        setAssessmentResult(null);
    };

    const toggleFormulasVisibility = () => {
        setShowFormulas(!showFormulas);
    };

    if (assessmentResult) {
        return (
            <AssessmentResults
                result={assessmentResult}
                problem={currentProblem}
                studentNumber={studentNumber}
                onStartOver={resetProblem}
            />
        );
    }

    if (currentProblem) {
        return (
            <div className="student-interface-container">
                <div className="student-problem-header">
                    <div className="problem-info">
                        <h2>{currentProblem.title}</h2>
                        <p className="problem-description">{currentProblem.description}</p>
                        <div className="student-info">
                            <strong>Student Number:</strong> {studentNumber}
                        </div>

                        <div className="assessment-criteria-toggle">
                            <button
                                onClick={toggleFormulasVisibility}
                                className="btn btn-outline btn-small"
                            >
                                {showFormulas ? '📋 Hide Assessment Criteria' : '📋 Show Assessment Criteria'}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={resetProblem}
                        className="btn btn-secondary"
                    >
                        Change Problem
                    </button>
                </div>

                {/* Assessment Criteria Panel */}
                {showFormulas && (
                    <div className="assessment-criteria-panel">
                        <div className="criteria-header">
                            <h3>📊 Assessment Criteria</h3>
                            <p className="criteria-description">
                                Your flowchart will be evaluated based on the following criteria:
                            </p>
                        </div>

                        <div className="criteria-sections">
                            <div className="criteria-section">
                                <h4 className="criteria-section-title">
                                    <span className="criteria-icon">🔧</span>
                                    Basic Requirements ({universalFormulas.length} criteria) - 60% weight
                                </h4>
                                <div className="criteria-grid">
                                    {universalFormulas.map(formula => (
                                        <CriteriaCard key={formula.id} formula={formula} type="universal" />
                                    ))}
                                </div>
                            </div>

                            {problemFormulas.length > 0 && (
                                <div className="criteria-section">
                                    <h4 className="criteria-section-title">
                                        <span className="criteria-icon">🎯</span>
                                        Problem-Specific Requirements ({problemFormulas.length} criteria) - 60% weight
                                    </h4>
                                    <div className="criteria-grid">
                                        {problemFormulas.map(formula => (
                                            <CriteriaCard key={formula.id} formula={formula} type="problem-specific" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="criteria-section">
                                <h4 className="criteria-section-title">
                                    <span className="criteria-icon">🧠</span>
                                    Systematic Construction - 40% weight
                                </h4>
                                <div className="criteria-description">
                                    <p>Your construction process will be analyzed for:</p>
                                    <ul>
                                        <li>Logical element ordering (Start → Process → Decision → End)</li>
                                        <li>Planning evidence (minimal deletions and corrections)</li>
                                        <li>Construction efficiency and directness</li>
                                        <li>Problem-solving approach and adaptation</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Flowchart Editor */}
                <div className="student-editor-container">
                    <FlowchartEditor
                        ref={flowchartRef}
                        problemId={currentProblem.id}
                        studentNumber={studentNumber.trim()} // Pass student number
                        onSessionChange={handleSessionChange}
                        isLecturerMode={false}
                    />
                </div>

                {/* Submit Section */}
                <div className="submit-section">
                    <div className="submit-info">
                        <h3>Ready to Submit?</h3>
                        <p>
                            Your flowchart will be evaluated against{' '}
                            <strong>{universalFormulas.length + problemFormulas.length} structural criteria (60%)</strong>
                            {' '}and <strong>systematic construction process (40%)</strong>.
                        </p>
                        {currentSession && (
                            <p className="session-info">
                                <small>Student: {studentNumber} | Session ID: {currentSession}</small>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleSubmitAssessment}
                        disabled={submitting || !currentSession}
                        className="btn btn-primary btn-large submit-btn"
                    >
                        {submitting ? (
                            <>
                                <span className="spinner"></span>
                                Evaluating Flowchart...
                            </>
                        ) : (
                            <>
                                📝 Submit for Assessment
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="student-interface-container">
            <div className="student-code-entry">
                <h2>Enter Problem Code & Student Number</h2>
                <p>Get the problem code from your instructor and enter your student number to start the assessment.</p>

                <div className="code-entry-form">
                    <div className="input-group">
                        <label htmlFor="studentNumber">Student Number:</label>
                        <input
                            id="studentNumber"
                            type="text"
                            value={studentNumber}
                            onChange={(e) => setStudentNumber(e.target.value)}
                            placeholder="Enter your student number"
                            className="student-input"
                            disabled={loading}
                            maxLength="20"
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="problemCode">Problem Code:</label>
                        <input
                            id="problemCode"
                            type="text"
                            value={problemCode}
                            onChange={(e) => setProblemCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadProblem()}
                            placeholder="Enter problem code (e.g., ABC123)"
                            className="code-input"
                            disabled={loading}
                        />
                    </div>

                    <button
                        onClick={loadProblem}
                        disabled={loading || !problemCode.trim() || !studentNumber.trim()}
                        className="btn btn-primary"
                    >
                        {loading ? 'Loading...' : 'Load Problem'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Updated CriteriaCard component (unchanged functionality)
const CriteriaCard = ({ formula, type }) => {
    const getReadableDescription = (description) => {
        const friendlyDescriptions = {
            'At least one start node present': 'Your flowchart must have a Start element',
            'At least one end node present': 'Your flowchart must have an End element',
            'Every start leads to some end node': 'All paths must lead from Start to End',
            'Decision nodes must have at least two outgoing connections': 'Decision elements must have multiple paths (Yes/No branches)',
            'All non-text nodes must be connected or be start nodes': 'All elements must be connected in a logical flow',
            'No isolated nodes except text and start': 'No elements should be disconnected from the main flow',
            'Process nodes must have input and output connections': 'Process elements must be part of the flow sequence'
        };
        return friendlyDescriptions[description] || description;
    };

    return (
        <div className={`criteria-card ${type}`}>
            <div className="criteria-card-header">
                <h5 className="criteria-name">{formula.formula_name.replace(/_/g, ' ').toUpperCase()}</h5>
            </div>
            <div className="criteria-description">
                <p>{getReadableDescription(formula.description)}</p>
            </div>
        </div>
    );
};


// Keep your existing AssessmentResults component (unchanged)
const AssessmentResults = ({ result, problem, studentNumber, onStartOver }) => {
    const { structuralScore, processScore, combinedScore, processResults, structuralResults } = result;
    const testingDetails = processResults?.testingDetails;

    return (
        <div className="assessment-results-container">
            <div className="results-header">
                <h2>📊 Assessment Results</h2>
                <div className="student-problem-info">
                    <p><strong>Student:</strong> {studentNumber}</p>
                    <p><strong>Problem:</strong> {problem.title}</p>
                    <p><strong>Completed:</strong> {new Date().toLocaleString()}</p>
                </div>
            </div>

            {/* Combined Score Display with Updated Weights */}
            <div className="score-display">
                <div className="score-circle">
                    <div className={`circle ${combinedScore >= 70 ? 'pass' : combinedScore >= 50 ? 'partial' : 'fail'}`}>
                        <span className="score-number">{combinedScore}%</span>
                    </div>
                </div>
                <div className="score-breakdown">
                    <h3>Overall Score: {combinedScore}%</h3>
                    <div className="score-components">
                        <div className="score-component">
                            <span className="component-label">Structural Correctness:</span>
                            <span className="component-score">{structuralScore}% (60% weight)</span>
                        </div>
                        <div className="score-component">
                            <span className="component-label">Systematic Construction:</span>
                            <span className="component-score">{processScore}% (40% weight)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Testing Breakdown */}
            {testingDetails && (
                <div className="testing-breakdown">
                    <h3>📋 What Was Tested & How You Scored</h3>

                    {Object.entries(testingDetails).map(([category, details]) => (
                        <div key={category} className="test-category">
                            <div className="category-header">
                                <h4>{category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h4>
                                <span className="category-score">{details.earnedPoints}/{details.totalPoints} points</span>
                            </div>

                            <div className="tests-grid">
                                {Object.entries(details.tests).map(([testName, test]) => (
                                    <div key={testName} className="test-item">
                                        <div className="test-header">
                                            <h5>{test.description}</h5>
                                            <span className="test-score">{test.points}/{test.maxPoints} pts</span>
                                        </div>

                                        <div className="test-feedback">
                                            {typeof test.feedback === 'object' ? (
                                                <div className="feedback-details">
                                                    {Object.entries(test.feedback).map(([key, value]) => (
                                                        <div key={key} className="feedback-item">
                                                            <strong>{key.replace(/([A-Z])/g, ' $1')}:</strong> {String(value)}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p>{test.feedback}</p>
                                            )}
                                        </div>

                                        <div className="score-bar">
                                            <div
                                                className="score-fill"
                                                style={{ width: `${(test.score * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Structural Results */}
            <div className="structural-assessment">
                <h3>🏗️ Structural Correctness (LTL Formulas)</h3>
                {/* ... existing structural results display ... */}
            </div>

            {/* Clear Feedback */}
            {processResults?.feedback && (
                <div className="clear-feedback">
                    <h3>💡 Your Feedback</h3>

                    {processResults.feedback.strengths?.length > 0 && (
                        <div className="feedback-section strengths">
                            <h4>🌟 What You Did Well</h4>
                            <ul>
                                {processResults.feedback.strengths.map((strength, i) => (
                                    <li key={i}>{strength}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {processResults.feedback.improvements?.length > 0 && (
                        <div className="feedback-section improvements">
                            <h4>🎯 Areas to Improve</h4>
                            <ul>
                                {processResults.feedback.improvements.map((improvement, i) => (
                                    <li key={i}>{improvement}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {processResults.feedback.suggestions?.length > 0 && (
                        <div className="feedback-section suggestions">
                            <h4>💡 Tips for Next Time</h4>
                            <ul>
                                {processResults.feedback.suggestions.map((suggestion, i) => (
                                    <li key={i}>{suggestion}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="result-actions">
                <button onClick={onStartOver} className="btn btn-primary">
                    🔄 Try Another Problem
                </button>
            </div>
        </div>
    );
};


export default StudentInterface;
