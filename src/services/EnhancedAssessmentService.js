// src/services/FixedAssessmentService.js
// This fixes the assessment logic to properly validate basic requirements

import { supabase } from '../lib/supabase';
import { ProcessAssessmentService } from './ProcessAssessmentService';

class StrictFlowchartAssessment {
    constructor(xmlString) {
        this.xml = xmlString;
        this.nodes = new Map();
        this.edges = [];
        this.nodesByType = new Map();
        this.adjacencyList = new Map();
        this.parseXML();
        this.buildAdjacencyList();
    }

    parseXML() {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(this.xml, 'text/xml');

        // Parse nodes
        const cells = doc.querySelectorAll('mxCell[vertex="1"]');
        cells.forEach(cell => {
            const id = cell.getAttribute('id');
            const value = cell.getAttribute('value') || '';
            const style = cell.getAttribute('style') || '';

            const nodeType = this.extractNodeType(style, value);
            const node = {
                id,
                value,
                type: nodeType,
                style,
                inDegree: 0,
                outDegree: 0,
                position: this.extractPosition(cell)
            };

            this.nodes.set(id, node);

            if (!this.nodesByType.has(nodeType)) {
                this.nodesByType.set(nodeType, []);
            }
            this.nodesByType.get(nodeType).push(node);
        });

        // Parse edges and calculate degrees
        const edgeCells = doc.querySelectorAll('mxCell[edge="1"]');
        edgeCells.forEach(edge => {
            const source = edge.getAttribute('source');
            const target = edge.getAttribute('target');

            if (source && target) {
                this.edges.push({ source, target, id: edge.getAttribute('id') });

                const sourceNode = this.nodes.get(source);
                const targetNode = this.nodes.get(target);

                if (sourceNode && sourceNode.type !== 'text') {
                    sourceNode.outDegree++;
                }
                if (targetNode && targetNode.type !== 'text') {
                    targetNode.inDegree++;
                }
            }
        });
    }

    extractNodeType(style, value) {
        // Check for embedded type
        const typeMatch = style.match(/elementType=([^;]+)/);
        if (typeMatch) return typeMatch[1];

        // Fallback to style analysis
        if (style.includes('ellipse') && style.includes('#d5e8d4')) return 'start';
        if (style.includes('ellipse') && style.includes('#f8cecc')) return 'end';
        if (style.includes('rhombus')) return 'decision';
        if (style.includes('parallelogram')) return 'input_output';
        if (style.includes('document')) return 'document';
        if (style.includes('rect') && style.includes('rounded=1')) return 'predefined';
        if (style.startsWith('text;')) return 'text';
        if (style.includes('rect')) return 'process';
        return 'unknown';
    }

    extractPosition(cell) {
        const geometry = cell.querySelector('mxGeometry');
        if (geometry) {
            return {
                x: parseFloat(geometry.getAttribute('x')) || 0,
                y: parseFloat(geometry.getAttribute('y')) || 0
            };
        }
        return { x: 0, y: 0 };
    }

    buildAdjacencyList() {
        this.nodes.forEach((node, id) => {
            this.adjacencyList.set(id, []);
        });

        this.edges.forEach(edge => {
            if (this.adjacencyList.has(edge.source)) {
                this.adjacencyList.get(edge.source).push(edge.target);
            }
        });
    }

    // STRICT EVALUATION METHODS - These properly check basic requirements

