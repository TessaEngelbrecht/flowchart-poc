// src/services/LTLService.js
import { supabase } from '../lib/supabase';

class FlowchartAnalyzer {
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

        // Parse nodes with embedded type information
        const cells = doc.querySelectorAll('mxCell[vertex="1"]');
        cells.forEach(cell => {
            const id = cell.getAttribute('id');
            const value = cell.getAttribute('value') || '';
            const style = cell.getAttribute('style') || '';

            // Check if type is embedded in the style or value
            let nodeType = this.extractEmbeddedType(style, value) || this.determineNodeType(style);

            const node = {
                id,
                value,
                type: nodeType,
                style,
                inDegree: 0,
                outDegree: 0
            };

            this.nodes.set(id, node);

            // Group by type
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

                // Update degrees (ignore text nodes)
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

    extractEmbeddedType(style, value) {
        // Look for embedded type information in style
        const typeMatch = style.match(/elementType=([^;]+)/);
        if (typeMatch) {
            return typeMatch[1];
        }

        // Look for type in value as backup
        const valueTypeMatch = value.match(/\[type:([^\]]+)\]/);
        if (valueTypeMatch) {
            return valueTypeMatch[1];
        }

        return null;
    }

    determineNodeType(style) {
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

    hasElementType(type) {
        return this.nodesByType.has(type) && this.nodesByType.get(type).length > 0;
    }

    getElementsOfType(type) {
        return this.nodesByType.get(type) || [];
    }

    getAllPaths() {
        const paths = [];
        const startNodes = this.getElementsOfType('start');

        const dfs = (current, path, visited) => {
            if (visited.has(current)) return;

            const newPath = [...path, current];
            const newVisited = new Set(visited);
            newVisited.add(current);

            const node = this.nodes.get(current);
            if (node && node.type === 'end') {
                paths.push(newPath);
                return;
            }

            const successors = this.edges
                .filter(edge => edge.source === current)
                .map(edge => edge.target)
                .filter(target => {
                    const targetNode = this.nodes.get(target);
                    return targetNode && targetNode.type !== 'text'; // Skip text nodes
                });

            if (successors.length === 0) {
                paths.push(newPath);
            } else {
                successors.forEach(successor => {
                    dfs(successor, newPath, newVisited);
                });
            }
        };

        startNodes.forEach(startNode => {
            dfs(startNode.id, [], new Set());
        });

        return paths;
    }
}

class LTLFormulaGenerator {
    constructor(analyzer) {
        this.analyzer = analyzer;
    }

    generateSolutionSpecific() {
        const formulas = [];
        const paths = this.analyzer.getAllPaths();

        // Generate path-specific formulas
        paths.forEach((path, index) => {
            if (path.length > 1) {
                const pathNodes = path.map(nodeId => this.analyzer.nodes.get(nodeId));
                const nodeTypes = pathNodes.map(node => node.type);

                let expression = nodeTypes[0];
                for (let i = 1; i < nodeTypes.length; i++) {
                    expression += ` → ◇(${nodeTypes[i]})`;
                }

                formulas.push({
                    name: `solution_path_${index + 1}`,
                    expression: `□(${expression})`,
                    description: `Solution path ${index + 1}: ${nodeTypes.join(' → ')}`
                });
            }
        });

        // Generate node sequence requirements based on solution
        this.generateSequenceFormulas(formulas);

        return formulas;
    }

    generateSequenceFormulas(formulas) {
        // Check if specific sequences exist in the solution
        const hasInput = this.analyzer.hasElementType('input_output');
        const hasProcess = this.analyzer.hasElementType('process');
        const hasDecision = this.analyzer.hasElementType('decision');

        if (hasInput && hasProcess) {
            formulas.push({
                name: 'solution_input_process_sequence',
                expression: '□(input_output → ◇(process))',
                description: 'Input should be followed by processing in this solution'
            });
        }

        if (hasProcess && hasDecision) {
            formulas.push({
                name: 'solution_process_decision_sequence',
                expression: '□(process → ◇(decision))',
                description: 'Process should lead to decision in this solution'
            });
        }
    }
}

export const LTLService = {
    async generateAndStoreSolutionFormulas(problemId, solutionId, flowchartXml) {
        try {
            const analyzer = new FlowchartAnalyzer(flowchartXml);
            const generator = new LTLFormulaGenerator(analyzer);
            const solutionFormulas = generator.generateSolutionSpecific();

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
                description: formula.description
            }));

            const { data, error } = await supabase
                .from('ltl_formulas')
                .insert(inserts);

            if (error) throw error;

            return {
                success: true,
                formulaCount: inserts.length,
                formulas: solutionFormulas
            };
        } catch (error) {
            console.error('Error generating solution formulas:', error);
            throw error;
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
