// src/services/SolutionSpecificAssessmentService.js
// This properly evaluates solution-specific LTL formulas

import { supabase } from '../lib/supabase';
import { ProcessAssessmentService } from './ProcessAssessmentService';

class SolutionSpecificFlowchartAssessment {
    constructor(xmlString) {
        this.xml = xmlString;
        this.nodes = new Map();
        this.edges = [];
        this.nodesByType = new Map();
        this.adjacencyList = new Map();
        this.reverseAdjacencyList = new Map();
        this.executionPath = [];
        this.parseXML();
        this.buildAdjacencyLists();
        this.findExecutionPath();
    }

    parseXML() {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(this.xml, 'text/xml');

        // Parse nodes with semantic analysis
        const cells = doc.querySelectorAll('mxCell[vertex="1"]');
        cells.forEach(cell => {
            const id = cell.getAttribute('id');
            const value = cell.getAttribute('value') || '';
            const style = cell.getAttribute('style') || '';

            const node = {
                id,
                value: this.cleanValue(value),
                type: this.extractNodeType(style, value),
                style,
                inDegree: 0,
                outDegree: 0,
                semanticRole: this.determineSemanticRole(value, style),
                position: this.extractPosition(cell)
            };

            this.nodes.set(id, node);
            this.groupNodeByType(node);
        });

        // Parse edges with conditions
        const edgeCells = doc.querySelectorAll('mxCell[edge="1"]');
        edgeCells.forEach(edge => {
            const source = edge.getAttribute('source');
            const target = edge.getAttribute('target');
            const value = edge.getAttribute('value') || '';

            if (source && target) {
                const edgeData = {
                    source,
                    target,
                    id: edge.getAttribute('id'),
                    label: this.cleanValue(value),
                    condition: this.extractCondition(value)
                };

                this.edges.push(edgeData);
                this.updateNodeDegrees(source, target);
            }
        });
    }

    cleanValue(value) {
        return value.replace(/<[^>]*>/g, '').trim();
    }

    extractNodeType(style, value) {
        const typeMatch = style.match(/elementType=([^;]+)/);
        if (typeMatch) return typeMatch[1];

        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('read') || lowerValue.includes('input') || lowerValue.includes('get')) {
            return 'input_output';
        }
        if (lowerValue.includes('write') || lowerValue.includes('output') || lowerValue.includes('print')) {
            return 'input_output';
        }

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

