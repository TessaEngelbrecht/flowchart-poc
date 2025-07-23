import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import FlowchartEditor from './FlowchartEditor';
import { toast } from 'react-toastify';

const StudentInterface = ({ onSessionChange }) => {
    const [problemCode, setProblemCode] = useState('');
    const [currentProblem, setCurrentProblem] = useState(null);
    const [loading, setLoading] = useState(false);

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
            toast.success('Problem loaded successfully!');
        } catch (error) {
            console.error('Error loading problem:', error);
            toast.error('Failed to load problem');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            loadProblem();
        }
    };

    const resetProblem = () => {
        setCurrentProblem(null);
        setProblemCode('');
    };

    if (currentProblem) {
        return (
            <div className="student-interface-container">
                <div className="student-problem-header">
                    <div className="problem-info">
                        <h2>{currentProblem.title}</h2>
                        <p className="problem-description">{currentProblem.description}</p>
                    </div>
                    <button
                        onClick={resetProblem}
                        className="btn btn-secondary"
                    >
                        Change Problem
                    </button>
                </div>

                <div className="student-editor-container">
                    <FlowchartEditor
                        problemId={currentProblem.problem_code}
                        userId="student_user" // You can replace with actual user ID
                        onSessionChange={onSessionChange}
                        isLecturerMode={false}
                    />
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
                        onKeyDown={handleKeyDown}
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

export default StudentInterface;
