import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Correct mxGraph import using factory function
import mxgraph from 'mxgraph';

const {
    mxGraph,
    mxRubberband,
    mxEvent,
    mxUtils,
    mxCodec,
    mxGraphModel,
    mxGeometry,
    mxClient,
    mxConstants,
    mxCellRenderer,
    mxShape,
    mxKeyHandler,
    mxConnectionConstraint,
    mxPoint,
} = mxgraph({
    mxImageBasePath: 'mxgraph/javascript/src/images',
    mxBasePath: 'mxgraph/javascript/src'
});

// Custom Parallelogram Shape for Input/Output
function ParallelogramShape() {
    mxShape.call(this);
}

ParallelogramShape.prototype = Object.create(mxShape.prototype);
ParallelogramShape.prototype.constructor = ParallelogramShape;

ParallelogramShape.prototype.paintVertexShape = function (c, x, y, w, h) {
    const offset = w * 0.2;

    c.begin();
    c.moveTo(x + offset, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w - offset, y + h);
    c.lineTo(x, y + h);
    c.close();
    c.fillAndStroke();
};

// Custom Document Shape
function DocumentShape() {
    mxShape.call(this);
}

DocumentShape.prototype = Object.create(mxShape.prototype);
DocumentShape.prototype.constructor = DocumentShape;

DocumentShape.prototype.paintVertexShape = function (c, x, y, w, h) {
    const waveHeight = h * 0.1;

    c.begin();
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w, y + h - waveHeight);
    c.curveTo(x + w * 0.75, y + h, x + w * 0.5, y + h - waveHeight * 2, x + w * 0.25, y + h);
    c.curveTo(x + w * 0.125, y + h - waveHeight, x, y + h - waveHeight * 0.5, x, y + h - waveHeight);
    c.close();
    c.fillAndStroke();
};

// Custom Connector Shape
function ConnectorShape() {
    mxShape.call(this);
}

ConnectorShape.prototype = Object.create(mxShape.prototype);
ConnectorShape.prototype.constructor = ConnectorShape;

ConnectorShape.prototype.paintVertexShape = function (c, x, y, w, h) {
    c.begin();
    c.ellipse(x, y, w, h);
    c.fillAndStroke();
};