    determineSemanticRole(value, style) {
        const lowerValue = value.toLowerCase();

        if (lowerValue.includes('read') || lowerValue.includes('input') || lowerValue.includes('get')) {
            return 'data_input';
        }
        if (lowerValue.includes('write') || lowerValue.includes('output') || lowerValue.includes('print')) {
            return 'data_output';
        }
        if (lowerValue.includes('calculate') || lowerValue.includes('compute') || lowerValue.includes('process')) {
            return 'computation';
        }
        if (lowerValue.includes('if') || lowerValue.includes('check') || lowerValue.includes('?')) {
            return 'decision_logic';
        }

        return 'processing';
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

    extractCondition(edgeValue) {
        const lowerValue = edgeValue.toLowerCase();
        if (lowerValue.includes('yes') || lowerValue.includes('true') || lowerValue.includes('1')) {
            return 'positive';
        }
        if (lowerValue.includes('no') || lowerValue.includes('false') || lowerValue.includes('0')) {
            return 'negative';
        }
        return 'neutral';
    }

    groupNodeByType(node) {
        if (!this.nodesByType.has(node.type)) {
            this.nodesByType.set(node.type, []);
        }
        this.nodesByType.get(node.type).push(node);
    }

    updateNodeDegrees(source, target) {
        const sourceNode = this.nodes.get(source);
        const targetNode = this.nodes.get(target);

        if (sourceNode && sourceNode.type !== 'text') {
            sourceNode.outDegree++;
        }
        if (targetNode && targetNode.type !== 'text') {
            targetNode.inDegree++;
        }
    }

    buildAdjacencyLists() {
        this.nodes.forEach((node, id) => {
            this.adjacencyList.set(id, []);
            this.reverseAdjacencyList.set(id, []);
        });

        this.edges.forEach(edge => {
            if (this.adjacencyList.has(edge.source)) {
                this.adjacencyList.get(edge.source).push({
                    target: edge.target,
                    condition: edge.condition,
                    label: edge.label
                });
            }
            if (this.reverseAdjacencyList.has(edge.target)) {
                this.reverseAdjacencyList.get(edge.target).push({
                    source: edge.source,
                    condition: edge.condition,
                    label: edge.label
                });
            }
        });
    }

    findExecutionPath() {
        const startNodes = this.nodesByType.get('start') || [];
        if (startNodes.length === 0) return;

        const visited = new Set();
        const path = [];

        const dfs = (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const node = this.nodes.get(nodeId);
            if (node && node.type !== 'text') {
                path.push(nodeId);
            }

            const neighbors = this.adjacencyList.get(nodeId) || [];
            if (neighbors.length > 0) {
                const nextNode = neighbors.find(n => n.condition === 'positive') || neighbors[0];
                if (nextNode) {
                    dfs(nextNode.target);
                }
            }
        };

        dfs(startNodes[0].id);
        this.executionPath = path;
    }

    // SOLUTION-SPECIFIC FORMULA EVALUATION

    evaluateFormula(formula) {
        const { formula_name, ltl_expression, description, formula_category } = formula;

        try {
            let result = { passed: false, details: '', evidence: {} };

            // Route to appropriate evaluation method based on formula name pattern
            if (formula_name === 'required_element_types') {
                result = this.evaluateRequiredElementTypes(formula);
            } else if (formula_name.startsWith('requires_')) {
                result = this.evaluateSpecificElementRequirement(formula);
            } else if (formula_name === 'main_execution_path') {
                result = this.evaluateMainExecutionPath(formula);
            } else if (formula_name.startsWith('sequence_')) {
                result = this.evaluateSequenceRequirement(formula);
            } else if (formula_name.startsWith('connection_')) {
                result = this.evaluateConnectionRequirement(formula);
            } else if (formula_name.includes('input_to_processing')) {
                result = this.evaluateInputToProcessing(formula);
            } else if (formula_name.includes('processing_to_output')) {
                result = this.evaluateProcessingToOutput(formula);
            } else if (formula_name.includes('complete_data_flow')) {
                result = this.evaluateCompleteDataFlow(formula);
            } else if (formula_name.startsWith('decision_') && formula_name.includes('branches')) {
                result = this.evaluateDecisionBranches(formula);
            } else if (formula_name.includes('input_output_flow_required')) {
                result = this.evaluateIOFlowRequired(formula);
            } else {
                // Universal formulas - use existing logic
                result = this.evaluateUniversalFormula(formula);
            }

            return {
                formula_name,
                ltl_expression,
                description,
                category: formula_category,
                passed: result.passed,
                details: result.details,
                evidence: result.evidence,
                evaluated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error evaluating formula ${formula_name}:`, error);
            return {
                formula_name,
                ltl_expression,
                description,
                category: formula_category,
                passed: false,
                details: `Evaluation error: ${error.message}`,
                evidence: { error: true },
                evaluated_at: new Date().toISOString()
            };
        }
    }

    // SPECIFIC EVALUATION METHODS

    evaluateRequiredElementTypes(formula) {
        // Extract required types from description
        const descMatch = formula.description.match(/types: (.+)/);
        if (!descMatch) {
            return { passed: false, details: 'Could not parse required element types', evidence: {} };
        }

        const requiredTypes = descMatch[1].split(', ').map(type => type.trim());
        const missingTypes = [];
        const presentTypes = [];

        requiredTypes.forEach(type => {
            const hasType = this.nodesByType.has(type) && this.nodesByType.get(type).length > 0;
            if (hasType) {
                presentTypes.push(type);
            } else {
                missingTypes.push(type);
            }
        });

        const passed = missingTypes.length === 0;

        return {
            passed,
            details: passed
                ? `All required element types present: ${presentTypes.join(', ')}`
                : `Missing required element types: ${missingTypes.join(', ')}`,
            evidence: {
                requiredTypes,
                presentTypes,
                missingTypes,
                totalRequired: requiredTypes.length,
                totalPresent: presentTypes.length
            }
        };
    }

    evaluateSpecificElementRequirement(formula) {
        const elementType = formula.formula_name.replace('requires_', '');
        const hasElement = this.nodesByType.has(elementType) && this.nodesByType.get(elementType).length > 0;
        const count = hasElement ? this.nodesByType.get(elementType).length : 0;

        return {
            passed: hasElement,
            details: hasElement
                ? `Found ${count} ${elementType} element${count > 1 ? 's' : ''}`
                : `Missing required ${elementType} element`,
            evidence: {
                elementType,
                count,
                required: true
            }
        };
    }

    evaluateMainExecutionPath(formula) {
        // Extract expected path from description
        const pathMatch = formula.description.match(/path: (.+)/);
        if (!pathMatch) {
            return { passed: false, details: 'Could not parse expected execution path', evidence: {} };
        }

        const expectedPath = pathMatch[1].split(' → ').map(type => type.trim());
        const actualPath = this.executionPath.map(id => this.nodes.get(id).type);

        // Check if actual path contains the expected sequence
        const hasSequence = this.containsSequence(actualPath, expectedPath);

        return {
            passed: hasSequence,
            details: hasSequence
                ? `Execution path follows required sequence: ${expectedPath.join(' → ')}`
                : `Execution path does not follow required sequence. Expected: ${expectedPath.join(' → ')}, Found: ${actualPath.join(' → ')}`,
            evidence: {
                expectedPath,
                actualPath,
                pathLength: actualPath.length,
                sequenceFound: hasSequence
            }
        };
    }

    evaluateSequenceRequirement(formula) {
        // Extract from/to types from formula name
        const match = formula.formula_name.match(/sequence_(.+)_to_(.+)/);
        if (!match) {
            return { passed: false, details: 'Could not parse sequence requirement', evidence: {} };
        }

        const [, fromType, toType] = match;
        const hasSequence = this.hasDirectConnection(fromType, toType);

        return {
            passed: hasSequence,
            details: hasSequence
                ? `${fromType} correctly connects to ${toType}`
                : `${fromType} does not connect to ${toType} as required`,
            evidence: {
                fromType,
                toType,
                connectionExists: hasSequence
            }
        };
    }

    evaluateConnectionRequirement(formula) {
        // Extract from/to types from formula name
        const match = formula.formula_name.match(/connection_(.+)_(.+)/);
        if (!match) {
            return { passed: false, details: 'Could not parse connection requirement', evidence: {} };
        }

        const [, fromType, toType] = match;
        const hasConnection = this.hasAnyConnection(fromType, toType);

        return {
            passed: hasConnection,
            details: hasConnection
                ? `${fromType} connects to ${toType} as required`
                : `Missing required connection from ${fromType} to ${toType}`,
            evidence: {
                fromType,
                toType,
                connectionExists: hasConnection
            }
        };
    }

    evaluateInputToProcessing(formula) {
        const inputNodes = this.getNodesBySemanticRole('data_input');
        const processingNodes = this.getProcessingNodes();

        if (inputNodes.length === 0) {
            return {
                passed: true, // No input nodes, so requirement doesn't apply
                details: 'No input nodes present - requirement not applicable',
                evidence: { inputCount: 0 }
            };
        }

        const connectedInputs = inputNodes.filter(input =>
            this.hasPathToAnyOf(input.id, processingNodes.map(p => p.id))
        );

        const passed = connectedInputs.length === inputNodes.length;

        return {
            passed,
            details: passed
                ? `All ${inputNodes.length} input operations connect to processing`
                : `${inputNodes.length - connectedInputs.length} input operations do not connect to processing`,
            evidence: {
                totalInputs: inputNodes.length,
                connectedInputs: connectedInputs.length,
                processingNodesAvailable: processingNodes.length
            }
        };
    }

    evaluateProcessingToOutput(formula) {
        const processingNodes = this.getProcessingNodes();
        const outputNodes = this.getNodesBySemanticRole('data_output');

        if (processingNodes.length === 0) {
            return {
                passed: true,
                details: 'No processing nodes present - requirement not applicable',
                evidence: { processingCount: 0 }
            };
        }

        if (outputNodes.length === 0) {
            return {
                passed: false,
                details: 'Processing nodes exist but no output nodes found',
                evidence: { processingCount: processingNodes.length, outputCount: 0 }
            };
        }

        const connectedProcessing = processingNodes.filter(proc =>
            this.hasPathToAnyOf(proc.id, outputNodes.map(o => o.id))
        );

        const passed = connectedProcessing.length === processingNodes.length;

        return {
            passed,
            details: passed
                ? `All ${processingNodes.length} processing operations connect to output`
                : `${processingNodes.length - connectedProcessing.length} processing operations do not connect to output`,
            evidence: {
                totalProcessing: processingNodes.length,
                connectedProcessing: connectedProcessing.length,
                outputNodesAvailable: outputNodes.length
            }
        };
    }

    evaluateCompleteDataFlow(formula) {
        const inputNodes = this.getNodesBySemanticRole('data_input');
        const outputNodes = this.getNodesBySemanticRole('data_output');

        if (inputNodes.length === 0 || outputNodes.length === 0) {
            return {
                passed: inputNodes.length === 0, // Pass if no inputs, fail if inputs but no outputs
                details: inputNodes.length === 0
                    ? 'No input nodes - data flow requirement not applicable'
                    : 'Input nodes exist but no output nodes found',
                evidence: { inputCount: inputNodes.length, outputCount: outputNodes.length }
            };
        }

        const connectedInputs = inputNodes.filter(input =>
            this.hasPathToAnyOf(input.id, outputNodes.map(o => o.id))
        );

        const passed = connectedInputs.length === inputNodes.length;

        return {
            passed,
            details: passed
                ? `Complete data flow: all ${inputNodes.length} inputs connect to outputs`
                : `Incomplete data flow: ${inputNodes.length - connectedInputs.length} inputs do not reach outputs`,
            evidence: {
                totalInputs: inputNodes.length,
                connectedInputs: connectedInputs.length,
                totalOutputs: outputNodes.length
            }
        };
    }

    evaluateDecisionBranches(formula) {
        const decisions = this.nodesByType.get('decision') || [];

        if (decisions.length === 0) {
            return {
                passed: true,
                details: 'No decision nodes present - requirement not applicable',
                evidence: { decisionCount: 0 }
            };
        }

        const validDecisions = decisions.filter(decision => {
            const branches = this.adjacencyList.get(decision.id) || [];
            return branches.length >= 2;
        });

        const passed = validDecisions.length === decisions.length;

        return {
            passed,
            details: passed
                ? `All ${decisions.length} decision nodes have multiple branches`
                : `${decisions.length - validDecisions.length} decision nodes lack multiple branches`,
            evidence: {
                totalDecisions: decisions.length,
                validDecisions: validDecisions.length,
                decisionAnalysis: decisions.map(d => ({
                    id: d.id,
                    value: d.value,
                    branchCount: (this.adjacencyList.get(d.id) || []).length
                }))
            }
        };
    }

    evaluateIOFlowRequired(formula) {
        const ioNodes = this.nodesByType.get('input_output') || [];
        const inputNodes = ioNodes.filter(node => this.isInputNode(node));
        const outputNodes = ioNodes.filter(node => this.isOutputNode(node));

        const hasInputs = inputNodes.length > 0;
        const hasOutputs = outputNodes.length > 0;
        const passed = hasInputs && hasOutputs;

        return {
            passed,
            details: passed
                ? `Solution has both input (${inputNodes.length}) and output (${outputNodes.length}) operations`
                : `Solution missing ${!hasInputs ? 'input operations' : ''}${!hasInputs && !hasOutputs ? ' and ' : ''}${!hasOutputs ? 'output operations' : ''}`,
            evidence: {
                inputCount: inputNodes.length,
                outputCount: outputNodes.length,
                totalIONodes: ioNodes.length
            }
        };
    }

    evaluateUniversalFormula(formula) {
        // Handle universal formulas with existing logic
        const { formula_name } = formula;

        switch (formula_name) {
            case 'has_start_node':
                const startNodes = this.nodesByType.get('start') || [];
                return {
                    passed: startNodes.length === 1,
                    details: startNodes.length === 1 ? 'Found exactly one start node' :
                        startNodes.length === 0 ? 'No start node found' : 'Multiple start nodes found',
                    evidence: { startNodesCount: startNodes.length }
                };

            case 'has_end_node':
                const endNodes = this.nodesByType.get('end') || [];
                return {
                    passed: endNodes.length >= 1,
                    details: endNodes.length >= 1 ? `Found ${endNodes.length} end node(s)` : 'No end node found',
                    evidence: { endNodesCount: endNodes.length }
                };

            default:
                return {
                    passed: true,
                    details: 'Generic formula evaluation',
                    evidence: { type: 'generic' }
                };
        }
    }

    // HELPER METHODS

    containsSequence(haystack, needle) {
        if (needle.length === 0) return true;
        if (haystack.length < needle.length) return false;

        for (let i = 0; i <= haystack.length - needle.length; i++) {
            let matches = true;
            for (let j = 0; j < needle.length; j++) {
                if (haystack[i + j] !== needle[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }

        return false;
    }

    hasDirectConnection(fromType, toType) {
        const fromNodes = this.nodesByType.get(fromType) || [];
        const toNodes = this.nodesByType.get(toType) || [];

        for (const fromNode of fromNodes) {
            const neighbors = this.adjacencyList.get(fromNode.id) || [];
            for (const neighbor of neighbors) {
                const targetNode = this.nodes.get(neighbor.target);
                if (targetNode && targetNode.type === toType) {
                    return true;
                }
            }
        }

        return false;
    }

    hasAnyConnection(fromType, toType) {
        const fromNodes = this.nodesByType.get(fromType) || [];
        const toNodes = this.nodesByType.get(toType) || [];

        for (const fromNode of fromNodes) {
            for (const toNode of toNodes) {
                if (this.hasPathBetween(fromNode.id, toNode.id)) {
                    return true;
                }
            }
        }

        return false;
    }

    hasPathBetween(startId, endId) {
        const visited = new Set();
        const queue = [startId];

        while (queue.length > 0) {
            const currentId = queue.shift();

            if (currentId === endId) {
                return true;
            }

            if (visited.has(currentId)) {
                continue;
            }

            visited.add(currentId);
            const neighbors = this.adjacencyList.get(currentId) || [];
            neighbors.forEach(neighbor => {
                if (!visited.has(neighbor.target)) {
                    queue.push(neighbor.target);
                }
            });
        }

        return false;
    }

    hasPathToAnyOf(startId, endIds) {
        return endIds.some(endId => this.hasPathBetween(startId, endId));
    }

    getNodesBySemanticRole(role) {
        return Array.from(this.nodes.values()).filter(node => node.semanticRole === role);
    }

    getProcessingNodes() {
        const processNodes = this.nodesByType.get('process') || [];
        const predefinedNodes = this.nodesByType.get('predefined') || [];
        const computationNodes = this.getNodesBySemanticRole('computation');

        return [...processNodes, ...predefinedNodes, ...computationNodes];
    }

    isInputNode(node) {
        return node.semanticRole === 'data_input' ||
            node.value.toLowerCase().includes('input') ||
            node.value.toLowerCase().includes('read') ||
            node.value.toLowerCase().includes('get');
    }

    isOutputNode(node) {
        return node.semanticRole === 'data_output' ||
            node.value.toLowerCase().includes('output') ||
            node.value.toLowerCase().includes('write') ||
            node.value.toLowerCase().includes('print') ||
            node.value.toLowerCase().includes('display');
    }
}

export const SolutionSpecificAssessmentService = {
    async assessStudentFlowchart(problemId, sessionId, flowchartXml, studentNumber) {
        try {
            console.log('🎯 Solution-specific assessment starting for student:', studentNumber);

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

            // Get formulas - Universal + Solution-specific
            const [universalFormulas, problemFormulas] = await Promise.all([
                this.getUniversalFormulas(),
                this.getProblemFormulas(problemId)
            ]);

            const allFormulas = [...universalFormulas, ...problemFormulas];

            console.log(`🧠 Evaluating ${allFormulas.length} formulas (${universalFormulas.length} universal + ${problemFormulas.length} solution-specific)...`);

            // Use solution-specific assessment
            const assessment = new SolutionSpecificFlowchartAssessment(flowchartXml);
            const structuralResults = allFormulas.map(formula =>
                assessment.evaluateFormula(formula)
            );

            // Calculate weighted structural score
            const structuralScore = this.calculateWeightedStructuralScore(structuralResults);

            console.log('🏗️ Solution-specific structural assessment complete. Score:', structuralScore);

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
                total_formulas: allFormulas.length,
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
            console.error('🚨 Error in solution-specific assessment:', error);
            throw error;
        }
    },

    calculateWeightedStructuralScore(results) {
        if (results.length === 0) return 0;

        let totalWeight = 0;
        let weightedSum = 0;

        results.forEach(result => {
            // High priority formulas get more weight
            let weight = 1.0;
            if (result.category === 'structure' || result.category === 'flow') {
                weight = 3.0; // Critical structure/flow requirements
            } else if (result.category === 'connectivity' || result.category === 'semantic') {
                weight = 2.0; // Important connectivity/logic requirements
            } else if (result.category === 'io_flow' || result.category === 'decision_logic') {
                weight = 1.5; // Specific functionality requirements
            }

            totalWeight += weight;
            if (result.passed) {
                weightedSum += weight;
            }
        });

        return Math.round((weightedSum / Math.max(totalWeight, 1)) * 100);
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