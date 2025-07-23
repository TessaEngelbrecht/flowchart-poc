import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import FlowchartEditor from './FlowchartEditor';
import { toast } from 'react-toastify';

const SolutionFlowchartEditor = ({
    problem,
    solutionId,
    onSolutionSaved,
    onCancel
}) => {
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(false);

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

    const saveSolution = async (flowchartXml) => {
        if (!flowchartXml) {
            toast.error('No flowchart data to save');
            return;
        }

        setLoading(true);
        try {
            let result;

            if (solutionId) {
                // Update existing solution
                const { data, error } = await supabase
                    .from('assessment_solutions')
                    .update({ flowchart_xml: flowchartXml })
                    .eq('id', solutionId)
                    .select()
                    .single();

                if (error) throw error;
                result = data;
                toast.success('Solution updated successfully!');
            } else {
                // Create new solution
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
                result = data;
                toast.success('Solution saved successfully! Ready for LTL formula generation.');
            }

            // Log the saved solution for debugging
            console.log('Solution saved to database:', result);

            onSolutionSaved();
        } catch (error) {
            console.error('Error saving solution:', error);
            toast.error('Failed to save solution');
        } finally {
            setLoading(false);
        }
    };

    if (!sessionId) {
        return <div className="loading-spinner">Initializing editor...</div>;
    }

    return (
        <div className="solution-editor-container">
            <div className="solution-editor-header">
                <h2>
                    {solutionId ? 'Edit Solution' : 'Create New Solution'}
                </h2>
                <p>Problem: {problem.title}</p>
                <div className="editor-actions">
                    <button
                        onClick={onCancel}
                        className="btn btn-secondary"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <SolutionFlowchartEditorWrapper
                sessionId={sessionId}
                problem={problem}
                onSave={saveSolution}
                saving={loading}
            />
        </div>
    );
};

// Enhanced wrapper with working XML extraction
const SolutionFlowchartEditorWrapper = ({ sessionId, problem, onSave, saving }) => {
    const flowchartRef = useRef(null);

    // Enhanced function to extract XML from the flowchart editor
    const extractFlowchartXml = () => {
        try {
            // Method 1: Use ref if FlowchartEditor exposes getGraphXml
            if (flowchartRef.current && flowchartRef.current.getGraphXml) {
                const xml = flowchartRef.current.getGraphXml();
                if (xml) return xml;
            }

            // Method 2: Access graph directly from FlowchartEditor instance
            if (flowchartRef.current && flowchartRef.current.graph) {
                const graph = flowchartRef.current.graph;

                // Import mxGraph utilities if available globally
                if (window.mxCodec && window.mxUtils) {
                    const encoder = new window.mxCodec();
                    const node = encoder.encode(graph.getModel());
                    return window.mxUtils.getXml(node);
                }
            }

            // Method 3: Check for saved snapshot data
            const savedSnapshot = localStorage.getItem(`flowchart_${sessionId}`);
            if (savedSnapshot) {
                return savedSnapshot;
            }

            return null;
        } catch (error) {
            console.error('Error extracting flowchart XML:', error);
            return null;
        }
    };

    const handleSaveClick = async () => {
        // First try to save a snapshot using the existing save mechanism
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
        await onSave(xml);
    };

    return (
        <div className="solution-flowchart-wrapper">
            <FlowchartEditor
                ref={flowchartRef}
                problemId={problem.problem_code}
                userId="lecturer_user"
                sessionId={sessionId}
                isLecturerMode={true}
            />

            <div className="solution-save-controls">
                <button
                    onClick={handleSaveClick}
                    disabled={saving}
                    className="btn btn-primary btn-large"
                >
                    {saving ? 'Saving Solution...' : 'Save Solution to Database'}
                </button>
                <p className="save-help-text">
                    This will save your flowchart structure for LTL formula generation
                </p>
            </div>
        </div>
    );
};

export default SolutionFlowchartEditor;