const FlowchartEditor = ({ problemId, userId }) => {
    const graphContainer = useRef(null);
    const trashCanRef = useRef(null);
    const [graph, setGraph] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [startTime] = useState(Date.now());
    const [draggedElement, setDraggedElement] = useState(null);
    const sessionInitialized = useRef(false);

    const initializeSession = useCallback(async () => {
        if (sessionInitialized.current || sessionId) return;

        try {
            const { data } = await supabase
                .from('flowchart_sessions')
                .insert({
                    user_id: userId,
                    problem_id: problemId
                })
                .select()
                .single();

            if (data) {
                setSessionId(data.id);
                sessionInitialized.current = true;
                toast.success('Session started successfully!');
            }
        } catch (error) {
            toast.error('Failed to start session');
            console.error('Session error:', error);
        }
    }, [userId, problemId, sessionId]);

    const trackAction = useCallback(async (actionType, elementId, elementType, position, details = {}) => {
        if (!sessionId) return;

        try {
            const actionData = {
                session_id: sessionId,
                action_type: actionType,
                element_id: elementId,
                element_type: elementType,
                position: position,
                details: {
                    ...details,
                    time_since_start: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                }
            };

            await supabase
                .from('user_actions')
                .insert(actionData);

        } catch (error) {
            console.error('Tracking error:', error);
        }
    }, [sessionId, startTime]);

    const getElementType = useCallback((cell) => {
        if (!cell || !cell.vertex) return 'connection';

        const style = cell.style || '';
        if (style.includes('start') || style.includes('end')) return 'terminal';
        if (style.includes('decision')) return 'decision';
        if (style.includes('process')) return 'process';
        if (style.includes('input') || style.includes('output')) return 'input_output';
        if (style.includes('document')) return 'document';
        if (style.includes('connector')) return 'connector';
        if (style.includes('text')) return 'text_label'; // **ADDED: Text element type**
        return 'process';
    }, []);

    const setupConnectionConstraints = useCallback((graph) => {
        // **FIXED: Proper connection constraints setup**
        graph.getAllConnectionConstraints = function (terminal) {
            if (terminal != null && terminal.cell != null && this.model.isVertex(terminal.cell)) {
                // Create connection constraints with proper mxPoint and mxConnectionConstraint objects
                return [
                    new mxConnectionConstraint(new mxPoint(0.5, 0), true),    // North
                    new mxConnectionConstraint(new mxPoint(1, 0.25), true),   // Northeast
                    new mxConnectionConstraint(new mxPoint(1, 0.5), true),    // East
                    new mxConnectionConstraint(new mxPoint(1, 0.75), true),   // Southeast
                    new mxConnectionConstraint(new mxPoint(0.5, 1), true),    // South
                    new mxConnectionConstraint(new mxPoint(0, 0.75), true),   // Southwest
                    new mxConnectionConstraint(new mxPoint(0, 0.5), true),    // West
                    new mxConnectionConstraint(new mxPoint(0, 0.25), true)    // Northwest
                ];
            }
            return null;
        };

        // Enable connections and constraint handling
        graph.setConnectable(true);
        graph.setAllowDanglingEdges(false);

        // **FIXED: Ensure constraint handler is properly enabled**
        if (graph.connectionHandler && graph.connectionHandler.constraintHandler) {
            graph.connectionHandler.constraintHandler.enabled = true;
        }

        // **FIXED: Override constraint handler intersection for better snapping**
        if (typeof mxgraph().mxConstraintHandler !== 'undefined') {
            const mxConstraintHandler = mxgraph().mxConstraintHandler;
            mxConstraintHandler.prototype.intersects = function (icon, point, source, existingEdge) {
                if (!icon || !icon.bounds || !point) return false;
                return (!source || existingEdge) || mxUtils.intersects(icon.bounds, point);
            };
        }
    }, []);

    const registerCustomShapes = useCallback(() => {
        mxCellRenderer.registerShape('parallelogram', ParallelogramShape);
        mxCellRenderer.registerShape('document', DocumentShape);
        mxCellRenderer.registerShape('connector', ConnectorShape);
    }, []);

    const setupTrashCan = useCallback((graph) => {
        if (!trashCanRef.current) return;

        trashCanRef.current.addEventListener('dragover', (e) => {
            e.preventDefault();
            trashCanRef.current.style.backgroundColor = '#ff6b6b';
            trashCanRef.current.style.transform = 'scale(1.1)';
        });

        trashCanRef.current.addEventListener('dragleave', (e) => {
            e.preventDefault();
            trashCanRef.current.style.backgroundColor = '#dc3545';
            trashCanRef.current.style.transform = 'scale(1)';
        });

        trashCanRef.current.addEventListener('drop', (e) => {
            e.preventDefault();
            trashCanRef.current.style.backgroundColor = '#dc3545';
            trashCanRef.current.style.transform = 'scale(1)';

            if (draggedElement) {
                graph.removeCells([draggedElement]);
                setDraggedElement(null);
                toast.success('Element deleted successfully!');
            }
        });
    }, [draggedElement]);

    const initializeGraph = useCallback(() => {
        if (!graphContainer.current || graph) return;

        if (!mxClient.isBrowserSupported()) {
            mxUtils.error('Browser is not supported!', 200, false);
            return;
        }

        try {
            const newGraph = new mxGraph(graphContainer.current);

            // **KEEP ARROW STYLING EXACTLY AS SPECIFIED**
            const style = newGraph.getStylesheet().getDefaultEdgeStyle();
            style[mxConstants.STYLE_STROKECOLOR] = '#000000'; // Black arrows
            style[mxConstants.STYLE_STROKEWIDTH] = 2; // Thicker lines
            style[mxConstants.STYLE_ENDARROW] = mxConstants.ARROW_CLASSIC; // Arrow heads
            style[mxConstants.STYLE_STARTARROW] = mxConstants.NONE; // No start arrow
            style[mxConstants.STYLE_EDGE] = mxConstants.EDGESTYLE_ORTHOGONAL; // Clean edges

            // Enable connections and drag/drop
            newGraph.setConnectable(true);
            newGraph.setAllowDanglingEdges(false);
            new mxRubberband(newGraph);

            // Enable keyboard shortcuts for deletion
            const keyHandler = new mxKeyHandler(newGraph);
            keyHandler.bindKey(46, function (evt) { // Delete key
                if (newGraph.isEnabled()) {
                    newGraph.removeCells();
                    toast.info('Selected elements deleted');
                }
            });
            keyHandler.bindKey(8, function (evt) { // Backspace key for Mac
                if (newGraph.isEnabled()) {
                    newGraph.removeCells();
                    toast.info('Selected elements deleted');
                }
            });

            // Track cell additions
            newGraph.addListener(mxEvent.CELLS_ADDED, function (sender, evt) {
                const cells = evt.getProperty('cells');
                if (cells) {
                    cells.forEach(cell => {
                        if (cell.vertex) {
                            const position = cell.geometry ? { x: cell.geometry.x, y: cell.geometry.y } : null;
                            trackAction(
                                'add_node',
                                cell.id,
                                getElementType(cell),
                                position,
                                {
                                    cell_value: cell.value,
                                    width: cell.geometry?.width,
                                    height: cell.geometry?.height
                                }
                            );
                            toast.info(`Added ${getElementType(cell)} element`);
                        } else if (cell.edge) {
                            trackAction(
                                'connect_nodes',
                                cell.id,
                                'connection',
                                null,
                                {
                                    source: cell.source?.id,
                                    target: cell.target?.id,
                                    cell_value: cell.value
                                }
                            );
                            toast.success('Elements connected with arrow!');
                        }
                    });
                }
            });

            // Track cell movements
            newGraph.addListener(mxEvent.CELLS_MOVED, function (sender, evt) {
                const cells = evt.getProperty('cells');
                if (cells && cells.length > 0) {
                    setDraggedElement(cells[0]);

                    const dx = evt.getProperty('dx') || 0;
                    const dy = evt.getProperty('dy') || 0;

                    cells.forEach(cell => {
                        if (cell.vertex && cell.geometry) {
                            trackAction(
                                'move_node',
                                cell.id,
                                getElementType(cell),
                                {
                                    x: cell.geometry.x,
                                    y: cell.geometry.y,
                                    dx: dx,
                                    dy: dy
                                },
                                {
                                    cell_value: cell.value,
                                    move_distance: Math.sqrt(dx * dx + dy * dy)
                                }
                            );
                        }
                    });
                }
            });

            // Track other events
            newGraph.addListener(mxEvent.CELLS_REMOVED, function (sender, evt) {
                const cells = evt.getProperty('cells');
                if (cells) {
                    cells.forEach(cell => {
                        trackAction(
                            'delete_node',
                            cell.id,
                            getElementType(cell),
                            null,
                            { cell_value: cell.value }
                        );
                        toast.warning('Element deleted');
                    });
                }
            });

            newGraph.addListener(mxEvent.LABEL_CHANGED, function (sender, evt) {
                const cell = evt.getProperty('cell');
                const newValue = evt.getProperty('value');
                const oldValue = evt.getProperty('old');

                if (cell) {
                    trackAction(
                        'edit_label',
                        cell.id,
                        getElementType(cell),
                        null,
                        { new_label: newValue, old_label: oldValue }
                    );
                    toast.info('Label updated');
                }
            });

            setGraph(newGraph);
            console.log('Graph initialized with visible arrows');
        } catch (error) {
            console.error('Error initializing graph:', error);
            toast.error('Failed to initialize flowchart editor');
        }
    }, [trackAction, getElementType, graph, registerCustomShapes, setupConnectionConstraints, setupTrashCan]);

    useEffect(() => {
        if (!sessionInitialized.current) {
            initializeSession();
        }
    }, [initializeSession]);

    useEffect(() => {
        if (!graph && sessionId) {
            initializeGraph();
        }
    }, [initializeGraph, graph, sessionId]);

    const addFlowchartElement = useCallback((elementType) => {
        if (!graph) {
            toast.warning('Graph not ready yet');
            return;
        }

        const parent = graph.getDefaultParent();
        let style, width, height, label;

        switch (elementType) {
            case 'start':
                style = 'shape=ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;';
                width = 100;
                height = 50;
                label = 'Start';
                break;
            case 'end':
                style = 'shape=ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=2;';
                width = 100;
                height = 50;
                label = 'End';
                break;
            case 'process':
                style = 'shape=rect;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;';
                width = 120;
                height = 60;
                label = 'Process';
                break;
            case 'decision':
                style = 'shape=rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;';
                width = 120;
                height = 80;
                label = 'Decision?';
                break;
            case 'input':
                style = 'shape=parallelogram;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=2;';
                width = 120;
                height = 60;
                label = 'Input';
                break;
            case 'output':
                style = 'shape=parallelogram;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=2;';
                width = 120;
                height = 60;
                label = 'Output';
                break;
            case 'document':
                style = 'shape=document;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;strokeWidth=2;';
                width = 100;
                height = 70;
                label = 'Document';
                break;
            case 'connector':
                style = 'shape=connector;whiteSpace=wrap;html=1;fillColor=#ffcc99;strokeColor=#ff9900;strokeWidth=2;';
                width = 30;
                height = 30;
                label = '';
                break;
            case 'predefined':
                style = 'shape=rect;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;rounded=1;strokeWidth=2;';
                width = 120;
                height = 60;
                label = 'Predefined';
                break;
            // **ADDED: Text element for arrow labeling**
            case 'text':
                style = 'text;html=1;align=center;verticalAlign=middle;resizable=1;points=[];autosize=1;strokeColor=none;fillColor=none;fontSize=12;fontColor=#000000;';
                width = 40;
                height = 20;
                label = 'Text';
                break;
            default:
                return;
        }

        const existingCells = graph.getChildVertices(parent);
        const x = 50 + (existingCells.length % 6) * 140;
        const y = 50 + Math.floor(existingCells.length / 6) * 100;

        graph.getModel().beginUpdate();
        try {
            graph.insertVertex(parent, null, label, x, y, width, height, style);
        } finally {
            graph.getModel().endUpdate();
        }
    }, [graph]);

    const saveSnapshot = useCallback(async () => {
        if (!graph || !sessionId) {
            toast.warning('No session or graph available to save');
            return;
        }

        try {
            window['mxGraphModel'] = mxGraphModel;
            window['mxGeometry'] = mxGeometry;

            const encoder = new mxCodec();
            const node = encoder.encode(graph.getModel());
            const xml = mxUtils.getXml(node);

            const { data, error } = await supabase
                .from('flowchart_snapshots')
                .insert({
                    session_id: sessionId,
                    snapshot_data: { xml },
                    trigger_event: 'manual_save'
                });

            if (error) {
                console.error('Save error:', error);
                toast.error('Failed to save flowchart');
            } else {
                toast.success('Flowchart saved successfully!');
            }
        } catch (error) {
            toast.error('Failed to save flowchart');
            console.error('Save error:', error);
        }
    }, [graph, sessionId]);

    const clearCanvas = useCallback(() => {
        if (!graph) return;

        graph.getModel().beginUpdate();
        try {
            graph.removeCells(graph.getChildVertices(graph.getDefaultParent()));
            graph.removeCells(graph.getChildEdges(graph.getDefaultParent()));
            toast.info('Canvas cleared');
        } finally {
            graph.getModel().endUpdate();
        }
    }, [graph]);

    const deleteSelected = useCallback(() => {
        if (!graph) return;

        const cells = graph.getSelectionCells();
        if (cells.length > 0) {
            graph.removeCells(cells);
            toast.info('Selected elements deleted');
        } else {
            toast.warning('No elements selected');
        }
    }, [graph]);

    const [currentSession, setCurrentSession] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(true);

    const startNewSession = useCallback(() => {
        // Clear the current session to force a new one
        setCurrentSession(null);
        // Force re-render which will create new session
        setTimeout(() => {
            window.location.reload();
        }, 100);
    }, []);

    const handleSessionChange = useCallback((sessionId) => {
        setCurrentSession(sessionId);
    }, []);

    return (
        <div className="flex h-screen bg-gray-50 full-container-things">
            {/* Info and Elements Column */}
            <div className='full-container-things'>
                <div className="w-80 bg-white border-r border-gray-300 p-4 shadow-sm overflow-y-auto left-column">
                    <div className="flex gap-2">
                                <button
                                  onClick={startNewSession}
                                  className="px-3 py-1 bg-blue-500 rounded text-sm hover:bg-blue-400 transition-colors"
                                >
                                  🔄 New Session
                                </button>
                                <button
                                  onClick={() => setShowAnalytics(!showAnalytics)}
                                  className="px-3 py-1 bg-green-500 rounded text-sm hover:bg-green-400 transition-colors"
                                >
                                  {showAnalytics ? 'Hide' : 'Show'} Analytics
                                </button>
                              </div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Flowchart Elements</h3>

                    <div className="space-y-4">
                        {/* Terminal Elements */}
                        <div className="bg-gray-100 p-3 rounded">
                            <h4 className="text-sm font-medium text-gray-600 mb-3">Terminal Elements</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => addFlowchartElement('start')}
                                    className="p-3 bg-green-100 border border-green-300 rounded-full text-sm hover:bg-green-200 transition-colors flex items-center justify-center"
                                >
                                    🟢 Start
                                </button>
                                <button
                                    onClick={() => addFlowchartElement('end')}
                                    className="p-3 bg-red-100 border border-red-300 rounded-full text-sm hover:bg-red-200 transition-colors flex items-center justify-center"
                                >
                                    🔴 End
                                </button>
                            </div>
                        </div>

                        {/* Process Elements */}
                        <div className="bg-gray-100 p-3 rounded">
                            <h4 className="text-sm font-medium text-gray-600 mb-3">Process Elements</h4>
                            <div className="space-y-2">
                                <button
                                    onClick={() => addFlowchartElement('process')}
                                    className="w-full p-3 bg-blue-100 border border-blue-300 text-sm hover:bg-blue-200 transition-colors"
                                >
                                    📦 Process
                                </button>
                                <button
                                    onClick={() => addFlowchartElement('decision')}
                                    className="w-full p-3 bg-yellow-100 border border-yellow-300 text-sm hover:bg-yellow-200 transition-colors"
                                >
                                    💎 Decision
                                </button>
                                <button
                                    onClick={() => addFlowchartElement('predefined')}
                                    className="w-full p-3 bg-orange-100 border border-orange-300 rounded text-sm hover:bg-orange-200 transition-colors"
                                >
                                    📋 Predefined
                                </button>
                            </div>
                        </div>

                        {/* Input/Output Elements */}
                        <div className="bg-gray-100 p-3 rounded">
                            <h4 className="text-sm font-medium text-gray-600 mb-3">Input/Output</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => addFlowchartElement('input')}
                                    className="p-3 bg-purple-100 border border-purple-300 text-sm hover:bg-purple-200 transition-colors"
                                >
                                    📥 Input
                                </button>
                                <button
                                    onClick={() => addFlowchartElement('output')}
                                    className="p-3 bg-purple-100 border border-purple-300 text-sm hover:bg-purple-200 transition-colors"
                                >
                                    📤 Output
                                </button>
                            </div>
                        </div>

                        {/* Special Elements */}
                        <div className="bg-gray-100 p-3 rounded">
                            <h4 className="text-sm font-medium text-gray-600 mb-3">Special Elements</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => addFlowchartElement('document')}
                                    className="p-3 bg-gray-200 border border-gray-400 text-sm hover:bg-gray-300 transition-colors"
                                >
                                    📄 Document
                                </button>
                                <button
                                    onClick={() => addFlowchartElement('connector')}
                                    className="p-3 bg-orange-100 border border-orange-300 rounded-full text-sm hover:bg-orange-200 transition-colors"
                                >
                                    🔗 Connector
                                </button>
                            </div>
                            {/* **ADDED: Text element button** */}
                            <button
                                onClick={() => addFlowchartElement('text')}
                                className="w-full mt-2 p-3 bg-cyan-100 border border-cyan-300 text-sm hover:bg-cyan-200 transition-colors"
                            >
                                📝 Text Label
                            </button>
                        </div>

                        {/* Trash Can */}
                        <div className="bg-red-50 p-3 rounded border-2 border-dashed border-red-300">
                            <h4 className="text-sm font-medium text-red-600 mb-2">Delete Zone</h4>
                            <div
                                ref={trashCanRef}
                                className="w-full h-16 bg-red-500 rounded flex items-center justify-center text-white font-bold text-lg cursor-pointer hover:bg-red-600 transition-colors"
                            >
                                🗑️ Drop to Delete
                            </div>
                            <p className="text-xs text-red-600 mt-1 text-center">
                                Drag elements here to delete them
                            </p>
                        </div>

                        {/* Instructions */}
                        <div className="bg-blue-50 p-3 rounded">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">Instructions</h4>
                            <div className="text-xs text-blue-700 space-y-1">
                                <p>• Click elements to add them to canvas</p>
                                <p>• Drag elements to move them</p>
                                <p>• Hover over connection points to connect</p>
                                <p>• Click and drag between elements for arrows</p>
                                <p>• Double-click to edit labels</p>
                                <p>• Use Text Label for arrow conditions (Yes/No)</p>
                                <p>• Drag to trash can to delete</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 space-y-2">
                        <button
                            onClick={saveSnapshot}
                            className="w-full px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
                        >
                            💾 Save Flowchart
                        </button>
                        <button
                            onClick={deleteSelected}
                            className="w-full px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                        >
                            🗑️ Delete Selected
                        </button>
                        <button
                            onClick={clearCanvas}
                            className="w-full px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                        >
                            🧹 Clear All
                        </button>
                    </div>
                </div>
                <div className='right-column'>
                    {/* Main Canvas Area */}
                    <div className="flex-1 flex flex-col">
                        {/* Canvas */}
                        <div className="flex-1 p-4">
                            <div
                                ref={graphContainer}
                                className="w-full h-full border-2 border-gray-300 rounded-lg bg-white"
                                style={{
                                    background: `
                    radial-gradient(circle, #e5e7eb 1px, transparent 1px),
                    radial-gradient(circle, #e5e7eb 1px, transparent 1px)
                    `,
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: '0 0, 10px 10px',
                                    minHeight: '500px'
                                }}
                            />
                        </div>
                    </div>

                    {/* Toast Container */}
                    <ToastContainer
                        position="top-right"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop={false}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="light"
                        toastStyle={{
                            fontSize: '14px'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default FlowchartEditor;
