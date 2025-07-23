import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';

// Simple ID generator (you can also use nanoid package)
const generateProblemCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};

const LecturerProblemForm = ({ onCreated }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            toast.error('Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const problemCode = generateProblemCode();
            const { data, error } = await supabase
                .from('assessment_problems')
                .insert([{
                    title: title.trim(),
                    description: description.trim(),
                    problem_code: problemCode,
                    created_by: 'lecturer_user' // You can replace with actual user ID
                }])
                .select()
                .single();

            if (error) throw error;

            toast.success(`Problem created! Code: ${problemCode}`);
            onCreated(data);
        } catch (error) {
            console.error('Error creating problem:', error);
            toast.error('Failed to create problem');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="problem-form-container">
            <div className="problem-form">
                <h2 className="form-title">Create Assessment Problem</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="title" className="form-label">
                            Problem Title *
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Calculate Sum of Numbers"
                            required
                            className="form-input"
                            maxLength={100}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description" className="form-label">
                            Problem Instructions *
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the problem that students need to solve using a flowchart..."
                            required
                            className="form-textarea"
                            rows={6}
                            maxLength={1000}
                        />
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            {loading ? 'Creating...' : 'Create Problem'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LecturerProblemForm;
