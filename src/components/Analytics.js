import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FiClock, FiActivity, FiTrendingUp, FiList } from 'react-icons/fi';

const Analytics = ({ sessionId }) => {
    const [analytics, setAnalytics] = useState(null);
    const [, setActions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Enhanced calculations
    const calculateMetrics = useCallback((actionsData) => {
        if (!actionsData || actionsData.length === 0) return null;

        //const actionTypes = ['add_node', 'delete_node', 'edit_label', 'move_node', 'connect_nodes'];

        // Time calculations
        const firstActionTime = new Date(actionsData[0].timestamp);
        const lastActionTime = new Date(actionsData[actionsData.length - 1].timestamp);
        const totalSessionTime = Math.round((lastActionTime - firstActionTime) / 1000);

        // Action frequency
        const actionCounts = actionsData.reduce((acc, action) => {
            acc[action.action_type] = (acc[action.action_type] || 0) + 1;
            return acc;
        }, {});

        // Efficiency metrics
        const addActions = actionCounts.add_node || 0;
        const deleteActions = actionCounts.delete_node || 0;
        const efficiency = addActions > 0
            ? Math.round(((addActions - deleteActions) / addActions) * 100)
            : 0;

        // Time between actions
        const timeBetweenActions = actionsData.slice(1).map((action, index) => {
            return (new Date(action.timestamp) - new Date(actionsData[index].timestamp)) / 1000;
        });

        // Revision rate
        const revisions = (actionCounts.edit_label || 0) + (actionCounts.delete_node || 0);
        const revisionRate = actionsData.length > 0
            ? Math.round((revisions / actionsData.length) * 100)
            : 0;

        // Action sequence analysis
        const actionSequence = actionsData.map(action => action.action_type);
        const uniqueActions = [...new Set(actionSequence)].length;

        return {
            totalSessionTime,
            totalActions: actionsData.length,
            actionBreakdown: actionCounts,
            efficiency,
            revisionRate,
            avgTimeBetweenActions: timeBetweenActions.length > 0
                ? Math.round(timeBetweenActions.reduce((a, b) => a + b, 0) / timeBetweenActions.length)
                : 0,
            actionTypesUsed: uniqueActions,
            firstActionTimestamp: actionsData[0].timestamp,
            lastActionTimestamp: actionsData[actionsData.length - 1].timestamp,
            rawData: actionsData
        };
    }, []);

    const loadAnalytics = useCallback(async () => {
        if (!sessionId) return;

        setLoading(true);
        try {
            const { data: actionsData, error } = await supabase
                .from('user_actions')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (error) throw error;

            setActions(actionsData);
            setAnalytics(calculateMetrics(actionsData));
        } catch (error) {
            console.error('Analytics error:', error);
        } finally {
            setLoading(false);
        }
    }, [sessionId, calculateMetrics]);

    useEffect(() => {
        if (sessionId) {
            loadAnalytics();
            const interval = setInterval(loadAnalytics, 5000);
            return () => clearInterval(interval);
        }
    }, [sessionId, loadAnalytics]);

    // AI Analysis Preparation
    const prepareAIData = () => {
        if (!analytics) return null;

        return {
            session_id: sessionId,
            timeline: analytics.rawData.map(action => ({
                timestamp: action.timestamp,
                action_type: action.action_type,
                element_type: action.element_type,
                position: action.position,
                details: action.details
            })),
            metrics: {
                efficiency: analytics.efficiency,
                revision_rate: analytics.revisionRate,
                action_distribution: analytics.actionBreakdown,
                time_analysis: {
                    total_session_time: analytics.totalSessionTime,
                    average_action_interval: analytics.avgTimeBetweenActions
                }
            }
        };
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (!analytics) return <div className="bg-white rounded-lg shadow p-6">No analytics data available</div>;

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Session Analytics</h2>
                <button
                    onClick={() => console.log('AI Analysis:', prepareAIData())}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    Prepare AI Analysis
                </button>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    icon={<FiClock className="w-6 h-6" />}
                    title="Total Session Time"
                    value={`${analytics.totalSessionTime}s`}
                    trend={analytics.avgTimeBetweenActions}
                    trendLabel="Avg. Time/Action"
                />
                <MetricCard
                    icon={<FiActivity className="w-6 h-6" />}
                    title="Total Actions"
                    value={analytics.totalActions}
                    trend={analytics.actionTypesUsed}
                    trendLabel="Unique Actions"
                />
                <MetricCard
                    icon={<FiTrendingUp className="w-6 h-6" />}
                    title="Efficiency Score"
                    value={`${analytics.efficiency}%`}
                    trend={analytics.revisionRate}
                    trendLabel="Revision Rate"
                />
            </div>

            {/* Action Distribution Chart */}
            <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiList className="text-blue-600" /> Action Distribution
                </h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(analytics.actionBreakdown).map(([action, count]) => ({ action, count }))}>
                            <XAxis dataKey="action" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#3b82f6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Time Analysis Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Action Timeline</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {analytics.rawData.slice(-10).reverse().map((action, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                                <div>
                                    <span className="font-medium capitalize">{action.action_type.replace('_', ' ')}</span>
                                    <span className="text-gray-500 text-sm ml-2">
                                        {new Date(action.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <span className="text-sm text-gray-500">
                                    {action.element_type}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Time Analysis</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span>Average Time Between Actions</span>
                            <span className="font-medium">{analytics.avgTimeBetweenActions}s</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Most Active Period</span>
                            <span className="font-medium">
                                {new Date(analytics.firstActionTimestamp).toLocaleTimeString()} -
                                {new Date(analytics.lastActionTimestamp).toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ icon, title, value, trend, trendLabel }) => (
    <div className="bg-gray-50 p-6 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 rounded-full">{icon}</div>
            <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-3xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
        <div className="border-t pt-4">
            <span className="text-sm text-gray-600">{trendLabel}: </span>
            <span className="font-medium text-blue-600">{trend}</span>
        </div> 
    </div>
);

export default Analytics;
