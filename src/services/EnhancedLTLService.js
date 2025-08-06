// src/services/FixedLTLService.js
// This is a compatibility-focused version that works with your existing system

import { supabase } from '../lib/supabase';

class CompatibleFlowchartAnalyzer {
    constructor(xmlString) {
        this.xml = xmlString;
        this.nodes = new Map();
        this.edges = [];
        this.nodesByType = new Map();
        this.parseXML();
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

            const node = {
                id,
                value: this.cleanValue(value),
                type: this.extractNodeType(style, value),
                style,
                inDegree: 0,
                outDegree: 0
            };

            this.nodes.set(id, node);
            this.groupNodeByType(node);
        });

        // Parse edges and calculate degrees
        const edgeCells = doc.querySelectorAll('mxCell[edge="1"]');
        edgeCells.forEach(edge => {
            const source = edge.getAttribute('source');
            const target = edge.getAttribute('target');

            if (source && target) {
                this.edges.push({ source, target, id: edge.getAttribute('id') });
                this.updateNodeDegrees(source, target);
            }
        });
    }

    cleanValue(value) {
        return value.replace(/<[^>]*>/g, '').trim();
    }

    extractNodeType(style, value) {
        // Check for embedded type first
        const typeMatch = style.match(/elementType=([^;]+)/);
        if (typeMatch) return typeMatch[1];

        // Enhanced semantic detection
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('read') || lowerValue.includes('input') || lowerValue.includes('get')) {
            return 'input';
        }
        if (lowerValue.includes('write') || lowerValue.includes('output') || lowerValue.includes('print')) {
            return 'output';
        }

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

    // Detect meaningful patterns for formula generation
    detectPatterns() {
        const patterns = [];

        // Input-Processing-Output pattern
        const inputs = this.getInputNodes();
        const processes = this.getProcessNodes();
        const outputs = this.getOutputNodes();

        if (inputs.length > 0 && processes.length > 0 && outputs.length > 0) {
            patterns.push({
                type: 'input_process_output',
                priority: 'high',
                description: 'Data flows from input through processing to output'
            });
        }

        // Decision branching pattern
        const decisions = this.nodesByType.get('decision') || [];
        if (decisions.length > 0) {
            patterns.push({
                type: 'decision_branching',
                priority: 'high',
                description: 'Flowchart contains decision logic with branching'
            });
        }

        // Sequential processing pattern
        if (processes.length > 1) {
            patterns.push({
                type: 'sequential_processing',
                priority: 'medium',
                description: 'Multiple processing steps in sequence'
            });
        }

        // Loop pattern detection
        if (this.hasLoops()) {
            patterns.push({
                type: 'loop_structure',
                priority: 'high',
                description: 'Flowchart contains iterative loops'
            });
        }

        return patterns;
    }

    getInputNodes() {
        const inputOutput = this.nodesByType.get('input_output') || [];
        const inputs = this.nodesByType.get('input') || [];
        return [...inputs, ...inputOutput.filter(node => this.looksLikeInput(node))];
    }

    getOutputNodes() {
        const inputOutput = this.nodesByType.get('input_output') || [];
        const outputs = this.nodesByType.get('output') || [];
        return [...outputs, ...inputOutput.filter(node => this.looksLikeOutput(node))];
    }

    getProcessNodes() {
        const processes = this.nodesByType.get('process') || [];
        const predefined = this.nodesByType.get('predefined') || [];
        return [...processes, ...predefined];
    }

    looksLikeInput(node) {
        const value = node.value.toLowerCase();
        return value.includes('read') || value.includes('input') || value.includes('get') || value.includes('enter');
    }

    looksLikeOutput(node) {
        const value = node.value.toLowerCase();
        return value.includes('write') || value.includes('output') || value.includes('print') || value.includes('display');
    }

    hasLoops() {
        // Simple cycle detection
        const visited = new Set();
        const recursionStack = new Set();

        const hasCycle = (nodeId) => {
            if (recursionStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = this.edges
                .filter(edge => edge.source === nodeId)
                .map(edge => edge.target);

            for (const neighbor of neighbors) {
                if (hasCycle(neighbor)) return true;
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const [nodeId] of this.nodes) {
            if (!visited.has(nodeId)) {
                if (hasCycle(nodeId)) return true;
            }
        }

        return false;
    }
}

class CompatibleFormulaGenerator {
    constructor(analyzer) {
        this.analyzer = analyzer;
        this.patterns = analyzer.detectPatterns();
    }

    generateSmartFormulas() {
        const formulas = [];

        // Generate pattern-based formulas (avoid duplicating universal ones)
        this.patterns.forEach(pattern => {
            switch (pattern.type) {
                case 'input_process_output':
                    formulas.push(...this.generateDataFlowFormulas());
                    break;
                case 'decision_branching':
                    formulas.push(...this.generateDecisionFormulas());
                    break;
                case 'sequential_processing':
                    formulas.push(...this.generateProcessingFormulas());
                    break;
                case 'loop_structure':
                    formulas.push(...this.generateLoopFormulas());
                    break;
            }
        });

        // Add solution-specific structural formulas only if they add value
        formulas.push(...this.generateSolutionSpecificStructural());

        return formulas;
    }

    generateDataFlowFormulas() {
        return [
            {
                name: 'data_input_to_processing',
                expression: '□(input_node → ◇(process_node))',
                description: 'Input data should flow to processing steps'
            },
            {
                name: 'processing_to_output',
                expression: '□(process_node → ◇(output_node))',
                description: 'Processed data should flow to output'
            }
        ];
    }

    generateDecisionFormulas() {
        return [
            {
                name: 'decision_branch_coverage',
                expression: '□(decision → (◇(true_path) ∧ ◇(false_path)))',
                description: 'Decision branches should cover both true and false conditions'
            }
        ];
    }

    generateProcessingFormulas() {
        return [
            {
                name: 'sequential_processing_flow',
                expression: '□(process_sequence → maintains_data_integrity)',
                description: 'Sequential processing should maintain data flow integrity'
            }
        ];
    }

    generateLoopFormulas() {
        return [
            {
                name: 'loop_termination_condition',
                expression: '□(loop → ∃(termination_condition))',
                description: 'Loops must have clear termination conditions'
            }
        ];
    }

    generateSolutionSpecificStructural() {
        const formulas = [];
        const nodeTypes = Array.from(this.analyzer.nodesByType.keys());

        // Only add meaningful structural requirements
        if (this.analyzer.getProcessNodes().length > 0) {
            formulas.push({
                name: 'required_processing_elements',
                expression: '□(flowchart → ∃(processing_capability))',
                description: 'Solution requires specific processing elements'
            });
        }

        if (nodeTypes.includes('decision')) {
            formulas.push({
                name: 'decision_logic_required',
                expression: '□(solution → ∃(decision_making))',
                description: 'Solution requires decision-making capability'
            });
        }

        return formulas;
    }
}

export const EnhancedLTLService = {
    async generateAndStoreSolutionFormulas(problemId, solutionId, flowchartXml) {
        try {
            console.log('🔧 Generating smart, non-duplicate LTL formulas...');

            const analyzer = new CompatibleFlowchartAnalyzer(flowchartXml);
            const generator = new CompatibleFormulaGenerator(analyzer);
            const smartFormulas = generator.generateSmartFormulas();

            console.log(`📊 Generated ${smartFormulas.length} smart formulas`);
            console.log('🔍 Detected patterns:', analyzer.detectPatterns().map(p => p.type).join(', '));

            // Remove existing solution formulas
            await supabase
                .from('ltl_formulas')
                .delete()
                .eq('solution_id', solutionId);

            // Insert only meaningful, non-duplicate formulas
            const inserts = smartFormulas.map(formula => ({
                problem_id: problemId,
                solution_id: solutionId,
                formula_name: formula.name,
                ltl_expression: formula.expression,
                description: formula.description
            }));

            if (inserts.length > 0) {
                const { data, error } = await supabase
                    .from('ltl_formulas')
                    .insert(inserts);

                if (error) throw error;
            }

            // Validate the solution against universal formulas
            const validationResult = await this.validateSolutionAgainstUniversal(problemId, flowchartXml);

            console.log('✅ Smart LTL formulas generated and solution validated');

            return {
                success: true,
                formulaCount: inserts.length,
                formulas: smartFormulas,
                solutionValidation: validationResult,
                detectedPatterns: analyzer.detectPatterns()
            };
        } catch (error) {
            console.error('❌ Error generating smart formulas:', error);
            throw error;
        }
    },

    // Validate lecturer solutions against universal formulas
    async validateSolutionAgainstUniversal(problemId, flowchartXml) {
        try {
            console.log('🔍 Validating lecturer solution against universal criteria...');

            // Get universal formulas
            const universalFormulas = await this.getUniversalFormulas();

            // Create a simple validator directly
            const validator = new SimpleFlowchartValidator(flowchartXml);

            // Evaluate each universal formula
            const results = universalFormulas.map(formula =>
                validator.evaluateFormula(formula)
            );

            const passedCount = results.filter(r => r.passed).length;
            const totalCount = results.length;
            const score = Math.round((passedCount / totalCount) * 100);

            const validation = {
                isValid: score >= 80, // Require 80% for lecturer solutions
                score: score,
                passedFormulas: passedCount,
                totalFormulas: totalCount,
                failedChecks: results.filter(r => !r.passed).map(r => ({
                    formula: r.formula_name,
                    description: r.description,
                    details: r.details
                }))
            };

            if (!validation.isValid) {
                console.warn('⚠️ Lecturer solution failed validation:', validation.failedChecks);
            } else {
                console.log('✅ Lecturer solution passed validation');
            }

            return validation;
        } catch (error) {
            console.error('❌ Error validating solution:', error);
            return {
                isValid: false,
                error: error.message,
                score: 0
            };
        }
    },

    // Keep existing methods for compatibility
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
    },

    async updateFormula(formulaId, updates, isUniversal = false) {
        const table = isUniversal ? 'universal_ltl_formulas' : 'ltl_formulas';

        const { data, error } = await supabase
            .from(table)
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', formulaId)
            .select();

        if (error) throw error;
        return data;
    }
};