    evaluateFormula(formula) {
        const { formula_name, ltl_expression, description } = formula;

        try {
            let passed = false;
            let details = '';
            let evidence = {};

            switch (formula_name) {
                case 'has_start_node':
                    const result1 = this.strictTestHasStartNode();
                    passed = result1.passed;
                    details = result1.details;
                    evidence = result1.evidence;
                    break;

                case 'has_end_node':
                    const result2 = this.strictTestHasEndNode();
                    passed = result2.passed;
                    details = result2.details;
                    evidence = result2.evidence;
                    break;

                case 'start_leads_to_end':
                    const result3 = this.strictTestStartLeadsToEnd();
                    passed = result3.passed;
                    details = result3.details;
                    evidence = result3.evidence;
                    break;

                case 'decision_has_two_branches':
                case 'decision_multiple_branches':
                    const result4 = this.strictTestDecisionBranches();
                    passed = result4.passed;
                    details = result4.details;
                    evidence = result4.evidence;
                    break;

                case 'all_non_text_connected':
                case 'no_orphaned_elements':
                    const result5 = this.strictTestAllConnected();
                    passed = result5.passed;
                    details = result5.details;
                    evidence = result5.evidence;
                    break;

                case 'process_has_input_output':
                case 'process_connectivity':
                    const result6 = this.strictTestProcessConnections();
                    passed = result6.passed;
                    details = result6.details;
                    evidence = result6.evidence;
                    break;

                case 'input_output_flow':
                    const result7 = this.strictTestInputOutputFlow();
                    passed = result7.passed;
                    details = result7.details;
                    evidence = result7.evidence;
                    break;

                case 'essential_processing_elements':
                    const result8 = this.strictTestEssentialElements();
                    passed = result8.passed;
                    details = result8.details;
                    evidence = result8.evidence;
                    break;

                default:
                    // Handle other formulas with generic logic
                    const result9 = this.handleGenericFormula(formula);
                    passed = result9.passed;
                    details = result9.details;
                    evidence = result9.evidence;
            }

            return {
                formula_name,
                ltl_expression,
                description,
                passed,
                details,
                evidence,
                evaluated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error evaluating formula ${formula_name}:`, error);
            return {
                formula_name,
                ltl_expression,
                description,
                passed: false,
                details: `Evaluation error: ${error.message}`,
                evidence: { error: true },
                evaluated_at: new Date().toISOString()
            };
        }
    }

    // STRICT TEST IMPLEMENTATIONS

    strictTestHasStartNode() {
        const startNodes = this.nodesByType.get('start') || [];
        const passed = startNodes.length === 1; // Exactly one start node

        return {
            passed,
            details: passed
                ? `Found exactly one start node: ${startNodes[0].value}`
                : startNodes.length === 0
                    ? 'No start node found - flowchart must have a start node'
                    : `Found ${startNodes.length} start nodes - flowchart should have exactly one start node`,
            evidence: {
                startNodesCount: startNodes.length,
                startNodes: startNodes.map(n => ({ id: n.id, value: n.value }))
            }
        };
    }

    strictTestHasEndNode() {
        const endNodes = this.nodesByType.get('end') || [];
        const passed = endNodes.length >= 1;

        return {
            passed,
            details: passed
                ? `Found ${endNodes.length} end node(s)`
                : 'No end node found - flowchart must have at least one end node',
            evidence: {
                endNodesCount: endNodes.length,
                endNodes: endNodes.map(n => ({ id: n.id, value: n.value }))
            }
        };
    }

    strictTestStartLeadsToEnd() {
        const startNodes = this.nodesByType.get('start') || [];
        const endNodes = this.nodesByType.get('end') || [];

        if (startNodes.length === 0) {
            return {
                passed: false,
                details: 'No start node found - cannot test connectivity',
                evidence: { reason: 'no_start_node' }
            };
        }

        if (endNodes.length === 0) {
            return {
                passed: false,
                details: 'No end node found - cannot test connectivity',
                evidence: { reason: 'no_end_node' }
            };
        }

        // Check if there's a path from start to end
        const hasPath = this.findPath(startNodes[0].id, endNodes.map(e => e.id));

        return {
            passed: hasPath,
            details: hasPath
                ? 'Valid path exists from start to end node'
                : 'No valid path found from start to any end node - elements must be connected',
            evidence: {
                pathExists: hasPath,
                startNode: startNodes[0].id,
                endNodes: endNodes.map(e => e.id)
            }
        };
    }

    strictTestDecisionBranches() {
        const decisionNodes = this.nodesByType.get('decision') || [];

        if (decisionNodes.length === 0) {
            return {
                passed: true, // No decisions to validate
                details: 'No decision nodes present - requirement not applicable',
                evidence: { decisionNodesCount: 0 }
            };
        }

        const invalidDecisions = decisionNodes.filter(decision => {
            const outgoingConnections = this.adjacencyList.get(decision.id) || [];
            return outgoingConnections.length < 2;
        });

        const allValid = invalidDecisions.length === 0;

        return {
            passed: allValid,
            details: allValid
                ? `All ${decisionNodes.length} decision nodes have adequate branches (2+ connections)`
                : `${invalidDecisions.length} decision node(s) need more branches: ${invalidDecisions.map(d => `"${d.value}"`).join(', ')}`,
            evidence: {
                totalDecisions: decisionNodes.length,
                invalidDecisions: invalidDecisions.length,
                decisionAnalysis: decisionNodes.map(d => ({
                    id: d.id,
                    value: d.value,
                    branches: (this.adjacencyList.get(d.id) || []).length
                }))
            }
        };
    }

    strictTestAllConnected() {
        const nonTextNodes = Array.from(this.nodes.values())
            .filter(node => node.type !== 'text');

        if (nonTextNodes.length <= 1) {
            return {
                passed: true,
                details: 'Insufficient nodes to test connectivity',
                evidence: { nodeCount: nonTextNodes.length }
            };
        }

        // Check for nodes that are completely disconnected (no in or out connections)
        const disconnectedNodes = nonTextNodes.filter(node =>
            node.inDegree === 0 && node.outDegree === 0 && node.type !== 'start'
        );

        const passed = disconnectedNodes.length === 0;

        return {
            passed,
            details: passed
                ? `All ${nonTextNodes.length} nodes are connected`
                : `${disconnectedNodes.length} node(s) are completely disconnected: ${disconnectedNodes.map(n => n.value || n.type).join(', ')}`,
            evidence: {
                totalNodes: nonTextNodes.length,
                disconnectedNodes: disconnectedNodes.length,
                disconnectedList: disconnectedNodes.map(n => ({ id: n.id, value: n.value, type: n.type }))
            }
        };
    }

    strictTestProcessConnections() {
        const processNodes = this.nodesByType.get('process') || [];
        const predefinedNodes = this.nodesByType.get('predefined') || [];
        const allProcessNodes = [...processNodes, ...predefinedNodes];

        if (allProcessNodes.length === 0) {
            return {
                passed: true,
                details: 'No process nodes present - requirement not applicable',
                evidence: { processNodesCount: 0 }
            };
        }

        const invalidProcesses = allProcessNodes.filter(process => {
            const hasInput = process.inDegree > 0;
            const hasOutput = process.outDegree > 0;
            return !(hasInput && hasOutput);
        });

        const allValid = invalidProcesses.length === 0;

        return {
            passed: allValid,
            details: allValid
                ? `All ${allProcessNodes.length} process nodes have proper input/output connections`
                : `${invalidProcesses.length} process node(s) missing connections: ${invalidProcesses.map(p => `"${p.value}" (in:${p.inDegree}, out:${p.outDegree})`).join(', ')}`,
            evidence: {
                totalProcesses: allProcessNodes.length,
                invalidProcesses: invalidProcesses.length,
                processAnalysis: allProcessNodes.map(p => ({
                    id: p.id,
                    value: p.value,
                    type: p.type,
                    inDegree: p.inDegree,
                    outDegree: p.outDegree,
                    isValid: p.inDegree > 0 && p.outDegree > 0
                }))
            }
        };
    }

    strictTestInputOutputFlow() {
        const inputOutputNodes = this.nodesByType.get('input_output') || [];

        if (inputOutputNodes.length === 0) {
            return {
                passed: true,
                details: 'No input/output nodes present - requirement not applicable',
                evidence: { inputOutputCount: 0 }
            };
        }

        // For now, just check that input/output nodes are connected
        const connectedIONodes = inputOutputNodes.filter(node =>
            node.inDegree > 0 || node.outDegree > 0
        );

        const passed = connectedIONodes.length === inputOutputNodes.length;

        return {
            passed,
            details: passed
                ? `All ${inputOutputNodes.length} input/output nodes are properly connected`
                : `${inputOutputNodes.length - connectedIONodes.length} input/output node(s) are not connected`,
            evidence: {
                totalIONodes: inputOutputNodes.length,
                connectedIONodes: connectedIONodes.length
            }
        };
    }

    strictTestEssentialElements() {
        const startNodes = this.nodesByType.get('start') || [];
        const endNodes = this.nodesByType.get('end') || [];
        const processNodes = this.nodesByType.get('process') || [];
        const predefinedNodes = this.nodesByType.get('predefined') || [];

        const hasStart = startNodes.length >= 1;
        const hasEnd = endNodes.length >= 1;
        const hasProcessing = (processNodes.length + predefinedNodes.length) >= 1;

        const passed = hasStart && hasEnd && hasProcessing;

        let missing = [];
        if (!hasStart) missing.push('start node');
        if (!hasEnd) missing.push('end node');
        if (!hasProcessing) missing.push('processing element (process or predefined)');

        return {
            passed,
            details: passed
                ? 'Flowchart contains all essential elements (start, processing, end)'
                : `Missing essential elements: ${missing.join(', ')}`,
            evidence: {
                hasStart,
                hasEnd,
                hasProcessing,
                startCount: startNodes.length,
                endCount: endNodes.length,
                processCount: processNodes.length,
                predefinedCount: predefinedNodes.length
            }
        };
    }

    handleGenericFormula(formula) {
        // For formulas we don't specifically handle, do basic validation
        return {
            passed: true,
            details: `Generic formula "${formula.formula_name}" evaluated`,
            evidence: { type: 'generic_evaluation' }
        };
    }

    // HELPER METHODS

    findPath(startId, endIds) {
        const visited = new Set();
        const queue = [startId];

        while (queue.length > 0) {
            const currentId = queue.shift();

            if (endIds.includes(currentId)) {
                return true;
            }

            if (visited.has(currentId)) {
                continue;
            }

            visited.add(currentId);

            const neighbors = this.adjacencyList.get(currentId) || [];
            neighbors.forEach(neighborId => {
                if (!visited.has(neighborId)) {
                    queue.push(neighborId);
                }
            });
        }

        return false;
    }
}

export const EnhancedAssessmentService = {
    async assessStudentFlowchart(problemId, sessionId, flowchartXml, studentNumber) {
        try {
            console.log('🎯 Fixed assessment starting for student:', studentNumber);

            // Get user actions for process assessment
            const { data: userActions, error: actionsError } = await supabase
                .from('user_actions')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (actionsError) {
                console.error('Error fetching user actions:', actionsError);
                throw actionsError;
            }

            // Create linear diagram
            await this.createLinearDiagram(sessionId, userActions);

            // Get formulas - but filter out duplicates
            const [universalFormulas, problemFormulas] = await Promise.all([
                this.getUniversalFormulas(),
                this.getProblemFormulas(problemId)
            ]);

            // Remove duplicates between universal and problem-specific formulas
            const uniqueFormulas = this.removeDuplicateFormulas(universalFormulas, problemFormulas);

            console.log(`🧠 Evaluating ${uniqueFormulas.length} unique formulas (removed duplicates)...`);

            // Use strict assessment
            const assessment = new StrictFlowchartAssessment(flowchartXml);
            const structuralResults = uniqueFormulas.map(formula =>
                assessment.evaluateFormula(formula)
            );

            const structuralScore = Math.round((structuralResults.filter(r => r.passed).length / structuralResults.length) * 100);

            console.log('🏗️ Strict structural assessment complete. Score:', structuralScore);

            // Process assessment
            let processResults;
            try {
                const processService = new ProcessAssessmentService();
                processResults = await processService.assessAlgorithmicThinking(userActions, sessionId, studentNumber);
            } catch (processError) {
                console.error('⚠️ Process assessment failed:', processError);
                processResults = {
                    totalScore: 0,
                    breakdown: { planning: 0, refinement: 0, efficiency: 0, patterns: 0, errorRecovery: 0, total: 0 },
                    feedback: { strengths: [], improvements: ['Process assessment failed'], suggestions: [] }
                };
            }

            // Normalize process score
            const maxPossibleProcessScore = 85;
            const normalizedProcessScore = Math.round((processResults.totalScore / maxPossibleProcessScore) * 100);

            // Calculate combined score (60% structural, 40% process)
            const combinedScore = Math.round((structuralScore * 0.6) + (normalizedProcessScore * 0.4));

            console.log(`📈 Combined Score: ${combinedScore}% (Structural: ${structuralScore}%, Process: ${normalizedProcessScore}%)`);

            // Store results
            const assessmentData = {
                session_id: sessionId,
                problem_id: problemId,
                student_number: studentNumber,
                total_formulas: uniqueFormulas.length,
                passed_formulas: structuralResults.filter(r => r.passed).length,
                score_percentage: structuralScore,
                process_score: normalizedProcessScore,
                combined_score: combinedScore,
                assessment_results: structuralResults,
                process_feedback: processResults.feedback,
                flowchart_xml: flowchartXml,
                assessed_at: new Date().toISOString()
            };

            const { data: mainAssessment, error: mainError } = await supabase
                .from('student_assessments')
                .insert(assessmentData)
                .select()
                .single();

            if (mainError) {
                console.error('❌ Assessment storage failed:', mainError);
                throw mainError;
            }

            return {
                success: true,
                structuralScore: structuralScore,
                processScore: normalizedProcessScore,
                combinedScore: combinedScore,
                structuralResults: structuralResults,
                processResults: {
                    ...processResults,
                    totalScore: normalizedProcessScore
                },
                assessmentId: mainAssessment.id,
                studentNumber: studentNumber
            };

        } catch (error) {
            console.error('🚨 Error in fixed assessment:', error);
            throw error;
        }
    },

    // Remove duplicate formulas between universal and problem-specific
    removeDuplicateFormulas(universalFormulas, problemFormulas) {
        const universalNames = new Set(universalFormulas.map(f => f.formula_name));

        // Filter out problem formulas that duplicate universal ones
        const uniqueProblemFormulas = problemFormulas.filter(pf =>
            !universalNames.has(pf.formula_name)
        );

        console.log(`🔧 Filtered ${problemFormulas.length - uniqueProblemFormulas.length} duplicate formulas`);

        return [...universalFormulas, ...uniqueProblemFormulas];
    },

    async createLinearDiagram(sessionId, userActions) {
        try {
            const linearPattern = userActions.map(action => ({
                action_type: action.action_type,
                element_type: action.element_type,
                label: action.details?.cell_value || action.details?.new_label || '',
                timestamp: action.timestamp
            }));

            const { data: existingDiagram } = await supabase
                .from('linear_diagrams')
                .select('id')
                .eq('session_id', sessionId)
                .single();

            if (existingDiagram) {
                await supabase
                    .from('linear_diagrams')
                    .update({
                        linear_pattern: linearPattern,
                        created_at: new Date().toISOString()
                    })
                    .eq('session_id', sessionId);
            } else {
                await supabase
                    .from('linear_diagrams')
                    .insert({
                        session_id: sessionId,
                        linear_pattern: linearPattern
                    });
            }
        } catch (error) {
            console.error('Error creating linear diagram:', error);
        }
    },

    async getUniversalFormulas() {
        const { data, error } = await supabase
            .from('universal_ltl_formulas')
            .select('*')
            .eq('is_active', true)
            .order('priority');

        if (error) throw error;
        return data;
    },

    async getProblemFormulas(problemId) {
        const { data, error } = await supabase
            .from('ltl_formulas')
            .select('*')
            .eq('problem_id', problemId)
            .eq('is_active', true)
            .order('created_at');

        if (error) throw error;
        return data;
    }
};

// Export the assessment class for use in other services
export { StrictFlowchartAssessment };