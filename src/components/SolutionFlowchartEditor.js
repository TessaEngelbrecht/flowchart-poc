import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import FlowchartEditor from './FlowchartEditor';
import SolutionValidator from './SolutionValidator';
import { toast } from 'react-toastify';
import { SolutionSpecificLTLService } from '../services/SolutionSpecificLTLService';

const SolutionFlowchartEditor = ({
    problem,
    solutionId,
    onSolutionSaved,
    onCancel
}) => {
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showValidator, setShowValidator] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [saveAttempted, setSaveAttempted] = useState(false);
    const flowchartRef = useRef(null);

    useEffect(() => {
        initializeSolutionSession();
    }, [problem.id, solutionId]);

    const initializeSolutionSession = async () => {
        try {
            const sessionData = {
                user_id: 'lecturer_user',
                problem_id: problem.problem_code,
                is_lecturer_mode: true
            };

            if (solutionId) {
                sessionData.solution_id = solutionId;
            }

            const { data, error } = await supabase
                .from('flowchart_sessions')
                .insert(sessionData)
                .select()
                .single();

            if (error) {
                console.error('Detailed error:', error);
                throw error;
            }

            setSessionId(data.id);
        } catch (error) {
            console.error('Error initializing session:', error);
            toast.error('Failed to initialize editor');
        }
    };

    const handleValidationComplete = (result) => {
        setValidationResult(result);

        if (result.isValid) {
            toast.success(`✅ Solution validation passed! Score: ${result.score}%`);
        } else if (result.error) {
            toast.error(`❌ Validation error: ${result.error}`);
        } else {
            toast.warning(`⚠️ Solution validation failed. Score: ${result.score}%. Please fix issues before saving.`);
        }
    };

    const saveSolution = async (flowchartXml) => {
        if (!flowchartXml) {
            toast.error('No flowchart data to save');
            return;
        }

        setSaveAttempted(true);

        // If we haven't validated yet, or validation failed, warn the user
        if (!validationResult || !validationResult.isValid) {
            const shouldContinue = window.confirm(
                `⚠️ WARNING: Your solution ${!validationResult ? 'has not been validated' : 'failed validation'}.\n\n` +
                `Students may not be able to achieve high scores with this solution.\n\n` +
                `Do you want to save anyway? (Recommended: Click 'Cancel' and validate first)`
            );

            if (!shouldContinue) {
                return;
            }
        }

        setLoading(true);
        try {
            let record;
            if (solutionId) {
                const { data, error } = await supabase
                    .from('assessment_solutions')
                    .update({ flowchart_xml: flowchartXml })
                    .eq('id', solutionId)
                    .select()
                    .single();
                if (error) throw error;
                record = data;
                toast.success('Solution updated!');
            } else {
                const { data, error } = await supabase
                    .from('assessment_solutions')
                    .insert({
                        problem_id: problem.id,
                        flowchart_xml: flowchartXml,
                        created_by: 'lecturer_user'
                    })
                    .select()
                    .single();
                if (error) throw error;
                record = data;
                toast.success('Solution saved!');
            }

            // Generate smart LTL formulas
            const formulaResult = await SolutionSpecificLTLService.generateAndStoreSolutionFormulas(
                problem.id,
                record.id,
                flowchartXml
            );

            if (formulaResult.success) {
                toast.success(`✅ Generated ${formulaResult.formulaCount} smart LTL formulas!`);

                // Show validation status if available
                if (formulaResult.solutionValidation) {
                    const validation = formulaResult.solutionValidation;
                    if (validation.isValid) {
                        toast.success(`🎯 Solution validation: ${validation.score}% - Students can achieve high scores!`);
                    } else {
                        toast.warning(`⚠️ Solution validation: ${validation.score}% - Consider improving the solution`);
                    }
                }
            } else {
                toast.warning('Solution saved but formula generation had issues');
            }

            onSolutionSaved();
        } catch (error) {
            console.error('Error in saveSolution:', error);
            toast.error('Failed to save solution or generate formulas.');
        } finally {
            setLoading(false);
        }
    };

    const extractFlowchartXml = () => {
        try {
            if (flowchartRef.current && flowchartRef.current.getGraphXml) {
                const xml = flowchartRef.current.getGraphXml();
                if (xml) return xml;
            }

            if (flowchartRef.current && flowchartRef.current.graph) {
                const graph = flowchartRef.current.graph;
                if (window.mxCodec && window.mxUtils) {
                    const encoder = new window.mxCodec();
                    const node = encoder.encode(graph.getModel());
                    return window.mxUtils.getXml(node);
                }
            }

            return null;
        } catch (error) {
            console.error('Error extracting flowchart XML:', error);
            return null;
        }
    };

    const handleSaveClick = async () => {
        if (flowchartRef.current && flowchartRef.current.saveSnapshot) {
            try {
                await flowchartRef.current.saveSnapshot();
            } catch (error) {
                console.log('Snapshot save failed, proceeding with direct XML extraction');
            }
        }

        const xml = extractFlowchartXml();

        if (!xml) {
            toast.error('Unable to extract flowchart data. Please ensure you have created some elements in the flowchart.');
            return;
        }

        console.log('Extracted XML length:', xml.length);
        await saveSolution(xml);
    };

    const toggleValidator = () => {
        setShowValidator(!showValidator);
    };

    if (!sessionId) {
        return <div className="loading-spinner">Initializing editor...</div>;
    }

    const getValidationStatusColor = () => {
        if (!validationResult) return '#666';
        if (validationResult.error) return '#F44336';
        if (validationResult.isValid) return '#4CAF50';
        return '#FF9800';
    };

    const getValidationStatusText = () => {
        if (!validationResult) return 'Not validated';
        if (validationResult.error) return 'Validation error';
        if (validationResult.isValid) return `Valid (${validationResult.score}%)`;
        return `Issues found (${validationResult.score}%)`;
    };

    return (
        <div className="solution-editor-container">
            <div className="solution-editor-header">
                <div className="header-main">
                    <h2>
                        {solutionId ? 'Edit Solution' : 'Create New Solution'}
                    </h2>
                    <p>Problem: {problem.title}</p>
                </div>

                <div className="header-actions">
                    <div className="validation-status" style={{ color: getValidationStatusColor() }}>
                        <span>Status: {getValidationStatusText()}</span>
                    </div>

                    <button
                        onClick={toggleValidator}
                        className={`btn ${showValidator ? 'btn-primary' : 'btn-outline'}`}
                        style={{ marginRight: '8px' }}
                    >
                        {showValidator ? '🔍 Hide Validator' : '🔍 Show Validator'}
                    </button>

                    <button
                        onClick={onCancel}
                        className="btn btn-secondary"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <div className="solution-editor-workspace">
                <FlowchartEditor
                    ref={flowchartRef}
                    problemId={problem.problem_code}
                    studentNumber="lecturer_user"
                    onSessionChange={() => { }}
                    isLecturerMode={true}
                />

                {showValidator && (
                    <SolutionValidator
                        flowchartRef={flowchartRef}
                        onValidationComplete={handleValidationComplete}
                        showValidation={true}
                    />
                )}

                <div className="solution-save-controls">
                    <div className="save-controls-main">
                        <button
                            onClick={handleSaveClick}
                            disabled={loading}
                            className="btn btn-primary btn-large save-solution-btn"
                        >
                            {loading ? 'Saving Solution...' : 'Save Solution & Generate Formulas'}
                        </button>
                    </div>

                    <div className="save-help-section">
                        <div className="save-help-text">
                            <p>💡 <strong>Tip:</strong> Use the validator above to check if your solution meets basic requirements</p>
                            <p>🎯 <strong>Goal:</strong> Valid solutions help students achieve high scores when they solve correctly</p>
                        </div>

                        {saveAttempted && validationResult && !validationResult.isValid && (
                            <div className="validation-warning">
                                <p style={{ color: '#FF9800' }}>
                                    ⚠️ <strong>Warning:</strong> This solution has validation issues.
                                    Students may struggle to achieve high scores.
                                </p>
                            </div>
                        )}

                        {validationResult && validationResult.isValid && (
                            <div className="validation-success">
                                <p style={{ color: '#4CAF50' }}>
                                    ✅ <strong>Great!</strong> This solution passes validation.
                                    Students can achieve high scores with correct implementations.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .solution-editor-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }

                .solution-editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 20px;
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                }

                .header-main h2 {
                    margin: 0 0 8px 0;
                    color: #333;
                }

                .header-main p {
                    margin: 0;
                    color: #666;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .validation-status {
                    font-size: 14px;
                    font-weight: 500;
                }

                .solution-editor-workspace {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .solution-save-controls {
                    background: #f8f9fa;
                    border-top: 1px solid #dee2e6;
                    padding: 20px;
                }

                .save-controls-main {
                    text-align: center;
                    margin-bottom: 16px;
                }

                .save-solution-btn {
                    padding: 12px 32px;
                    font-size: 16px;
                    font-weight: 600;
                }

                .save-help-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .save-help-text p {
                    margin: 0;
                    font-size: 14px;
                    color: #666;
                }

                .validation-warning, .validation-success {
                    padding: 12px;
                    border-radius: 4px;
                    font-size: 14px;
                }

                .validation-warning {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                }

                .validation-success {
                    background: #d4edda;
                    border: 1px solid #c3e6cb;
                }
            `}</style>
        </div>
    );
};

export default SolutionFlowchartEditor;