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

const FlowchartEditor = ({ problemId, userId, onSessionChange }) => {
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
                if (onSessionChange) {
                    onSessionChange(data.id);
                }
                toast.success('Session started successfully!');
            }
        } catch (error) {
            toast.error('Failed to start session');
            console.error('Session error:', error);
        }
    }, [userId, problemId, sessionId, onSessionChange]);

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
        if (style.includes('text')) return 'text_label';
        return 'process';
    }, []);

    const setupConnectionConstraints = useCallback((graph) => {
        graph.getAllConnectionConstraints = function (terminal) {
            if (terminal != null && terminal.cell != null && this.model.isVertex(terminal.cell)) {
                return [
                    new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                    new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                    new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                    new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                    new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                    new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                    new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                    new mxConnectionConstraint(new mxPoint(0, 0.25), true)
                ];
            }
            return null;
        };

        graph.setConnectable(true);
        graph.setAllowDanglingEdges(false);

        if (graph.connectionHandler && graph.connectionHandler.constraintHandler) {
            graph.connectionHandler.constraintHandler.enabled = true;
        }

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


    const initializeGraph = useCallback(() => {
        if (!graphContainer.current || graph) return;

        if (!mxClient.isBrowserSupported()) {
            mxUtils.error('Browser is not supported!', 200, false);
            return;
        }

        try {
            //registerCustomShapes();

            const newGraph = new mxGraph(graphContainer.current);

           // setupConnectionConstraints(newGraph);
            //setupTrashCan(newGraph);

            // Styling arrows AFTER registering custom shapes
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

            const keyHandler = new mxKeyHandler(newGraph);
            keyHandler.bindKey(46, function (evt) {
                if (newGraph.isEnabled()) {
                    newGraph.removeCells();
                    toast.info('Selected elements deleted');
                }
            });
            keyHandler.bindKey(8, function (evt) {
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
    }, [trackAction, getElementType, graph, registerCustomShapes, setupConnectionConstraints]);

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

    return (
        <div className="flowchart-editor-container">
            {/* Sidebar */}
            <div className="flowchart-sidebar">
                <div className="sidebar-header">
                    <h3 className="sidebar-title">Flowchart Elements</h3>
                </div>

                <div className="elements-container">
                    {/* Terminal Elements */}
                    <div className="element-group">
                        <h4 className="group-title">Terminal Elements</h4>
                        <div className="element-grid">
                            <button
                                onClick={() => addFlowchartElement('start')}
                                className="element-btn element-btn-start"
                                title="Add Start Element"
                            >
                                <span className="element-label">Start</span>
                            </button>
                            <button
                                onClick={() => addFlowchartElement('end')}
                                className="element-btn element-btn-end"
                                title="Add End Element"
                            >
                                <span className="element-label">End</span>
                            </button>
                        </div>
                    </div>

                    {/* Process Elements */}
                    <div className="element-group">
                        <h4 className="group-title">Process Elements</h4>
                        <div className="element-list">
                            <button
                                onClick={() => addFlowchartElement('process')}
                                className="element-btn element-btn-process"
                                title="Add Process Element"
                            >
                                <span className="element-label">Process</span>
                            </button>
                            <button
                                onClick={() => addFlowchartElement('decision')}
                                className="element-btn element-btn-decision"
                                title="Add Decision Element"
                            >
                                <span className="element-label">Decision</span>
                            </button>
                            <button
                                onClick={() => addFlowchartElement('predefined')}
                                className="element-btn element-btn-predefined"
                                title="Add Predefined Process"
                            >
                                <span className="element-label">Predefined</span>
                            </button>
                        </div>
                    </div>

                    {/* Input/Output Elements */}
                    <div className="element-group">
                        <h4 className="group-title">Input/Output</h4>
                        <div className="element-grid">
                            <button
                                onClick={() => addFlowchartElement('input')}
                                className="element-btn element-btn-input"
                                title="Add Input Element"
                            >
                                <span className="element-label">Input</span>
                            </button>
                            <button
                                onClick={() => addFlowchartElement('output')}
                                className="element-btn element-btn-output"
                                title="Add Output Element"
                            >
                                <span className="element-label">Output</span>
                            </button>
                        </div>
                    </div>

                    {/* Special Elements */}
                    <div className="element-group">
                        <h4 className="group-title">Special Elements</h4>
                        <div className="element-grid">
                            <button
                                onClick={() => addFlowchartElement('document')}
                                className="element-btn element-btn-document"
                                title="Add Document Element"
                            >
                                <span className="element-label">Document</span>
                            </button>
                            <button
                                onClick={() => addFlowchartElement('connector')}
                                className="element-btn element-btn-connector"
                                title="Add Connector Element"
                            >
                                <span className="element-label">Connector</span>
                            </button>
                        </div>
                        <button
                            onClick={() => addFlowchartElement('text')}
                            className="element-btn element-btn-text"
                            title="Add Text Label"
                        >
                            <span className="element-label">Text Label</span>
                        </button>
                    </div>

                    {/* Instructions */}
                    <div className="instructions-panel">
                        <h4 className="group-title">Instructions</h4>
                        <div className="instruction-list">
                            <div className="instruction-item">• Click elements to add them to canvas</div>
                            <div className="instruction-item">• Drag elements to move them</div>
                            <div className="instruction-item">• Hover over the middle of an element, hold and drag to create connection pints</div>
                            <div className="instruction-item">• Click and drag between elements for arrows</div>
                            <div className="instruction-item">• Double-click to edit labels</div>
                            <div className="instruction-item">• Use Text Label for arrow conditions (Yes/No)</div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        onClick={saveSnapshot}
                        className="action-btn action-btn-save"
                        title="Save Flowchart"
                    >
                        <span className="btn-text">Save Flowchart</span>
                    </button>
                    <button
                        onClick={deleteSelected}
                        className="action-btn action-btn-delete"
                        title="Delete Selected Elements"
                    >
                        <span className="btn-text">Delete Selected</span>
                    </button>
                    <button
                        onClick={clearCanvas}
                        className="action-btn action-btn-clear"
                        title="Clear All Elements"
                    >
                        <span className="btn-text">Clear All</span>
                    </button>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="canvas-container">
                <div
                    ref={graphContainer}
                    className="flowchart-canvas"
                />
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
                className="toast-container"
            />
        </div>
    );
};

export default FlowchartEditor;
