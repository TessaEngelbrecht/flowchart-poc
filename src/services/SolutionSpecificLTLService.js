// src/services/SolutionSpecificLTLService.js
// This generates formulas that test for the EXACT structure of the lecturer's solution

import { supabase } from '../lib/supabase';

class SolutionStructureAnalyzer {
    constructor(xmlString) {
        this.xml = xmlString;
        this.nodes = new Map();
        this.edges = [];
        this.nodesByType = new Map();
        this.adjacencyList = new Map();
        this.solutionPath = [];
        this.requiredElements = new Set();
        this.requiredConnections = [];
        this.parseXML();
        this.buildAdjacencyList();
        this.analyzeSolutionStructure();
    }

    parseXML() {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(this.xml, 'text/xml');

        // Parse nodes with position information
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
                position: this.extractPosition(cell),
                semanticRole: this.determineSemanticRole(value, style)
            };

            this.nodes.set(id, node);
            this.groupNodeByType(node);
        });

        // Parse edges with labels
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
            }
        });
    }

    cleanValue(value) {
        return value.replace(/<[^>]*>/g, '').trim();
    }

    extractNodeType(style, value) {
        const typeMatch = style.match(/elementType=([^;]+)/);
        if (typeMatch) return typeMatch[1];

        // Enhanced semantic type detection
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('read') || lowerValue.includes('input') || lowerValue.includes('get')) {
            return 'input_output';
        }
        if (lowerValue.includes('write') || lowerValue.includes('output') || lowerValue.includes('print') || lowerValue.includes('display')) {
            return 'input_output';
        }

        // Style-based detection
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
        if (lowerValue.includes('write') || lowerValue.includes('output') || lowerValue.includes('print') || lowerValue.includes('display')) {
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

    buildAdjacencyList() {
        this.nodes.forEach((node, id) => {
            this.adjacencyList.set(id, []);
        });

        this.edges.forEach(edge => {
            if (this.adjacencyList.has(edge.source)) {
                this.adjacencyList.get(edge.source).push({
                    target: edge.target,
                    condition: edge.condition,
                    label: edge.label
                });
            }
        });
    }

    analyzeSolutionStructure() {
        // Find the main execution path
        this.solutionPath = this.findMainExecutionPath();

        // Identify required elements
        this.identifyRequiredElements();

        // Identify required connections
        this.identifyRequiredConnections();

        console.log('📊 Solution Analysis:');
        console.log('- Main path:', this.solutionPath.map(id => this.nodes.get(id).type).join(' → '));
        console.log('- Required elements:', Array.from(this.requiredElements));
        console.log('- Required connections:', this.requiredConnections.length);
    }

    findMainExecutionPath() {
        const startNodes = this.nodesByType.get('start') || [];
        if (startNodes.length === 0) return [];

        const startNode = startNodes[0];
        const path = [];
        const visited = new Set();

        const dfs = (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const node = this.nodes.get(nodeId);
            if (node && node.type !== 'text') {
                path.push(nodeId);
            }

            // Follow the main path (first connection, or positive condition for decisions)
            const neighbors = this.adjacencyList.get(nodeId) || [];

            if (neighbors.length > 0) {
                // For decisions, prefer positive path, otherwise take first
                const nextNode = neighbors.find(n => n.condition === 'positive') || neighbors[0];
                if (nextNode) {
                    dfs(nextNode.target);
                }
            }
        };

        dfs(startNode.id);
        return path;
    }

    identifyRequiredElements() {
        // All non-text elements in the solution are required
        this.nodes.forEach((node, id) => {
            if (node.type !== 'text') {
                this.requiredElements.add(node.type);
            }
        });

        // Also track semantic roles
        this.nodes.forEach((node, id) => {
            if (node.semanticRole && node.semanticRole !== 'processing') {
                this.requiredElements.add(node.semanticRole);
            }
        });
    }

    identifyRequiredConnections() {
        // Identify critical connections that must exist
        for (let i = 0; i < this.solutionPath.length - 1; i++) {
            const currentId = this.solutionPath[i];
            const nextId = this.solutionPath[i + 1];

            const currentNode = this.nodes.get(currentId);
            const nextNode = this.nodes.get(nextId);

            if (currentNode && nextNode) {
                this.requiredConnections.push({
                    from: currentNode.type,
                    to: nextNode.type,
                    fromRole: currentNode.semanticRole,
                    toRole: nextNode.semanticRole
                });
            }
        }
    }

    getSolutionComplexity() {
        const nodeCount = this.nodes.size;
        const edgeCount = this.edges.length;
        const decisionCount = (this.nodesByType.get('decision') || []).length;
        const ioCount = (this.nodesByType.get('input_output') || []).length;

        return {
            nodeCount,
            edgeCount,
            decisionCount,
            ioCount,
            pathLength: this.solutionPath.length,
            complexity: nodeCount + (decisionCount * 2) + (ioCount * 1.5)
        };
    }
}

