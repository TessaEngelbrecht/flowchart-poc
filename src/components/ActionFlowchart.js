import React, { useEffect, useRef } from 'react';
import mxgraphFactory from 'mxgraph';

const ActionFlowchart = ({ actions }) => {
    const graphContainer = useRef(null);

    useEffect(() => {
        if (!actions.length || !graphContainer.current) return;

        // Initialize mxGraph with factory pattern
        const mx = mxgraphFactory({
            mxImageBasePath: 'mxgraph/javascript/src/images',
            mxBasePath: 'mxgraph/javascript/src'
        });

        const {
            mxGraph,
            mxRubberband,
            mxConstants
        } = mx;

        const graph = new mxGraph(graphContainer.current);
        graph.setEnabled(false);
        graph.setCellsSelectable(false);
        new mxRubberband(graph);

        // Styling
        const vertexStyle = graph.getStylesheet().getDefaultVertexStyle();
        vertexStyle[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE;
        vertexStyle[mxConstants.STYLE_STROKECOLOR] = '#3d86e6';
        vertexStyle[mxConstants.STYLE_FILLCOLOR] = '#e0f2fe';
        vertexStyle[mxConstants.STYLE_FONTCOLOR] = '#1e3a8a';
        vertexStyle[mxConstants.STYLE_ROUNDED] = true;

        const parent = graph.getDefaultParent();
        graph.getModel().beginUpdate();

        try {
            let x = 50;
            let prevVertex = null;

            actions.forEach((action, index) => {
                let label = `${action.action_type}`;
                if (action.element_type) label += ` (${action.element_type})`;
                if (action.details?.cell_value) label += `: ${action.details.cell_value}`;

                const vertex = graph.insertVertex(
                    parent,
                    null,
                    label,
                    x,
                    50,
                    180,
                    40
                );

                if (prevVertex) {
                    graph.insertEdge(parent, null, '', prevVertex, vertex);
                }

                prevVertex = vertex;
                x += 200;
            });
        } finally {
            graph.getModel().endUpdate();
            graph.fit();
        }

        return () => graph.destroy();
    }, [actions]);

    return <div ref={graphContainer} style={{
        width: '100%',
        height: '250px',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        backgroundColor: '#f8fafc'
    }} />;
};

export default ActionFlowchart;
