import React, { useState, useRef, useEffect } from 'react';
import { SolutionSpecificLTLService } from '../services/SolutionSpecificLTLService';
//import { FixedAssessmentService } from '../services/FixedAssessmentService';

const SolutionValidator = ({
    flowchartRef,
    onValidationComplete,
    showValidation = false
}) => {
    const [validationResult, setValidationResult] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
    const [validationHistory, setValidationHistory] = useState([]);

    const validateSolution = async () => {
        if (!flowchartRef.current || !flowchartRef.current.getGraphXml) {
            console.error('FlowchartRef not available or missing getGraphXml method');
            return;
        }

        setIsValidating(true);
        try {
            const flowchartXml = flowchartRef.current.getGraphXml();

            if (!flowchartXml) {
                throw new Error('No flowchart data found. Please create some elements first.');
            }

            console.log('🔍 Validating lecturer solution...');

            // Validate against universal formulas
            const validation = await SolutionSpecificLTLService.validateSolutionAgainstUniversal(
                'temp-problem-id',
                flowchartXml
            );

            const timestamp = new Date().toLocaleString();
            const newResult = {
                ...validation,
                timestamp,
                xmlLength: flowchartXml.length
            };

            setValidationResult(newResult);
            setValidationHistory(prev => [newResult, ...prev.slice(0, 4)]); // Keep last 5 validations

            if (onValidationComplete) {
                onValidationComplete(newResult);
            }

            console.log('✅ Validation complete:', validation.isValid ? 'PASSED' : 'FAILED');

        } catch (error) {
            console.error('❌ Validation error:', error);
            const errorResult = {
                isValid: false,
                error: error.message,
                score: 0,
                timestamp: new Date().toLocaleString()
            };
            setValidationResult(errorResult);

            if (onValidationComplete) {
                onValidationComplete(errorResult);
            }
        } finally {
            setIsValidating(false);
        }
    };

    const renderValidationResult = (result) => {
        if (!result) return null;

        const getScoreColor = (score) => {
            if (score >= 80) return '#4CAF50'; // Green
            if (score >= 60) return '#FF9800'; // Orange
            return '#F44336'; // Red
        };

        const getStatusIcon = (isValid, hasError) => {
            if (hasError) return '❌';
            if (isValid) return '✅';
            return '⚠️';
        };

        return (
            <div className="validation-result">
                <div className="validation-header">
                    <div className="validation-status">
                        <span className="status-icon">
                            {getStatusIcon(result.isValid, result.error)}
                        </span>
                        <span className="status-text">
                            {result.error ? 'Validation Error' :
                                result.isValid ? 'Solution Valid' : 'Solution Issues Found'}
                        </span>
                        <span className="validation-timestamp">
                            {result.timestamp}
                        </span>
                    </div>

                    <div className="validation-score">
                        <div
                            className="score-circle"
                            style={{
                                backgroundColor: getScoreColor(result.score),
                                color: 'white',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                            }}
                        >
                            {result.score}%
                        </div>
                    </div>
                </div>

                {result.error && (
                    <div className="validation-error">
                        <h4>❌ Error Details</h4>
                        <p style={{ color: '#F44336', fontFamily: 'monospace' }}>
                            {result.error}
                        </p>
                    </div>
                )}

                {!result.error && (
                    <div className="validation-details">
                        <div className="validation-summary">
                            <div className="summary-item">
                                <strong>Passed:</strong> {result.passedFormulas || 0}
                            </div>
                            <div className="summary-item">
                                <strong>Total:</strong> {result.totalFormulas || 0}
                            </div>
                            <div className="summary-item">
                                <strong>Success Rate:</strong> {
                                    result.totalFormulas > 0
                                        ? Math.round((result.passedFormulas / result.totalFormulas) * 100)
                                        : 0
                                }%
                            </div>
                        </div>

                        {result.isValid ? (
                            <div className="validation-success">
                                <h4>✅ Solution Quality Check</h4>
                                <p style={{ color: '#4CAF50' }}>
                                    Your solution passes all basic requirements! Students will be able to
                                    achieve high scores with correct implementations.
                                </p>
                                <div className="quality-indicators">
                                    <div className="quality-item">
                                        ✓ Has proper start and end nodes
                                    </div>
                                    <div className="quality-item">
                                        ✓ All elements are connected
                                    </div>
                                    <div className="quality-item">
                                        ✓ Processing elements have proper flow
                                    </div>
                                    <div className="quality-item">
                                        ✓ Decision nodes (if any) have multiple branches
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="validation-issues">
                                <h4>⚠️ Issues to Fix</h4>
                                <p style={{ color: '#FF9800' }}>
                                    Your solution has some issues that may prevent students from achieving
                                    high scores. Please address these problems:
                                </p>

                                {result.failedChecks && result.failedChecks.length > 0 && (
                                    <div className="failed-checks">
                                        {result.failedChecks.map((check, index) => (
                                            <div key={index} className="failed-check">
                                                <div className="check-name">
                                                    <strong>{check.formula.replace(/_/g, ' ').toUpperCase()}</strong>
                                                </div>
                                                <div className="check-description">
                                                    {check.description}
                                                </div>
                                                {check.details && (
                                                    <div className="check-details">
                                                        <small>{check.details}</small>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderValidationHistory = () => {
        if (validationHistory.length === 0) return null;

        return (
            <div className="validation-history">
                <h4>Recent Validations</h4>
                <div className="history-list">
                    {validationHistory.map((result, index) => (
                        <div key={index} className="history-item">
                            <span className="history-status">
                                {result.error ? '❌' : result.isValid ? '✅' : '⚠️'}
                            </span>
                            <span className="history-score">{result.score}%</span>
                            <span className="history-time">{result.timestamp}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!showValidation) return null;

    return (
        <div className="solution-validator">
            <div className="validator-header">
                <h3>🔍 Solution Validation</h3>
                <p>Check if your solution meets basic requirements for student assessment</p>
            </div>

            <div className="validator-controls">
                <button
                    onClick={validateSolution}
                    disabled={isValidating}
                    className="btn btn-primary validate-btn"
                    style={{
                        backgroundColor: isValidating ? '#ccc' : '#2196F3',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '4px',
                        cursor: isValidating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    {isValidating ? (
                        <>
                            <span className="spinner" style={{
                                display: 'inline-block',
                                width: '16px',
                                height: '16px',
                                border: '2px solid #f3f3f3',
                                borderTop: '2px solid #333',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></span>
                            Validating...
                        </>
                    ) : (
                        <>
                            🔍 Validate Solution
                        </>
                    )}
                </button>
            </div>

            {validationResult && (
                <div className="validation-results">
                    {renderValidationResult(validationResult)}
                </div>
            )}

            {validationHistory.length > 0 && (
                <div className="validation-history-section">
                    {renderValidationHistory()}
                </div>
            )}

            <style jsx>{`
                .solution-validator {
                    background: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }

                .validator-header h3 {
                    margin: 0 0 8px 0;
                    color: #333;
                }

                .validator-header p {
                    margin: 0 0 16px 0;
                    color: #666;
                    font-size: 14px;
                }

                .validator-controls {
                    margin-bottom: 20px;
                }

                .validation-result {
                    background: white;
                    border-radius: 6px;
                    padding: 16px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .validation-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #eee;
                }

                .validation-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .status-icon {
                    font-size: 20px;
                }

                .status-text {
                    font-weight: bold;
                    font-size: 16px;
                }

                .validation-timestamp {
                    font-size: 12px;
                    color: #666;
                    margin-left: 12px;
                }

                .validation-summary {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 16px;
                    padding: 12px;
                    background: #f5f5f5;
                    border-radius: 4px;
                }

                .summary-item {
                    font-size: 14px;
                }

                .validation-success, .validation-issues {
                    margin-top: 16px;
                }

                .validation-success h4 {
                    color: #4CAF50;
                    margin: 0 0 8px 0;
                }

                .validation-issues h4 {
                    color: #FF9800;
                    margin: 0 0 8px 0;
                }

                .quality-indicators {
                    margin-top: 12px;
                }

                .quality-item {
                    padding: 4px 0;
                    color: #4CAF50;
                    font-size: 14px;
                }

                .failed-checks {
                    margin-top: 12px;
                }

                .failed-check {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 4px;
                    padding: 12px;
                    margin-bottom: 8px;
                }

                .check-name {
                    color: #856404;
                    margin-bottom: 4px;
                }

                .check-description {
                    color: #333;
                    margin-bottom: 4px;
                }

                .check-details {
                    color: #666;
                }

                .validation-error {
                    background: #ffe6e6;
                    border: 1px solid #ffcccc;
                    border-radius: 4px;
                    padding: 12px;
                    margin-top: 16px;
                }

                .validation-error h4 {
                    margin: 0 0 8px 0;
                    color: #F44336;
                }

                .validation-history {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #eee;
                }

                .validation-history h4 {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    color: #666;
                }

                .history-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .history-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 8px;
                    background: #f8f8f8;
                    border-radius: 4px;
                    font-size: 12px;
                }

                .history-score {
                    font-weight: bold;
                    min-width: 40px;
                }

                .history-time {
                    color: #666;
                    margin-left: auto;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default SolutionValidator;