class SolutionSpecificFormulaGenerator {
    constructor(analyzer) {
        this.analyzer = analyzer;
        this.complexity = analyzer.getSolutionComplexity();
    }

    generateSolutionSpecificFormulas() {
        const formulas = [];

        console.log('🎯 Generating solution-specific formulas...');

        // 1. Required Element Type Formulas
        formulas.push(...this.generateRequiredElementFormulas());

        // 2. Execution Path Formulas
        formulas.push(...this.generateExecutionPathFormulas());

        // 3. Connection Sequence Formulas
        formulas.push(...this.generateConnectionSequenceFormulas());

        // 4. Semantic Role Formulas
        formulas.push(...this.generateSemanticRoleFormulas());

        // 5. Decision Branch Formulas (if applicable)
        formulas.push(...this.generateDecisionBranchFormulas());

        // 6. Input-Output Flow Formulas (if applicable)
        formulas.push(...this.generateIOFlowFormulas());

        console.log(`📝 Generated ${formulas.length} solution-specific formulas`);
        return formulas;
    }

    generateRequiredElementFormulas() {
        const formulas = [];
        const requiredTypes = Array.from(this.analyzer.requiredElements);

        // Formula to ensure all required element types are present
        if (requiredTypes.length > 0) {
            const elementsList = requiredTypes.filter(type =>
                ['start', 'end', 'process', 'decision', 'input_output', 'predefined', 'document'].includes(type)
            );

            if (elementsList.length > 0) {
                formulas.push({
                    name: 'required_element_types',
                    expression: `□(solution → (${elementsList.map(type => `∃${type}`).join(' ∧ ')}))`,
                    description: `Solution must contain these element types: ${elementsList.join(', ')}`,
                    category: 'structure',
                    priority: 'high'
                });
            }
        }

        // Individual element requirements
        this.analyzer.requiredElements.forEach(elementType => {
            if (['start', 'end', 'process', 'decision', 'input_output', 'predefined'].includes(elementType)) {
                const count = (this.analyzer.nodesByType.get(elementType) || []).length;

                formulas.push({
                    name: `requires_${elementType}`,
                    expression: `□(solution → ∃${elementType})`,
                    description: `Solution requires ${elementType} element${count > 1 ? 's' : ''}`,
                    category: 'structure',
                    priority: 'high'
                });
            }
        });

        return formulas;
    }

    generateExecutionPathFormulas() {
        const formulas = [];
        const path = this.analyzer.solutionPath;

        if (path.length >= 3) {
            // Main execution path formula
            const pathTypes = path.map(id => this.analyzer.nodes.get(id).type);
            const pathSequence = pathTypes.join(' → ');

            formulas.push({
                name: 'main_execution_path',
                expression: `□(start → ◇(${pathTypes.slice(1).join(' ∧ ◇(')}${''.repeat(pathTypes.length - 1)}))`,
                description: `Solution must follow execution path: ${pathSequence}`,
                category: 'flow',
                priority: 'high'
            });

            // Sequential flow requirements
            for (let i = 0; i < pathTypes.length - 1; i++) {
                const current = pathTypes[i];
                const next = pathTypes[i + 1];

                formulas.push({
                    name: `sequence_${current}_to_${next}`,
                    expression: `□(${current} → ◇(${next}))`,
                    description: `${current} must be followed by ${next} in the solution flow`,
                    category: 'flow',
                    priority: 'high'
                });
            }
        }

        return formulas;
    }

    generateConnectionSequenceFormulas() {
        const formulas = [];
        const connections = this.analyzer.requiredConnections;

        connections.forEach((conn, index) => {
            if (conn.from !== conn.to) { // Avoid self-references
                formulas.push({
                    name: `connection_${conn.from}_${conn.to}`,
                    expression: `□(${conn.from} → ◇(${conn.to}))`,
                    description: `${conn.from} must connect to ${conn.to}`,
                    category: 'connectivity',
                    priority: 'high'
                });
            }
        });

        return formulas;
    }

