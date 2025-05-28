import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const Analytics = ({ sessionId }) => {
    const [analytics, setAnalytics] = useState(null);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(false);

    const calculatePlanningTime = useCallback((actionsData) => {
        if (actionsData.length < 2) return 0;

        const firstAction = new Date(actionsData[0].timestamp);
        const secondAction = new Date(actionsData[1].timestamp);

        return Math.round((secondAction - firstAction) / 1000);
    }, []);

    const calculateEfficiency = useCallback((actionsData) => {
        const addActions = actionsData.filter(a => a.action_type === 'add_node').length;
        const deleteActions = actionsData.filter(a => a.action_type === 'delete_node').length;

        if (addActions === 0) return 0;
        return Math.round(((addActions - deleteActions) / addActions) * 100);
    }, []);

    const calculateAnalytics = useCallback((actionsData) => {
        if (!actionsData || actionsData.length === 0) {
            setAnalytics({
                totalTime: 0,
                totalActions: 0,
                revisionCount: 0,
                actionBreakdown: {},
                planningTime: 0,
                efficiency: 0
            });
            return;
        }

        const totalTime = actionsData.length > 0
            ? new Date(actionsData[actionsData.length - 1].timestamp) - new Date(actionsData[0].timestamp)
            : 0;

        const actionCounts = actionsData.reduce((acc, action) => {
            acc[action.action_type] = (acc[action.action_type] || 0) + 1;
            return acc;
        }, {});

        const revisionCount = (actionCounts.edit_label || 0) + (actionCounts.delete_node || 0);

        setAnalytics({
            totalTime: Math.round(totalTime / 1000),
            totalActions: actionsData.length,
            revisionCount,
            actionBreakdown: actionCounts,
            planningTime: calculatePlanningTime(actionsData),
            efficiency: calculateEfficiency(actionsData)
        });
    }, [calculatePlanningTime, calculateEfficiency]);

    const loadAnalytics = useCallback(async () => {
        if (!sessionId) {
            console.log('No session ID for analytics');
            return;
        }

        setLoading(true);
        try {
            console.log('Loading analytics for session:', sessionId);

            const { data: actionsData, error } = await supabase
                .from('user_actions')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp');

            if (error) {
                console.error('Error loading analytics:', error);
                return;
            }

            console.log('Loaded actions:', actionsData);

            if (actionsData) {
                setActions(actionsData);
                calculateAnalytics(actionsData);
            }
        } catch (error) {
            console.error('Error in loadAnalytics:', error);
        } finally {
            setLoading(false);
        }
    }, [sessionId, calculateAnalytics]);

    useEffect(() => {
        if (sessionId) {
            loadAnalytics();
            // **FIXED: More frequent updates for real-time analytics**
            const interval = setInterval(loadAnalytics, 3000);
            return () => clearInterval(interval);
        }
    }, [sessionId, loadAnalytics]);

    if (loading && !analytics) {
        return (
            <div className="bg-white rounded-lg shadow p-4">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold mb-2">Session Analytics</h3>
                <p className="text-gray-500 text-sm">No data available yet. Start creating your flowchart!</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4">
                <h3 className="text-lg font-semibold mb-4">Real-time Analytics (Updates every 3s)</h3>

                {/* Metrics Row */}
                <div className="grid grid-cols-6 gap-4 mb-4">
                    <div className="text-center bg-blue-50 p-3 rounded">
                        <div className="text-xl font-bold text-blue-600">{analytics.totalTime}s</div>
                        <div className="text-xs text-gray-600">Total Time</div>
                    </div>
                    <div className="text-center bg-green-50 p-3 rounded">
                        <div className="text-xl font-bold text-green-600">{analytics.totalActions}</div>
                        <div className="text-xs text-gray-600">Actions</div>
                    </div>
                    <div className="text-center bg-yellow-50 p-3 rounded">
                        <div className="text-xl font-bold text-yellow-600">{analytics.revisionCount}</div>
                        <div className="text-xs text-gray-600">Revisions</div>
                    </div>
                    <div className="text-center bg-purple-50 p-3 rounded">
                        <div className="text-xl font-bold text-purple-600">{analytics.efficiency}%</div>
                        <div className="text-xs text-gray-600">Efficiency</div>
                    </div>
                    <div className="text-center bg-indigo-50 p-3 rounded">
                        <div className="text-xl font-bold text-indigo-600">{analytics.planningTime}s</div>
                        <div className="text-xs text-gray-600">Planning</div>
                    </div>
                    <div className="text-center bg-gray-50 p-3 rounded">
                        <div className="text-xl font-bold text-gray-600">{actions.length}</div>
                        <div className="text-xs text-gray-600">Events</div>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Action Breakdown */}
                    {Object.keys(analytics.actionBreakdown).length > 0 && (
                        <div className="flex-1">
                            <h4 className="font-medium mb-2">Action Breakdown</h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                                {Object.entries(analytics.actionBreakdown).map(([action, count]) => (
                                    <div key={action} className="flex justify-between text-sm">
                                        <span className="capitalize">{action.replace('_', ' ')}</span>
                                        <span className="font-medium">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Actions */}
                    {actions.length > 0 && (
                        <div className="flex-1">
                            <h4 className="font-medium mb-2">Recent Actions</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-50 p-2 rounded">
                                {actions.slice(-10).map((action, index) => (
                                    <div key={index} className="text-xs py-1 px-2 bg-white rounded border">
                                        <span className="font-medium text-blue-600">{action.action_type}</span>
                                        <span className="text-gray-500 ml-2">
                                            {new Date(action.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