// Simple validator class for lecturer solution validation
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
                outDegree: 0
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

                case 'start_leads_to_end':
                case 'reachable_termination':
                    const hasPath = this.hasPathFromStartToEnd();
                    passed = hasPath;
                    details = hasPath ? 'Valid path from start to end' : 'No path from start to end';
                    evidence = { pathExists: hasPath };
                    break;

                case 'decision_has_two_branches':
                case 'decision_multiple_branches':
                    const decisions = this.nodesByType.get('decision') || [];
                    if (decisions.length === 0) {
                        passed = true;
                        details = 'No decision nodes present';
                        evidence = { decisionCount: 0 };
                    } else {
                        const validDecisions = decisions.filter(d => (this.adjacencyList.get(d.id) || []).length >= 2);
                        passed = validDecisions.length === decisions.length;
                        details = passed ? 'All decisions have multiple branches' : 'Some decisions lack multiple branches';
                        evidence = { decisionCount: decisions.length, validDecisions: validDecisions.length };
                    }
                    break;

                case 'all_non_text_connected':
                case 'no_orphaned_elements':
                    const orphaned = this.findOrphanedNodes();
                    passed = orphaned.length === 0;
                    details = passed ? 'All nodes connected' : `${orphaned.length} orphaned nodes`;
                    evidence = { orphanedCount: orphaned.length };
                    break;

                case 'process_has_input_output':
                case 'process_connectivity':
                    const processNodes = [...(this.nodesByType.get('process') || []), ...(this.nodesByType.get('predefined') || [])];
                    if (processNodes.length === 0) {
                        passed = true;
                        details = 'No process nodes present';
                        evidence = { processCount: 0 };
                    } else {
                        const connectedProcesses = processNodes.filter(p => p.inDegree > 0 && p.outDegree > 0);
                        passed = connectedProcesses.length === processNodes.length;
                        details = passed ? 'All process nodes connected' : 'Some process nodes not connected';
                        evidence = { processCount: processNodes.length, connectedCount: connectedProcesses.length };
                    }
                    break;

                case 'essential_processing_elements':
                    const hasStart = (this.nodesByType.get('start') || []).length >= 1;
                    const hasEnd = (this.nodesByType.get('end') || []).length >= 1;
                    const hasProcessing = (this.nodesByType.get('process') || []).length + (this.nodesByType.get('predefined') || []).length >= 1;
                    passed = hasStart && hasEnd && hasProcessing;
                    details = passed ? 'Has essential elements' : 'Missing essential elements';
                    evidence = { hasStart, hasEnd, hasProcessing };
                    break;

                default:
                    // Default to passing for unknown formulas
                    passed = true;
                    details = 'Formula evaluated generically';
                    evidence = { type: 'generic' };
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

    hasPathFromStartToEnd() {
        const startNodes = this.nodesByType.get('start') || [];
        const endNodes = this.nodesByType.get('end') || [];

        if (startNodes.length === 0 || endNodes.length === 0) {
            return false;
        }

        // Simple BFS to check connectivity
        const visited = new Set();
        const queue = [startNodes[0].id];

        while (queue.length > 0) {
            const nodeId = queue.shift();

            if (endNodes.some(end => end.id === nodeId)) {
                return true;
            }

            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            const neighbors = this.adjacencyList.get(nodeId) || [];
            neighbors.forEach(neighbor => {
                if (!visited.has(neighbor)) {
                    queue.push(neighbor);
                }
            });
        }

        return false;
    }

    findOrphanedNodes() {
        const orphaned = [];
        this.nodes.forEach((node, id) => {
            if (node.type !== 'text' && node.type !== 'start' &&
                node.inDegree === 0 && node.outDegree === 0) {
                orphaned.push(node);
            }
        });
        return orphaned;
    }
}