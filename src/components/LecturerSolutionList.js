import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';

const LecturerSolutionList = ({
    problem,
    onCreateSolution,
    onEditSolution,
    onBackToProblems
}) => {
    const [solutions, setSolutions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSolutions();
    }, [problem.id]);

    const fetchSolutions = async () => {
        try {
            const { data, error } = await supabase
                .from('assessment_solutions')
                .select('*')
                .eq('problem_id', problem.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSolutions(data || []);
        } catch (error) {
            console.error('Error fetching solutions:', error);
            toast.error('Failed to load solutions');
        } finally {
            setLoading(false);
        }
    };

    const deleteSolution = async (solutionId) => {
        if (!window.confirm('Are you sure you want to delete this solution?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('assessment_solutions')
                .delete()
                .eq('id', solutionId);

            if (error) throw error;

            setSolutions(solutions.filter(s => s.id !== solutionId));
            toast.success('Solution deleted');
        } catch (error) {
            console.error('Error deleting solution:', error);
            toast.error('Failed to delete solution');
        }
    };

    const copyProblemCode = () => {
        navigator.clipboard.writeText(problem.problem_code);
        toast.success('Problem code copied to clipboard!');
    };

    if (loading) {
        return <div className="loading-spinner">Loading solutions...</div>;
    }

    return (
        <div className="solution-list-container">
            <div className="solution-list">
                <div className="solution-list-header">
                    <div>
                        <h2>{problem.title}</h2>
                        <p className="problem-description">{problem.description}</p>
                        <div className="problem-code-display">
                            <span>Problem Code: </span>
                            <code className="problem-code">{problem.problem_code}</code>
                            <button
                                onClick={copyProblemCode}
                                className="btn btn-small"
                                title="Copy to clipboard"
                            >
                                📋
                            </button>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            onClick={onCreateSolution}
                            className="btn btn-primary"
                        >
                            + Add Solution
                        </button>
                        <button
                            onClick={onBackToProblems}
                            className="btn btn-secondary"
                        >
                            Create a new Problem
                        </button>
                    </div>
                </div>

                <div className="solutions-grid">
                    {solutions.length === 0 ? (
                        <div className="empty-state">
                            <p>No solutions created yet.</p>
                            <button onClick={onCreateSolution} className="btn btn-primary">
                                Create First Solution
                            </button>
                        </div>
                    ) : (
                        solutions.map((solution, index) => (
                            <div key={solution.id} className="solution-card">
                                <div className="solution-card-header">
                                    <h3>Solution {index + 1}</h3>
                                    <span className="solution-date">
                                        {new Date(solution.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="solution-card-content">
                                    <p>Created on {new Date(solution.created_at).toLocaleString()}</p>
                                </div>
                                <div className="solution-card-actions">
                                    <button
                                        onClick={() => deleteSolution(solution.id)}
                                        className="btn btn-small btn-danger"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default LecturerSolutionList;
