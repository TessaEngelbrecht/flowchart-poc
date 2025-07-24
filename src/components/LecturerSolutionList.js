import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LTLService } from '../services/LTLService';
import { toast } from 'react-toastify';

const LecturerSolutionList = ({
    problem,
    onCreateSolution,
    onEditSolution,
    onBackToProblems
}) => {
    const [solutions, setSolutions] = useState([]);
    const [universalFormulas, setUniversalFormulas] = useState([]);
    const [problemFormulas, setProblemFormulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingFormula, setEditingFormula] = useState(null);

    useEffect(() => {
        fetchData();
    }, [problem.id]);

    const fetchData = async () => {
        try {
            // Fetch solutions
            const { data: solutionsData, error: solutionsError } = await supabase
                .from('assessment_solutions')
                .select('*')
                .eq('problem_id', problem.id)
                .order('created_at', { ascending: false });

            if (solutionsError) throw solutionsError;
            setSolutions(solutionsData || []);

            // Fetch universal and problem-specific formulas
            const [universal, problemSpecific] = await Promise.all([
                LTLService.getUniversalFormulas(),
                LTLService.getProblemFormulas(problem.id)
            ]);

            setUniversalFormulas(universal);
            setProblemFormulas(problemSpecific);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleEditFormula = (formula, isUniversal = false) => {
        setEditingFormula({ ...formula, isUniversal });
    };

    const handleSaveFormula = async (updatedFormula) => {
        try {
            await LTLService.updateFormula(
                updatedFormula.id,
                {
                    ltl_expression: updatedFormula.ltl_expression,
                    description: updatedFormula.description,
                    formula_name: updatedFormula.formula_name
                },
                updatedFormula.isUniversal
            );

            // Refresh data
            await fetchData();
            setEditingFormula(null);
            toast.success('Formula updated successfully!');
        } catch (error) {
            console.error('Error updating formula:', error);
            toast.error('Failed to update formula');
        }
    };

    const copyProblemCode = () => {
        navigator.clipboard.writeText(problem.problem_code);
        toast.success('Problem code copied to clipboard!');
    };

    if (loading) {
        return <div className="loading-spinner">Loading...</div>;
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
                            onClick={onBackToProblems}
                            className="btn btn-secondary"
                        >
                            ← Back to Problems
                        </button>
                        <button
                            onClick={onCreateSolution}
                            className="btn btn-primary"
                        >
                            + Add Solution
                        </button>
                    </div>
                </div>

                {/* Solutions Grid */}
                <div className="solutions-section">
                    <h3>Solutions</h3>
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
                                            onClick={() => onEditSolution(solution.id)}
                                            className="btn btn-small btn-outline"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* LTL Formulas Section */}
                <div className="ltl-formulas-section">
                    <h3>LTL Formulas for Assessment</h3>

                    {/* Universal Formulas */}
                    <div className="formula-category">
                        <h4>Universal Formulas (Apply to all flowcharts)</h4>
                        <div className="formulas-grid">
                            {universalFormulas.map(formula => (
                                <FormulaCard
                                    key={formula.id}
                                    formula={formula}
                                    isUniversal={true}
                                    onEdit={() => handleEditFormula(formula, true)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Problem-Specific Formulas */}
                    <div className="formula-category">
                        <h4>Problem-Specific Formulas</h4>
                        {problemFormulas.length === 0 ? (
                            <p className="empty-formulas">
                                No problem-specific formulas yet. Create a solution to generate them automatically.
                            </p>
                        ) : (
                            <div className="formulas-grid">
                                {problemFormulas.map(formula => (
                                    <FormulaCard
                                        key={formula.id}
                                        formula={formula}
                                        isUniversal={false}
                                        onEdit={() => handleEditFormula(formula, false)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Formula Edit Modal */}
            {editingFormula && (
                <FormulaEditModal
                    formula={editingFormula}
                    onSave={handleSaveFormula}
                    onCancel={() => setEditingFormula(null)}
                />
            )}
        </div>
    );
};

const FormulaCard = ({ formula, isUniversal, onEdit }) => (
    <div className="formula-card">
        <div className="formula-header">
            <h5>{formula.formula_name}</h5>
            <span className={`formula-type ${isUniversal ? 'universal' : 'specific'}`}>
                {isUniversal ? 'Universal' : 'Problem-Specific'}
            </span>
        </div>
        <div className="formula-expression">
            <code>{formula.ltl_expression}</code>
        </div>
        <div className="formula-description">
            <p>{formula.description}</p>
        </div>
        <div className="formula-actions">
            <button onClick={onEdit} className="btn btn-small btn-outline">
                Edit
            </button>
        </div>
    </div>
);

const FormulaEditModal = ({ formula, onSave, onCancel }) => {
    const [editedFormula, setEditedFormula] = useState(formula);

    const handleSave = () => {
        onSave(editedFormula);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Edit LTL Formula</h3>
                    <button onClick={onCancel} className="modal-close">×</button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Formula Name</label>
                        <input
                            type="text"
                            value={editedFormula.formula_name}
                            onChange={(e) => setEditedFormula({
                                ...editedFormula,
                                formula_name: e.target.value
                            })}
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>LTL Expression</label>
                        <textarea
                            value={editedFormula.ltl_expression}
                            onChange={(e) => setEditedFormula({
                                ...editedFormula,
                                ltl_expression: e.target.value
                            })}
                            className="form-textarea"
                            rows={3}
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={editedFormula.description}
                            onChange={(e) => setEditedFormula({
                                ...editedFormula,
                                description: e.target.value
                            })}
                            className="form-textarea"
                            rows={2}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onCancel} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="btn btn-primary">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LecturerSolutionList;