    generateSemanticRoleFormulas() {
        const formulas = [];
        const roles = Array.from(this.analyzer.requiredElements)
            .filter(role => ['data_input', 'data_output', 'computation', 'decision_logic'].includes(role));

        // Input-processing relationship
        if (roles.includes('data_input') && roles.includes('computation')) {
            formulas.push({
                name: 'input_to_processing',
                expression: '□(data_input → ◇(processing))',
                description: 'Input operations must be followed by processing',
                category: 'semantic',
                priority: 'high'
            });
        }

        // Processing-output relationship
        if (roles.includes('computation') && roles.includes('data_output')) {
            formulas.push({
                name: 'processing_to_output',
                expression: '□(processing → ◇(output))',
                description: 'Processing must be followed by output operations',
                category: 'semantic',
                priority: 'high'
            });
        }

        // Complete data flow
        if (roles.includes('data_input') && roles.includes('data_output')) {
            formulas.push({
                name: 'complete_data_flow',
                expression: '□(data_input → ◇(data_output))',
                description: 'Input data must eventually produce output',
                category: 'semantic',
                priority: 'medium'
            });
        }

        return formulas;
    }

    generateDecisionBranchFormulas() {
        const formulas = [];
        const decisions = this.analyzer.nodesByType.get('decision') || [];

        decisions.forEach((decision, index) => {
            const outgoingEdges = this.analyzer.edges.filter(edge => edge.source === decision.id);

            // Ensure decision has multiple branches
            formulas.push({
                name: `decision_${index}_branches`,
                expression: `□(decision_${index} → (∃true_branch ∧ ∃false_branch))`,
                description: `Decision "${decision.value}" must have both true and false branches`,
                category: 'decision_logic',
                priority: 'high'
            });

            // Check for specific branch conditions if they exist
            const positiveBranch = outgoingEdges.find(edge => edge.condition === 'positive');
            const negativeBranch = outgoingEdges.find(edge => edge.condition === 'negative');

            if (positiveBranch && negativeBranch) {
                const positiveTarget = this.analyzer.nodes.get(positiveBranch.target);
                const negativeTarget = this.analyzer.nodes.get(negativeBranch.target);

                if (positiveTarget && negativeTarget) {
                    formulas.push({
                        name: `decision_${index}_branch_targets`,
                        expression: `□(decision_${index} → ((condition_true → ◇(${positiveTarget.type})) ∧ (condition_false → ◇(${negativeTarget.type}))))`,
                        description: `Decision "${decision.value}" must branch to correct target types`,
                        category: 'decision_logic',
                        priority: 'medium'
                    });
                }
            }
        });

        return formulas;
    }

    generateIOFlowFormulas() {
        const formulas = [];
        const ioNodes = this.analyzer.nodesByType.get('input_output') || [];

        // Classify input vs output nodes
        const inputNodes = ioNodes.filter(node =>
            node.semanticRole === 'data_input' ||
            node.value.toLowerCase().includes('input') ||
            node.value.toLowerCase().includes('read') ||
            node.value.toLowerCase().includes('get')
        );

        const outputNodes = ioNodes.filter(node =>
            node.semanticRole === 'data_output' ||
            node.value.toLowerCase().includes('output') ||
            node.value.toLowerCase().includes('write') ||
            node.value.toLowerCase().includes('print') ||
            node.value.toLowerCase().includes('display')
        );

        // Input-output flow requirements
        if (inputNodes.length > 0 && outputNodes.length > 0) {
            formulas.push({
                name: 'input_output_flow_required',
                expression: '□(∃input_operation → ◇(∃output_operation))',
                description: 'Solution requires both input and output operations',
                category: 'io_flow',
                priority: 'high'
            });

            // Specific input-output pairs
            inputNodes.forEach((input, i) => {
                formulas.push({
                    name: `input_${i}_processed`,
                    expression: `□(input_${i} → ◇(processing ∧ ◇(output)))`,
                    description: `Input "${input.value}" must be processed and output`,
                    category: 'io_flow',
                    priority: 'medium'
                });
            });
        }

        return formulas;
    }
}

