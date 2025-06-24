import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import ActionFlowchart from './ActionFlowchart';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const SessionGraph = () => {
    const [sessionId, setSessionId] = useState('');
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchSessionActions = async () => {
        if (!sessionId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_actions')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (error) throw error;

            // Format actions with descriptive element types
            const formattedData = data.map(action => ({
                ...action,
                element_type: action.element_type || 'element'
            }));

            setActions(formattedData);
        } catch (error) {
            console.error('Error fetching actions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') fetchSessionActions();
    };

    const saveLinearDiagram = async () => {
        if (!sessionId || actions.length === 0) {
            toast.warning('No actions to save');
            return;
        }

        setSaving(true);
        try {
            // Format actions for LTL analysis
            const linearPattern = actions.map(action => ({
                action_type: action.action_type,
                element_type: action.element_type,
                label: action.details?.cell_value || action.details?.new_label || '',
                timestamp: action.timestamp
            }));

            const { error } = await supabase
                .from('linear_diagrams')
                .insert([{
                    session_id: sessionId,
                    linear_pattern: linearPattern
                }]);

            if (error) throw error;
            toast.success('Linear diagram saved to database!');
        } catch (error) {
            console.error('Error saving linear diagram:', error);
            toast.error('Failed to save linear diagram');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="session-graph">
            <div className="session-input-container">
                <input
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter Session ID and press Enter"
                    className="session-input"
                />
                {loading && <span>Loading...</span>}
            </div>

            {actions.length > 0 && (
                <div className="graph-container">
                    <h3>User Action Timeline</h3>
                    <ActionFlowchart actions={actions} />

                    <button
                        onClick={saveLinearDiagram}
                        disabled={saving}
                        className="save-diagram-btn"
                    >
                        {saving ? 'Saving...' : 'Save Linear Diagram'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SessionGraph;