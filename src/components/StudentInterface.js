import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LTLService } from '../services/LTLService';
import { AssessmentService } from '../services/AssessmentService';
import FlowchartEditor from './FlowchartEditor';
import { toast } from 'react-toastify';

const StudentInterface = ({ onSessionChange }) => {
    const [problemCode, setProblemCode] = useState('');
    const [currentProblem, setCurrentProblem] = useState(null);
    const [universalFormulas, setUniversalFormulas] = useState([]);
    const [problemFormulas, setProblemFormulas] = useState([]);
    const [currentSession, setCurrentSession] = useState(null);
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
                LTLService.getUniversalFormulas(),
                LTLService.getProblemFormulas(data.id)
            ]);

            setUniversalFormulas(universal);
            setProblemFormulas(problemSpecific);
            toast.success('Problem loaded successfully!');

        } catch (error) {
            console.error('Error loading problem:', error);
            toast.error('Failed to load problem');
        } finally {
            setLoading(false);
        }
    };

    const handleSessionChange = (sessionId) => {
        setCurrentSession(sessionId);
        onSessionChange?.(sessionId);
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
            // Get current flowchart XML
            const flowchartXml = flowchartRef.current.getGraphXml();

            if (!flowchartXml) {
                toast.error('No flowchart data found. Please create a flowchart first.');
                return;
            }

            toast.info('Evaluating your flowchart...');

            // Perform assessment
            const result = await AssessmentService.assessStudentFlowchart(
                currentProblem.id,
                currentSession,
                flowchartXml
            );

            setAssessmentResult(result);

            toast.success(`Assessment complete! Score: ${result.score}%`);

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
        setUniversalFormulas([]);
        setProblemFormulas([]);
        setCurrentSession(null);
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
                                    Basic Requirements ({universalFormulas.length} criteria)
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
                                        Problem-Specific Requirements ({problemFormulas.length} criteria)
                                    </h4>
                                    <div className="criteria-grid">
                                        {problemFormulas.map(formula => (
                                            <CriteriaCard key={formula.id} formula={formula} type="problem-specific" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Flowchart Editor */}
                <div className="student-editor-container">
                    <FlowchartEditor
                        ref={flowchartRef}
                        problemId={currentProblem.problem_code}
                        userId="student_user"
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
                            <strong>{universalFormulas.length + problemFormulas.length} criteria</strong>.
                            Make sure you've completed your solution before submitting.
                        </p>
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
                <h2>Enter Problem Code</h2>
                <p>Get the problem code from your instructor to start the assessment.</p>

                <div className="code-entry-form">
                    <input
                        type="text"
                        value={problemCode}
                        onChange={(e) => setProblemCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadProblem()}
                        placeholder="Enter problem code (e.g., ABC123)"
                        className="code-input"
                        disabled={loading}
                    />
                    <button
                        onClick={loadProblem}
                        disabled={loading || !problemCode.trim()}
                        className="btn btn-primary"
                    >
                        {loading ? 'Loading...' : 'Load Problem'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Assessment Results Component
const AssessmentResults = ({ result, problem, onStartOver }) => {
    const { score, passedCount, totalCount, results } = result;

    const passedResults = results.filter(r => r.passed);
    const failedResults = results.filter(r => r.passed === false);

    return (
        <div className="assessment-results-container">
            <div className="results-header">
                <h2>📊 Assessment Results</h2>
                <p>Problem: {problem.title}</p>
            </div>

            {/* Score Display */}
            <div className="score-display">
                <div className="score-circle">
                    <div className={`circle ${score >= 70 ? 'pass' : score >= 50 ? 'partial' : 'fail'}`}>
                        <span className="score-number">{score}%</span>
                    </div>
                </div>
                <div className="score-details">
                    <h3>Your Score: {passedCount} out of {totalCount}</h3>
                    <p className={`score-status ${score >= 70 ? 'pass' : score >= 50 ? 'partial' : 'fail'}`}>
                        {score >= 70 ? '✅ Excellent Work!' : score >= 50 ? '⚠️ Good Effort - Room for Improvement' : '❌ Needs More Work'}
                    </p>
                </div>
            </div>

            {/* Detailed Results */}
            <div className="detailed-results">
                {/* Passed Criteria */}
                {passedResults.length > 0 && (
                    <div className="result-section passed">
                        <h4>✅ Criteria Met ({passedResults.length})</h4>
                        <div className="result-list">
                            {passedResults.map((result, index) => (
                                <div key={index} className="result-item passed">
                                    <h5>{result.formula_name.replace(/_/g, ' ').toUpperCase()}</h5>
                                    <p>{result.description}</p>
                                    <small>{result.details}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Failed Criteria */}
                {failedResults.length > 0 && (
                    <div className="result-section failed">
                        <h4>❌ Criteria Not Met ({failedResults.length})</h4>
                        <div className="result-list">
                            {failedResults.map((result, index) => (
                                <div key={index} className="result-item failed">
                                    <h5>{result.formula_name.replace(/_/g, ' ').toUpperCase()}</h5>
                                    <p>{result.description}</p>
                                    <small>{result.details}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="result-actions">
                <button onClick={onStartOver} className="btn btn-primary">
                    🔄 Try Another Problem
                </button>
            </div>
        </div>
    );
};

// Criteria Card Component (unchanged from previous implementation)
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

export default StudentInterface;