export const SolutionSpecificLTLService = {
    async generateAndStoreSolutionFormulas(problemId, solutionId, flowchartXml) {
        try {
            console.log('🎯 Analyzing solution structure for specific formula generation...');

            const analyzer = new SolutionStructureAnalyzer(flowchartXml);
            const generator = new SolutionSpecificFormulaGenerator(analyzer);
            const solutionFormulas = generator.generateSolutionSpecificFormulas();

            console.log(`📊 Generated ${solutionFormulas.length} solution-specific formulas`);

            // Remove existing solution formulas
            await supabase
                .from('ltl_formulas')
                .delete()
                .eq('solution_id', solutionId);

            // Insert new solution-specific formulas
            const inserts = solutionFormulas.map(formula => ({
                problem_id: problemId,
                solution_id: solutionId,
                formula_name: formula.name,
                ltl_expression: formula.expression,
                description: formula.description,
                formula_category: formula.category,
                priority: formula.priority || 'medium'
            }));

            if (inserts.length > 0) {
                const { data, error } = await supabase
                    .from('ltl_formulas')
                    .insert(inserts);

                if (error) throw error;
            }

            // Validate the solution itself
            const validation = await this.validateSolutionAgainstUniversal(problemId, flowchartXml);

            console.log('✅ Solution-specific LTL formulas generated successfully');

            return {
                success: true,
                formulaCount: inserts.length,
                formulas: solutionFormulas,
                solutionValidation: validation,
                solutionAnalysis: {
                    mainPath: analyzer.solutionPath.map(id => ({
                        type: analyzer.nodes.get(id).type,
                        value: analyzer.nodes.get(id).value
                    })),
                    requiredElements: Array.from(analyzer.requiredElements),
                    complexity: analyzer.getSolutionComplexity()
                }
            };
        } catch (error) {
            console.error('❌ Error generating solution-specific formulas:', error);
            throw error;
        }
    },

    async validateSolutionAgainstUniversal(problemId, flowchartXml) {
        try {
            // Use the same validation logic as before
            const universalFormulas = await this.getUniversalFormulas();
            const validator = new SimpleFlowchartValidator(flowchartXml);
            const results = universalFormulas.map(formula => validator.evaluateFormula(formula));

            const passedCount = results.filter(r => r.passed).length;
            const totalCount = results.length;
            const score = Math.round((passedCount / totalCount) * 100);

            return {
                isValid: score >= 80,
                score: score,
                passedFormulas: passedCount,
                totalFormulas: totalCount,
                failedChecks: results.filter(r => !r.passed).map(r => ({
                    formula: r.formula_name,
                    description: r.description,
                    details: r.details
                }))
            };
        } catch (error) {
            console.error('❌ Error validating solution:', error);
            return {
                isValid: false,
                error: error.message,
                score: 0
            };
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

// Simple validator class for basic validation
class SimpleFlowchartValidator {
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

        const cells = doc.querySelectorAll('mxCell[vertex="1"]');
        cells.forEach(cell => {
            const id = cell.getAttribute('id');
            const value = cell.getAttribute('value') || '';
            const style = cell.getAttribute('style') || '';

            const nodeType = this.extractNodeType(style, value);
            const node = { id, value, type: nodeType, style, inDegree: 0, outDegree: 0 };

            this.nodes.set(id, node);
            if (!this.nodesByType.has(nodeType)) {
                this.nodesByType.set(nodeType, []);
            }
            this.nodesByType.get(nodeType).push(node);
        });

        const edgeCells = doc.querySelectorAll('mxCell[edge="1"]');
        edgeCells.forEach(edge => {
            const source = edge.getAttribute('source');
            const target = edge.getAttribute('target');
            if (source && target) {
                this.edges.push({ source, target, id: edge.getAttribute('id') });
                const sourceNode = this.nodes.get(source);
                const targetNode = this.nodes.get(target);
                if (sourceNode && sourceNode.type !== 'text') sourceNode.outDegree++;
                if (targetNode && targetNode.type !== 'text') targetNode.inDegree++;
            }
        });
    }

    extractNodeType(style, value) {
        const typeMatch = style.match(/elementType=([^;]+)/);
        if (typeMatch) return typeMatch[1];

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

    evaluateFormula(formula) {
        const { formula_name, ltl_expression, description } = formula;

        try {
            let passed = false;
            let details = '';
            let evidence = {};

            switch (formula_name) {
                case 'has_start_node':
                    const startNodes = this.nodesByType.get('start') || [];
                    passed = startNodes.length === 1;
                    details = passed ? 'Found exactly one start node' :
                        startNodes.length === 0 ? 'No start node found' : 'Multiple start nodes found';
                    evidence = { startNodesCount: startNodes.length };
                    break;

                case 'has_end_node':
                    const endNodes = this.nodesByType.get('end') || [];
                    passed = endNodes.length >= 1;
                    details = passed ? `Found ${endNodes.length} end node(s)` : 'No end node found';
                    evidence = { endNodesCount: endNodes.length };
                    break;

                default:
                    passed = true;
                    details = 'Formula evaluated generically';
                    evidence = { type: 'generic' };
            }

            return {
                formula_name, ltl_expression, description, passed, details, evidence,
                evaluated_at: new Date().toISOString()
            };

        } catch (error) {
            return {
                formula_name, ltl_expression, description, passed: false,
                details: `Evaluation error: ${error.message}`, evidence: { error: true },
                evaluated_at: new Date().toISOString()
            };
        }
    }
}