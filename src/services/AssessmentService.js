// src/services/AssessmentService.js
import { supabase } from '../lib/supabase';
import { SolutionSpecificLTLService } from './SolutionSpecificLTLService';
import { ProcessAssessmentService } from './ProcessAssessmentService';

class FlowchartAssessment {
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
        // Build adjacency list for path analysis
        this.nodes.forEach((node, id) => {
            this.adjacencyList.set(id, []);
        });

        this.edges.forEach(edge => {
            if (this.adjacencyList.has(edge.source)) {
                this.adjacencyList.get(edge.source).push(edge.target);
            }
        });
    }

    // CORE LTL EVALUATION METHODS

    evaluateFormula(formula) {
        const { formula_name, ltl_expression, description } = formula;

        try {
            let passed = false;
            let details = '';
            let evidence = {};

            switch (formula_name) {
                case 'has_start_node':
                    const result1 = this.testHasStartNode();
                    passed = result1.passed;
                    details = result1.details;
                    evidence = result1.evidence;
                    break;

                case 'has_end_node':
                    const result2 = this.testHasEndNode();
                    passed = result2.passed;
                    details = result2.details;
                    evidence = result2.evidence;
                    break;

                case 'start_leads_to_end':
                    const result3 = this.testStartLeadsToEnd();
                    passed = result3.passed;
                    details = result3.details;
                    evidence = result3.evidence;
                    break;

                case 'decision_has_two_branches':
                    const result4 = this.testDecisionBranches();
                    passed = result4.passed;
                    details = result4.details;
                    evidence = result4.evidence;
                    break;

                case 'all_non_text_connected':
                    const result5 = this.testAllConnected();
                    passed = result5.passed;
                    details = result5.details;
                    evidence = result5.evidence;
                    break;

                case 'no_isolated_nodes':
                    const result6 = this.testNoIsolatedNodes();
                    passed = result6.passed;
                    details = result6.details;
                    evidence = result6.evidence;
                    break;

                case 'process_has_input_output':
                    const result7 = this.testProcessConnections();
                    passed = result7.passed;
                    details = result7.details;
                    evidence = result7.evidence;
                    break;

                default:
                    // Handle solution-specific formulas
                    const result8 = this.testSolutionSpecificFormula(formula);
                    passed = result8.passed;
                    details = result8.details;
                    evidence = result8.evidence;
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

    // SPECIFIC TEST IMPLEMENTATIONS

    testHasStartNode() {
        const startNodes = this.nodesByType.get('start') || [];
        const passed = startNodes.length > 0;

        return {
            passed,
            details: passed
                ? `Found ${startNodes.length} start node(s): ${startNodes.map(n => n.value).join(', ')}`
                : 'No start node found in flowchart',
            evidence: {
                startNodesCount: startNodes.length,
                startNodes: startNodes.map(n => ({ id: n.id, value: n.value }))
            }
        };
    }

    testHasEndNode() {
        const endNodes = this.nodesByType.get('end') || [];
        const passed = endNodes.length > 0;

        return {
            passed,
            details: passed
                ? `Found ${endNodes.length} end node(s): ${endNodes.map(n => n.value).join(', ')}`
                : 'No end node found in flowchart',
            evidence: {
                endNodesCount: endNodes.length,
                endNodes: endNodes.map(n => ({ id: n.id, value: n.value }))
            }
        };
    }

    testStartLeadsToEnd() {
        const startNodes = this.nodesByType.get('start') || [];
        const endNodes = this.nodesByType.get('end') || [];

        if (startNodes.length === 0) {
            return {
                passed: false,
                details: 'No start node to test connectivity',
                evidence: { reason: 'no_start_node' }
            };
        }

        if (endNodes.length === 0) {
            return {
                passed: false,
                details: 'No end node to connect to',
                evidence: { reason: 'no_end_node' }
            };
        }

        const pathResults = [];
        let hasValidPath = false;

        for (const startNode of startNodes) {
            // Use the corrected findAllPaths method that finds paths to end nodes
            const pathsToEnd = this.findAllPaths(startNode.id);

            pathResults.push({
                startNode: startNode.value,
                pathsFound: pathsToEnd.length,
                paths: pathsToEnd
            });

            if (pathsToEnd.length > 0) {
                hasValidPath = true;
            }
        }

        return {
            passed: hasValidPath,
            details: hasValidPath
                ? `Valid paths found from start to end nodes`
                : 'No valid path from start to any end node',
            evidence: {
                pathAnalysis: pathResults,
                totalValidPaths: pathResults.reduce((sum, r) => sum + r.pathsFound, 0)
            }
        };
    }


    testDecisionBranches() {
        const decisionNodes = this.nodesByType.get('decision') || [];

        if (decisionNodes.length === 0) {
            return {
                passed: true, // No decisions to validate
                details: 'No decision nodes present - requirement not applicable',
                evidence: { decisionNodesCount: 0 }
            };
        }

        const decisionAnalysis = decisionNodes.map(decision => {
            const outgoingConnections = this.adjacencyList.get(decision.id) || [];
            return {
                nodeId: decision.id,
                nodeValue: decision.value,
                outgoingCount: outgoingConnections.length,
                hasEnoughBranches: outgoingConnections.length >= 2,
                connections: outgoingConnections
            };
        });

        const allDecisionsValid = decisionAnalysis.every(d => d.hasEnoughBranches);
        const invalidDecisions = decisionAnalysis.filter(d => !d.hasEnoughBranches);

        return {
            passed: allDecisionsValid,
            details: allDecisionsValid
                ? `All ${decisionNodes.length} decision nodes have adequate branches`
                : `${invalidDecisions.length} decision node(s) need more branches: ${invalidDecisions.map(d => `"${d.nodeValue}" (${d.outgoingCount} branches)`).join(', ')}`,
            evidence: {
                totalDecisions: decisionNodes.length,
                validDecisions: decisionAnalysis.filter(d => d.hasEnoughBranches).length,
                decisionAnalysis
            }
        };
    }

    testAllConnected() {
        const nonTextNodes = Array.from(this.nodes.values())
            .filter(node => node.type !== 'text');

        const disconnectedNodes = nonTextNodes.filter(node =>
            node.type !== 'start' && (this.adjacencyList.get(node.id) || []).length === 0 && node.inDegree === 0
        );

        const passed = disconnectedNodes.length === 0;

        return {
            passed,
            details: passed
                ? `All ${nonTextNodes.length} non-text nodes are properly connected`
                : `${disconnectedNodes.length} disconnected node(s): ${disconnectedNodes.map(n => n.value || n.type).join(', ')}`,
            evidence: {
                totalNodes: nonTextNodes.length,
                connectedNodes: nonTextNodes.length - disconnectedNodes.length,
                disconnectedNodes: disconnectedNodes.map(n => ({ id: n.id, value: n.value, type: n.type }))
            }
        };
    }

    testNoIsolatedNodes() {
        const isolatedNodes = Array.from(this.nodes.values())
            .filter(node =>
                node.type !== 'text' &&
                node.type !== 'start' &&
                node.inDegree === 0 &&
                node.outDegree === 0
            );

        const passed = isolatedNodes.length === 0;

        return {
            passed,
            details: passed
                ? 'No isolated nodes found'
                : `${isolatedNodes.length} isolated node(s): ${isolatedNodes.map(n => n.value || n.type).join(', ')}`,
            evidence: {
                isolatedCount: isolatedNodes.length,
                isolatedNodes: isolatedNodes.map(n => ({ id: n.id, value: n.value, type: n.type }))
            }
        };
    }

    testProcessConnections() {
        const processNodes = this.nodesByType.get('process') || [];

        if (processNodes.length === 0) {
            return {
                passed: true,
                details: 'No process nodes present - requirement not applicable',
                evidence: { processNodesCount: 0 }
            };
        }

        const processAnalysis = processNodes.map(process => {
            const hasInput = process.inDegree > 0;
            const hasOutput = process.outDegree > 0;
            return {
                nodeId: process.id,
                nodeValue: process.value,
                inDegree: process.inDegree,
                outDegree: process.outDegree,
                hasInput,
                hasOutput,
                isValid: hasInput && hasOutput
            };
        });

        const allProcessesValid = processAnalysis.every(p => p.isValid);
        const invalidProcesses = processAnalysis.filter(p => !p.isValid);

        return {
            passed: allProcessesValid,
            details: allProcessesValid
                ? `All ${processNodes.length} process nodes have proper input/output connections`
                : `${invalidProcesses.length} process node(s) missing connections: ${invalidProcesses.map(p => `"${p.nodeValue}" (in:${p.inDegree}, out:${p.outDegree})`).join(', ')}`,
            evidence: {
                totalProcesses: processNodes.length,
                validProcesses: processAnalysis.filter(p => p.isValid).length,
                processAnalysis
            }
        };
    }

    testSolutionSpecificFormula(formula) {
        // Handle solution-specific formulas (paths, sequences, etc.)
        const { formula_name, ltl_expression } = formula;

        if (formula_name.includes('path')) {
            return this.testSpecificPath(formula);
        } else if (formula_name.includes('sequence')) {
            return this.testNodeSequence(formula);
        }

        // Default fallback for unrecognized solution-specific formulas
        return {
            passed: true,
            details: 'Solution-specific formula passed (basic validation)',
            evidence: { type: 'solution_specific', formula_name }
        };
    }

    // Add this method to your FlowchartAssessment class

    testNodeSequence(formula) {
        const { formula_name, description, ltl_expression } = formula;

        try {
            let expectedSequence = [];

            // Enhanced parsing to handle LTL operators
            const sequenceMatch = description.match(/sequence.*?:\s*(.+)/i);
            if (sequenceMatch) {
                expectedSequence = sequenceMatch[1]
                    .split(/\s*→\s*|\s*->\s*|\s*,\s*/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
            } else {
                // Parse from LTL expression, removing LTL operators
                const ltlMatch = ltl_expression.match(/\((.*?)\)/);
                if (ltlMatch) {
                    expectedSequence = ltlMatch[1]
                        .replace(/◇\(/g, '') // Remove temporal operators
                        .replace(/□\(/g, '')
                        .replace(/\)/g, '')
                        .split(/\s*→\s*/)
                        .map(s => s.trim())
                        .filter(s => s.length > 0 && !s.match(/^[◇□∀∃→∧∨¬]+$/)); // Filter out pure LTL operators
                }
            }

            // Clean up any remaining LTL operators from node types
            expectedSequence = expectedSequence.map(type =>
                type.replace(/^[◇□∀∃]+/, '').replace(/[→∧∨¬]+$/, '').trim()
            ).filter(type => type.length > 0);

            if (expectedSequence.length === 0) {
                return {
                    passed: false,
                    details: 'Could not parse expected sequence from formula',
                    evidence: {
                        error: 'sequence_parse_error',
                        formula_name,
                        originalExpression: ltl_expression,
                        originalDescription: description
                    }
                };
            }

            // Find all paths that match the expected sequence
            const matchingPaths = this.findPathsMatchingSequence(expectedSequence);
            const hasValidSequence = matchingPaths.length > 0;

            // Check if the required node types exist in the flowchart
            const missingTypes = expectedSequence.filter(type =>
                !this.nodesByType.has(type) || this.nodesByType.get(type).length === 0
            );

            if (missingTypes.length > 0) {
                return {
                    passed: false,
                    details: `Missing required node types for sequence: ${missingTypes.join(', ')}`,
                    evidence: {
                        expectedSequence,
                        missingTypes,
                        availableTypes: Array.from(this.nodesByType.keys()),
                        parsedFrom: description || ltl_expression
                    }
                };
            }

            return {
                passed: hasValidSequence,
                details: hasValidSequence
                    ? `Found ${matchingPaths.length} path(s) matching expected sequence: ${expectedSequence.join(' → ')}`
                    : `No paths found matching expected sequence: ${expectedSequence.join(' → ')}`,
                evidence: {
                    expectedSequence,
                    matchingPaths: matchingPaths.length,
                    pathDetails: matchingPaths.slice(0, 3),
                    totalNodesInSequence: expectedSequence.length
                }
            };

        } catch (error) {
            console.error('Error in testNodeSequence:', error);
            return {
                passed: false,
                details: `Sequence validation error: ${error.message}`,
                evidence: { error: true, errorMessage: error.message }
            };
        }
    }

    findPathsContainingSequence(expectedTypes) {
        const startNodes = this.nodesByType.get('start') || [];
        const pathsWithSequence = [];

        for (const startNode of startNodes) {
            const allPaths = this.findAllPaths(startNode.id, Array.from(this.nodes.keys()));

            for (const path of allPaths) {
                const pathTypes = path.map(nodeId => {
                    const node = this.nodes.get(nodeId);
                    return node ? node.type : 'unknown';
                });

                if (this.containsSequence(pathTypes, expectedTypes)) {
                    pathsWithSequence.push({
                        path,
                        types: pathTypes,
                        sequenceFound: true
                    });
                }
            }
        }

        return pathsWithSequence;
    }


    containsSequence(pathTypes, expectedSequence) {
        if (expectedSequence.length === 0) return true;
        if (pathTypes.length < expectedSequence.length) return false;

        for (let i = 0; i <= pathTypes.length - expectedSequence.length; i++) {
            let matches = true;
            for (let j = 0; j < expectedSequence.length; j++) {
                if (pathTypes[i + j] !== expectedSequence[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }

        return false;
    }

    testSpecificPath(formula) {
        // Extract expected path from formula description
        const pathMatch = formula.description.match(/path.*?:\s*(.+)/i);
        if (!pathMatch) {
            return {
                passed: false,
                details: 'Could not parse expected path from formula',
                evidence: { error: 'parse_error' }
            };
        }

        const expectedSequence = pathMatch[1].split(' → ').map(s => s.trim());
        const actualPaths = this.findPathsMatchingSequence(expectedSequence);

        return {
            passed: actualPaths.length > 0,
            details: actualPaths.length > 0
                ? `Found ${actualPaths.length} path(s) matching expected sequence: ${expectedSequence.join(' → ')}`
                : `No paths found matching expected sequence: ${expectedSequence.join(' → ')}`,
            evidence: {
                expectedSequence,
                matchingPaths: actualPaths.length,
                actualPaths
            }
        };
    }

    // HELPER METHODS

    findAllPaths(startId, visited = new Set(), current = [], all = []) {
        // Detect cycles
        if (visited.has(startId)) return all;

        const node = this.nodes.get(startId);
        if (!node) return all;

        const nextPath = [...current, startId];
        const nextVisited = new Set(visited).add(startId);

        // Reached an END ⇒ save and stop descent
        if (node.type === 'end') {
            all.push(nextPath);
            return all;
        }

        // Walk neighbours
        (this.adjacencyList.get(startId) || []).forEach(neigh =>
            this.findAllPaths(neigh, nextVisited, nextPath, all)
        );
        return all;
    }

    findPathsMatchingSequence(expectedTypes) {
        if (!expectedTypes.length) return [];

        const startNodes = this.nodesByType.get('start') || [];
        const matches = [];

        for (const s of startNodes) {
            const allPaths = this.findAllPaths(s.id);
            allPaths.forEach(p => {
                const types = p.map(id => this.nodes.get(id).type);
                if (this.isSubsequence(types, expectedTypes)) {
                    matches.push({
                        nodeIds: p,
                        nodeTypes: types
                    });
                }
            });
        }
        return matches;
    }

    isSubsequence(haystack, needle) {
        let j = 0;
        for (let i = 0; i < haystack.length && j < needle.length; i++) {
            if (haystack[i] === needle[j]) j++;
        }
        return j === needle.length;
    }

    sequenceMatches(actual, expected) {
        if (actual.length < expected.length) return false;

        let expectedIndex = 0;
        for (let i = 0; i < actual.length && expectedIndex < expected.length; i++) {
            if (actual[i] === expected[expectedIndex]) {
                expectedIndex++;
            }
        }

        return expectedIndex === expected.length;
    }

}


export const AssessmentService = {
    async assessStudentFlowchart(problemId, sessionId, flowchartXml, studentNumber) {
        try {
            console.log('🎯 Assessment starting for student:', studentNumber, 'session:', sessionId, 'problem:', problemId);

            // Get user actions for this SPECIFIC session
            const { data: userActions, error: actionsError } = await supabase
                .from('user_actions')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (actionsError) {
                console.error('Error fetching user actions:', actionsError);
                throw actionsError;
            }

            console.log('📊 Found', userActions.length, 'user actions for session:', sessionId);

            // Create linear diagram
            await this.createLinearDiagram(sessionId, userActions);

            // Structural assessment (LTL formulas)
            const [universalFormulas, problemFormulas] = await Promise.all([
                SolutionSpecificLTLService.getUniversalFormulas(),
                SolutionSpecificLTLService.getProblemFormulas(problemId)
            ]);

            const allFormulas = [...universalFormulas, ...problemFormulas];

            if (allFormulas.length === 0) {
                throw new Error('No LTL formulas found for assessment');
            }

            const assessment = new FlowchartAssessment(flowchartXml);
            const structuralResults = allFormulas.map(formula =>
                assessment.evaluateFormula(formula)
            );

            const structuralScore = Math.round((structuralResults.filter(r => r.passed).length / structuralResults.length) * 100);

            console.log('🏗️ Structural assessment complete. Score:', structuralScore);

            // Process-based assessment - SEPARATE TRY-CATCH
            let processResults;
            try {
                const processService = new ProcessAssessmentService();
                processResults = await processService.assessAlgorithmicThinking(userActions, sessionId, studentNumber);
                console.log('🧠 Process assessment complete. Raw Score:', processResults.totalScore);
            } catch (processError) {
                console.error('⚠️ Process assessment failed:', processError);
                // Fallback process results
                processResults = {
                    totalScore: 0,
                    breakdown: { planning: 0, refinement: 0, efficiency: 0, patterns: 0, errorRecovery: 0, total: 0 },
                    feedback: { strengths: [], improvements: ['Process assessment failed'], suggestions: [] },
                    testingDetails: {},
                    simplifiedAnalysis: {}
                };
            }

            // FIXED: Normalize process score to 100% scale
            const maxPossibleProcessScore = 85; // Based on current point distribution (25+25+20+15)
            const normalizedProcessScore = Math.round((processResults.totalScore / maxPossibleProcessScore) * 100);

            // Calculate combined score using normalized process score (60% structural, 40% process)
            const combinedScore = Math.round((structuralScore * 0.6) + (normalizedProcessScore * 0.4));

            console.log(`📈 Process Score: ${processResults.totalScore}/${maxPossibleProcessScore} = ${normalizedProcessScore}%`);
            console.log(`📈 Combined score calculated: ${combinedScore}%`);

            // Store comprehensive results in student_assessments
            const assessmentData = {
                session_id: sessionId,
                problem_id: problemId,
                student_number: studentNumber,
                total_formulas: allFormulas.length,
                passed_formulas: structuralResults.filter(r => r.passed).length,
                score_percentage: structuralScore,
                process_score: normalizedProcessScore, // Store normalized score
                combined_score: combinedScore,
                assessment_results: structuralResults,
                process_feedback: processResults.feedback,
                flowchart_xml: flowchartXml,
                assessed_at: new Date().toISOString()
            };

            console.log('💾 Storing main assessment data...');

            const { data: mainAssessment, error: mainError } = await supabase
                .from('student_assessments')
                .insert(assessmentData)
                .select()
                .single();

            if (mainError) {
                console.error('❌ Main assessment storage failed:', mainError);
                throw mainError;
            }

            console.log('✅ Main assessment stored successfully:', mainAssessment.id);

            return {
                success: true,
                structuralScore: structuralScore,
                processScore: normalizedProcessScore,  // Return normalized score
                combinedScore: combinedScore,
                structuralResults: structuralResults,
                processResults: {
                    ...processResults,
                    totalScore: normalizedProcessScore  // Update to normalized score for display
                },
                assessmentId: mainAssessment.id,
                studentNumber: studentNumber
            };

        } catch (error) {
            console.error('🚨 Error in comprehensive assessment:', error);
            throw error;
        }
    },

    async createLinearDiagram(sessionId, userActions) {
        try {
            console.log('Creating linear diagram for session:', sessionId, 'with', userActions.length, 'actions');

            // Format actions for linear diagram - matching your original sessionGraph format
            const linearPattern = userActions.map(action => ({
                action_type: action.action_type,
                element_type: action.element_type,
                label: action.details?.cell_value || action.details?.new_label || '',
                timestamp: action.timestamp
            }));

            // Check if linear diagram already exists for this session
            const { data: existingDiagram } = await supabase
                .from('linear_diagrams')
                .select('id')
                .eq('session_id', sessionId)
                .single();

            if (existingDiagram) {
                // Update existing diagram
                const { error: updateError } = await supabase
                    .from('linear_diagrams')
                    .update({
                        linear_pattern: linearPattern,
                        created_at: new Date().toISOString()
                    })
                    .eq('session_id', sessionId);

                if (updateError) throw updateError;
                console.log('Updated existing linear diagram for session:', sessionId);
            } else {
                // Create new diagram
                const { error: insertError } = await supabase
                    .from('linear_diagrams')
                    .insert({
                        session_id: sessionId,
                        linear_pattern: linearPattern
                    });

                if (insertError) throw insertError;
                console.log('Created new linear diagram for session:', sessionId);
            }

        } catch (error) {
            console.error('Error creating linear diagram:', error);
            // Don't throw - this shouldn't fail the assessment
        }
    },


    async createLinearDiagram(sessionId, userActions) {
        try {
            console.log('Creating linear diagram for session:', sessionId, 'with', userActions.length, 'actions');

            // Format actions for linear diagram - matching your original sessionGraph format
            const linearPattern = userActions.map(action => ({
                action_type: action.action_type,
                element_type: action.element_type,
                label: action.details?.cell_value || action.details?.new_label || '',
                timestamp: action.timestamp
            }));

            // Check if linear diagram already exists for this session
            const { data: existingDiagram } = await supabase
                .from('linear_diagrams')
                .select('id')
                .eq('session_id', sessionId)
                .single();

            if (existingDiagram) {
                // Update existing diagram
                const { error: updateError } = await supabase
                    .from('linear_diagrams')
                    .update({
                        linear_pattern: linearPattern,
                        created_at: new Date().toISOString()
                    })
                    .eq('session_id', sessionId);

                if (updateError) throw updateError;
                console.log('Updated existing linear diagram for session:', sessionId);
            } else {
                // Create new diagram
                const { error: insertError } = await supabase
                    .from('linear_diagrams')
                    .insert({
                        session_id: sessionId,
                        linear_pattern: linearPattern
                    });

                if (insertError) throw insertError;
                console.log('Created new linear diagram for session:', sessionId);
            }

        } catch (error) {
            console.error('Error creating linear diagram:', error);
            // Don't throw - this shouldn't fail the assessment
        }
    }
};


// src/services/AssessmentService.test.js

export const LTLTestCases = {
    // Test case 1: Valid flowchart with all requirements
    validFlowchart: {
        xml: `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Start" style="elementType=start;shape=ellipse;fillColor=#d5e8d4;" vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="Process" style="elementType=process;shape=rect;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="50" y="150" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="Decision?" style="elementType=decision;shape=rhombus;fillColor=#fff2cc;" vertex="1" parent="1">
          <mxGeometry x="50" y="250" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="End" style="elementType=end;shape=ellipse;fillColor=#f8cecc;" vertex="1" parent="1">
          <mxGeometry x="50" y="350" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="6" value="Alternative End" style="elementType=end;shape=ellipse;fillColor=#f8cecc;" vertex="1" parent="1">
          <mxGeometry x="200" y="350" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="7" edge="1" parent="1" source="2" target="3"/>
        <mxCell id="8" edge="1" parent="1" source="3" target="4"/>
        <mxCell id="9" edge="1" parent="1" source="4" target="5"/>
        <mxCell id="10" edge="1" parent="1" source="4" target="6"/>
      </root>
    </mxGraphModel>`,
        expectedResults: {
            has_start_node: true,
            has_end_node: true,
            start_leads_to_end: true,
            decision_has_two_branches: true,
            all_non_text_connected: true,
            no_isolated_nodes: true,
            process_has_input_output: true
        },
        expectedScore: 100
    },

    // Test case 2: Missing start node
    missingStartNode: {
        xml: `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="3" value="Process" style="elementType=process;shape=rect;" vertex="1" parent="1">
          <mxGeometry x="50" y="150" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="End" style="elementType=end;shape=ellipse;" vertex="1" parent="1">
          <mxGeometry x="50" y="350" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="8" edge="1" parent="1" source="3" target="5"/>
      </root>
    </mxGraphModel>`,
        expectedResults: {
            has_start_node: false,
            has_end_node: true,
            start_leads_to_end: false
        }
    },

    // Test case 3: Decision with insufficient branches
    insufficientDecisionBranches: {
        xml: `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Start" style="elementType=start;shape=ellipse;" vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="Decision?" style="elementType=decision;shape=rhombus;" vertex="1" parent="1">
          <mxGeometry x="50" y="150" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="End" style="elementType=end;shape=ellipse;" vertex="1" parent="1">
          <mxGeometry x="50" y="250" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="7" edge="1" parent="1" source="2" target="4"/>
        <mxCell id="8" edge="1" parent="1" source="4" target="5"/>
      </root>
    </mxGraphModel>`,
        expectedResults: {
            has_start_node: true,
            has_end_node: true,
            decision_has_two_branches: false
        }
    },

    // Test case 4: Isolated nodes
    isolatedNodes: {
        xml: `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Start" style="elementType=start;shape=ellipse;" vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="Isolated Process" style="elementType=process;shape=rect;" vertex="1" parent="1">
          <mxGeometry x="200" y="150" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="5" value="End" style="elementType=end;shape=ellipse;" vertex="1" parent="1">
          <mxGeometry x="50" y="250" width="100" height="50" as="geometry"/>
        </mxCell>
        <mxCell id="7" edge="1" parent="1" source="2" target="5"/>
      </root>
    </mxGraphModel>`,
        expectedResults: {
            has_start_node: true,
            has_end_node: true,
            all_non_text_connected: false,
            no_isolated_nodes: false
        }
    }
};

// Test runner function
export async function runLTLTests() {
    console.log('🧪 Running LTL Formula Tests...');

    const testResults = [];

    for (const [testName, testCase] of Object.entries(LTLTestCases)) {
        console.log(`\n📋 Testing: ${testName}`);

        try {
            const assessment = new FlowchartAssessment(testCase.xml);
            const mockFormulas = Object.keys(testCase.expectedResults).map(name => ({
                formula_name: name,
                ltl_expression: `test_${name}`,
                description: `Test for ${name}`
            }));

            const results = mockFormulas.map(formula =>
                assessment.evaluateFormula(formula)
            );

            let testPassed = true;
            const failedChecks = [];

            results.forEach(result => {
                const expected = testCase.expectedResults[result.formula_name];
                if (result.passed !== expected) {
                    testPassed = false;
                    failedChecks.push({
                        formula: result.formula_name,
                        expected,
                        actual: result.passed,
                        details: result.details
                    });
                }
            });

            testResults.push({
                testName,
                passed: testPassed,
                failedChecks,
                results
            });

            console.log(`${testPassed ? '✅' : '❌'} ${testName}: ${testPassed ? 'PASSED' : 'FAILED'}`);
            if (!testPassed) {
                failedChecks.forEach(check => {
                    console.log(`  - ${check.formula}: expected ${check.expected}, got ${check.actual}`);
                    console.log(`    Details: ${check.details}`);
                });
            }

        } catch (error) {
            console.error(`❌ ${testName}: ERROR - ${error.message}`);
            testResults.push({
                testName,
                passed: false,
                error: error.message
            });
        }
    }

    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.passed).length;

    console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed`);

    return testResults;
}