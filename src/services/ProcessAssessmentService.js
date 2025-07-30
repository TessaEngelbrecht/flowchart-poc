// src/services/ProcessAssessmentService.js
import { supabase } from '../lib/supabase';

export class ProcessAssessmentService {
    constructor() {
        // Size-based complexity thresholds
        this.FLOWCHART_SIZES = {
            SMALL: { min: 1, max: 4, name: 'Small' },
            MEDIUM: { min: 5, max: 10, name: 'Medium' },
            LARGE: { min: 11, max: 20, name: 'Large' },
            EXTRA_LARGE: { min: 21, max: 999, name: 'Extra Large' }
        };

        this.criteria = {
            systematicConstruction: {
                description: "Did the student follow a logical sequence?",
                maxPoints: 25,
                tests: ["element_order", "planning_evidence", "construction_flow"]
            },
            efficiency: {
                description: "How efficiently did the student build their solution?",
                maxPoints: 25,
                tests: ["deletion_ratio", "revision_time", "direct_building"]
            },
            problemSolving: {
                description: "How well did the student handle challenges?",
                maxPoints: 20,
                tests: ["error_recovery", "adaptation", "completion"]
            },
            finalQuality: {
                description: "Quality of the final flowchart structure",
                maxPoints: 15,
                tests: ["connectivity", "completeness", "logical_flow"]
            }
        };
    }

    // Determine flowchart size category
    getFlowchartSize(elementCount) {
        for (const [key, size] of Object.entries(this.FLOWCHART_SIZES)) {
            if (elementCount >= size.min && elementCount <= size.max) {
                return { category: key, ...size };
            }
        }
        return this.FLOWCHART_SIZES.EXTRA_LARGE;
    }

    async assessAlgorithmicThinking(actions, sessionId, studentNumber) {
        console.log('🎯 Starting size-adaptive algorithmic thinking assessment for student:', studentNumber);

        try {
            const elementCount = actions.filter(a => a.action_type === 'add_node').length;
            const flowchartSize = this.getFlowchartSize(elementCount);

            console.log(`📏 Flowchart size: ${flowchartSize.name} (${elementCount} elements)`);

            const analysis = this.performSizeAdaptiveAnalysis(actions, flowchartSize);
            const scores = this.calculateSizeAdaptiveScores(analysis, flowchartSize);
            const feedback = this.generateSizeAdaptiveFeedback(analysis, scores, flowchartSize);

            await this.storeProcessAssessment(sessionId, scores, feedback, analysis, studentNumber);

            return {
                totalScore: scores.total,
                breakdown: scores,
                feedback: feedback,
                testingDetails: this.generateTestingBreakdown(analysis, scores),
                simplifiedAnalysis: analysis,
                flowchartSize: flowchartSize
            };
        } catch (error) {
            console.error('🚨 Size-adaptive assessment failed:', error);
            throw error;
        }
    }

    performSizeAdaptiveAnalysis(actions, flowchartSize) {
        return {
            // Size information
            flowchartSize: flowchartSize,

            // 1. SYSTEMATIC CONSTRUCTION (25 points)
            systematicConstruction: {
                elementOrder: this.analyzeElementOrderBySize(actions, flowchartSize),
                planningEvidence: this.assessPlanningEvidenceBySize(actions, flowchartSize),
                constructionFlow: this.evaluateConstructionFlowBySize(actions, flowchartSize)
            },

            // 2. EFFICIENCY (25 points)
            efficiency: {
                deletionRatio: this.calculateDeletionRatioBySize(actions, flowchartSize),
                revisionTime: this.assessRevisionTimeBySize(actions, flowchartSize),
                directBuilding: this.evaluateDirectBuildingBySize(actions, flowchartSize)
            },

            // 3. PROBLEM SOLVING (20 points)
            problemSolving: {
                errorRecovery: this.assessErrorRecoveryBySize(actions, flowchartSize),
                adaptation: this.evaluateAdaptationBySize(actions, flowchartSize),
                completion: this.assessCompletionBySize(actions, flowchartSize)
            },

            // 4. FINAL QUALITY (15 points)
            finalQuality: {
                connectivity: this.assessConnectivityBySize(actions, flowchartSize),
                completeness: this.assessCompletenessBySize(actions, flowchartSize),
                logicalFlow: this.assessLogicalFlowBySize(actions, flowchartSize)
            },

            // Raw data for detailed feedback
            rawData: {
                totalActions: actions.length,
                addActions: actions.filter(a => a.action_type === 'add_node').length,
                deleteActions: actions.filter(a => a.action_type === 'delete_node').length,
                connectActions: actions.filter(a => a.action_type === 'connect_nodes').length,
                moveActions: actions.filter(a => a.action_type === 'move_node').length,
                editActions: actions.filter(a => a.action_type === 'edit_label').length,
                revisionActions: actions.filter(a =>
                    a.action_type === 'delete_node' ||
                    a.action_type === 'move_node' ||
                    a.action_type === 'edit_label'
                ).length
            }
        };
    }

    // SIZE-ADAPTIVE SYSTEMATIC CONSTRUCTION ANALYSIS (25 points)
    analyzeElementOrderBySize(actions, flowchartSize) {
        const addActions = actions.filter(a => a.action_type === 'add_node');
        if (addActions.length === 0) return { score: 0, details: 'No elements added' };

        const sequence = addActions.map(a => a.element_type);
        const startsWithStart = sequence[0] === 'start';
        const endsWithEnd = sequence[sequence.length - 1] === 'end' || sequence.includes('end');
        const hasLogicalFlow = this.hasBasicLogicalFlow(sequence);

        let score = 0;

        switch (flowchartSize.category) {
            case 'SMALL':
                // Very lenient for small flowcharts
                score = 0.7; // High base score
                if (startsWithStart) score += 0.2;
                if (endsWithEnd) score += 0.1;
                break;

            case 'MEDIUM':
                // Moderate expectations
                score = 0.4;
                if (startsWithStart) score += 0.3;
                if (endsWithEnd) score += 0.2;
                if (hasLogicalFlow) score += 0.1;
                break;

            case 'LARGE':
                // Higher expectations for logical ordering
                score = 0.2;
                if (startsWithStart) score += 0.3;
                if (endsWithEnd) score += 0.2;
                if (hasLogicalFlow) score += 0.3;
                break;

            case 'EXTRA_LARGE':
                // Strict expectations for complex flowcharts
                score = 0.1;
                if (startsWithStart) score += 0.3;
                if (endsWithEnd) score += 0.2;
                if (hasLogicalFlow) score += 0.4;
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                startsWithStart,
                endsWithEnd,
                hasLogicalFlow,
                sequence: sequence,
                sizeCategory: flowchartSize.name,
                evaluation: `${flowchartSize.name} flowchart: ${this.getScoreDescription(score)}`
            }
        };
    }

    assessPlanningEvidenceBySize(actions, flowchartSize) {
        const addActions = actions.filter(a => a.action_type === 'add_node');
        const deleteActions = actions.filter(a => a.action_type === 'delete_node');

        // IMPORTANT: Don't penalize move/edit actions - they're neutral
        const actualRevisionActions = deleteActions; // Only deletions count as planning failures

        const deletionRatio = actualRevisionActions.length / Math.max(addActions.length, 1);
        const hasImmediateCorrections = this.countImmediateCorrections(actions);

        let score = 0;
        let thresholds = {};

        switch (flowchartSize.category) {
            case 'SMALL':
                // Very forgiving for small flowcharts
                thresholds = { excellent: 0.2, good: 0.4, adequate: 0.6 };
                score = 0.8; // High base score
                if (deletionRatio < thresholds.excellent) score = 1.0;
                else if (deletionRatio < thresholds.good) score = 0.9;
                else if (deletionRatio < thresholds.adequate) score = 0.7;
                break;

            case 'MEDIUM':
                thresholds = { excellent: 0.15, good: 0.3, adequate: 0.5 };
                score = 0.6;
                if (deletionRatio < thresholds.excellent) score = 1.0;
                else if (deletionRatio < thresholds.good) score = 0.8;
                else if (deletionRatio < thresholds.adequate) score = 0.6;
                break;

            case 'LARGE':
                thresholds = { excellent: 0.1, good: 0.25, adequate: 0.4 };
                score = 0.4;
                if (deletionRatio < thresholds.excellent) score = 1.0;
                else if (deletionRatio < thresholds.good) score = 0.8;
                else if (deletionRatio < thresholds.adequate) score = 0.6;
                break;

            case 'EXTRA_LARGE':
                thresholds = { excellent: 0.05, good: 0.15, adequate: 0.3 };
                score = 0.3;
                if (deletionRatio < thresholds.excellent) score = 1.0;
                else if (deletionRatio < thresholds.good) score = 0.8;
                else if (deletionRatio < thresholds.adequate) score = 0.6;
                break;
        }

        // Small bonus for few immediate corrections (but don't penalize moves/edits)
        if (hasImmediateCorrections === 0) score = Math.min(1.0, score + 0.1);

        return {
            score: Math.min(1.0, score),
            details: {
                deletionRatio: Math.round(deletionRatio * 100) + '%',
                immediateCorrections: hasImmediateCorrections,
                planningQuality: score > 0.8 ? 'Excellent' : score > 0.6 ? 'Good' : score > 0.4 ? 'Adequate' : 'Needs improvement',
                sizeCategory: flowchartSize.name,
                thresholds: thresholds,
                note: 'Move and edit actions are not penalized - only deletions affect planning score'
            }
        };
    }

    evaluateConstructionFlowBySize(actions, flowchartSize) {
        const addActions = actions.filter(a => a.action_type === 'add_node');
        const hasConnections = actions.some(a => a.action_type === 'connect_nodes');

        let score = 0;

        switch (flowchartSize.category) {
            case 'SMALL':
                // Simple flowcharts get full credit if they have basic flow
                score = hasConnections ? 1.0 : 0.8;
                break;

            case 'MEDIUM':
                // Look for basic phase progression
                const phases = this.identifySimplePhases(actions);
                score = 0.6;
                if (phases.construction > 0) score += 0.2;
                if (phases.connection > 0) score += 0.2;
                break;

            case 'LARGE':
                // More sophisticated flow analysis
                const complexPhases = this.identifyComplexPhases(actions);
                score = 0.3;
                if (complexPhases.planning > 0) score += 0.2;
                if (complexPhases.construction > 0) score += 0.2;
                if (complexPhases.connection > 0) score += 0.2;
                if (complexPhases.refinement > 0) score += 0.1;
                break;

            case 'EXTRA_LARGE':
                // Expect sophisticated workflow management
                const advancedPhases = this.identifyComplexPhases(actions);
                const hasSystematicApproach = this.hasSystematicApproach(actions);
                score = 0.2;
                if (advancedPhases.planning > 0) score += 0.2;
                if (advancedPhases.construction > 0) score += 0.2;
                if (advancedPhases.connection > 0) score += 0.2;
                if (advancedPhases.refinement > 0) score += 0.1;
                if (hasSystematicApproach) score += 0.1;
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                flowQuality: this.getScoreDescription(score),
                sizeCategory: flowchartSize.name,
                hasConnections: hasConnections,
                evaluation: `${flowchartSize.name} flowchart construction flow: ${this.getScoreDescription(score)}`
            }
        };
    }

    // SIZE-ADAPTIVE EFFICIENCY ANALYSIS (25 points)
    calculateDeletionRatioBySize(actions, flowchartSize) {
        const addActions = actions.filter(a => a.action_type === 'add_node').length;
        const deleteActions = actions.filter(a => a.action_type === 'delete_node').length;

        if (addActions === 0) return { score: 1.0, details: 'No elements to evaluate' };

        const ratio = deleteActions / addActions;
        let score = 1.0;

        // Size-based deletion tolerance
        switch (flowchartSize.category) {
            case 'SMALL':
                // Very forgiving for small flowcharts
                if (ratio > 0.2) score = 0.9;
                if (ratio > 0.4) score = 0.8;
                if (ratio > 0.6) score = 0.6;
                break;

            case 'MEDIUM':
                if (ratio > 0.15) score = 0.9;
                if (ratio > 0.3) score = 0.8;
                if (ratio > 0.5) score = 0.6;
                if (ratio > 0.7) score = 0.4;
                break;

            case 'LARGE':
                if (ratio > 0.1) score = 0.9;
                if (ratio > 0.2) score = 0.8;
                if (ratio > 0.4) score = 0.6;
                if (ratio > 0.6) score = 0.4;
                if (ratio > 0.8) score = 0.2;
                break;

            case 'EXTRA_LARGE':
                if (ratio > 0.05) score = 0.9;
                if (ratio > 0.15) score = 0.8;
                if (ratio > 0.3) score = 0.6;
                if (ratio > 0.5) score = 0.4;
                if (ratio > 0.7) score = 0.2;
                break;
        }

        return {
            score: score,
            details: {
                ratio: Math.round(ratio * 100) + '%',
                addActions: addActions,
                deleteActions: deleteActions,
                efficiency: this.getScoreDescription(score),
                sizeCategory: flowchartSize.name,
                note: 'Only deletion actions affect efficiency - moves and edits are neutral'
            }
        };
    }

    assessRevisionTimeBySize(actions, flowchartSize) {
        if (actions.length < 2) return { score: 1.0, details: 'Insufficient actions to measure' };

        const totalTime = this.calculateTotalTime(actions);

        // IMPORTANT: Only count actual problematic revisions, not moves/edits
        const problematicRevisions = actions.filter(a => a.action_type === 'delete_node').length;
        const revisionRatio = problematicRevisions / actions.length;

        let score = 0.8; // Good base score

        // Size-adaptive time and revision expectations
        switch (flowchartSize.category) {
            case 'SMALL':
                // Very lenient for small flowcharts
                score = 0.9;
                if (revisionRatio < 0.1) score = 1.0;
                if (totalTime < 120000) score = Math.min(1.0, score + 0.1); // 2 minutes bonus
                break;

            case 'MEDIUM':
                score = 0.7;
                if (revisionRatio < 0.15) score += 0.2;
                if (revisionRatio < 0.05) score += 0.1;
                if (totalTime < 300000) score += 0.1; // 5 minutes bonus
                break;

            case 'LARGE':
                score = 0.6;
                if (revisionRatio < 0.2) score += 0.2;
                if (revisionRatio < 0.1) score += 0.2;
                if (totalTime < 600000) score += 0.1; // 10 minutes bonus
                break;

            case 'EXTRA_LARGE':
                score = 0.5;
                if (revisionRatio < 0.25) score += 0.2;
                if (revisionRatio < 0.15) score += 0.2;
                if (revisionRatio < 0.05) score += 0.1;
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                revisionRatio: Math.round(revisionRatio * 100) + '%',
                totalTimeMinutes: Math.round(totalTime / 60000),
                efficiency: this.getScoreDescription(score),
                sizeCategory: flowchartSize.name,
                note: 'Only deletions count as problematic revisions'
            }
        };
    }

    evaluateDirectBuildingBySize(actions, flowchartSize) {
        const productiveActions = actions.filter(a =>
            a.action_type === 'add_node' ||
            a.action_type === 'connect_nodes'
        ).length;

        // IMPORTANT: Include moves and edits as neutral, not negative
        const neutralActions = actions.filter(a =>
            a.action_type === 'move_node' ||
            a.action_type === 'edit_label'
        ).length;

        const totalActions = actions.length;
        const productiveRatio = productiveActions / Math.max(totalActions, 1);

        let score = productiveRatio;

        // Size-based productivity expectations
        switch (flowchartSize.category) {
            case 'SMALL':
                // Very lenient - small flowcharts naturally have high productive ratios
                score = Math.max(0.8, score);
                break;

            case 'MEDIUM':
                // Moderate expectations
                if (score > 0.6) score = Math.min(1.0, score + 0.1);
                break;

            case 'LARGE':
                // Expect good productivity but allow for complexity
                if (score > 0.5) score = Math.min(1.0, score + 0.1);
                break;

            case 'EXTRA_LARGE':
                // Allow for more planning and revision time
                if (score > 0.4) score = Math.min(1.0, score + 0.2);
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                productiveRatio: Math.round(productiveRatio * 100) + '%',
                productiveActions: productiveActions,
                neutralActions: neutralActions,
                totalActions: totalActions,
                sizeCategory: flowchartSize.name,
                note: 'Moves and edits are considered neutral actions, not inefficient'
            }
        };
    }

    // SIZE-ADAPTIVE PROBLEM SOLVING ANALYSIS (20 points)
    assessErrorRecoveryBySize(actions, flowchartSize) {
        const deleteActions = actions.filter(a => a.action_type === 'delete_node').length;
        const addActions = actions.filter(a => a.action_type === 'add_node').length;

        if (addActions === 0) return { score: 1.0, details: 'No elements to evaluate' };

        const recoveryRatio = 1 - (deleteActions / addActions);
        let score = Math.max(0.5, recoveryRatio);

        // Size-adaptive error tolerance
        switch (flowchartSize.category) {
            case 'SMALL':
                // Perfect is expected, but very forgiving
                score = Math.max(0.8, score);
                break;

            case 'MEDIUM':
                // Some errors acceptable
                score = Math.max(0.6, score);
                break;

            case 'LARGE':
                // More errors expected in complex flowcharts
                score = Math.max(0.5, score);
                break;

            case 'EXTRA_LARGE':
                // Significant error tolerance for very complex flowcharts
                score = Math.max(0.4, score);
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                deleteActions,
                addActions,
                recoveryQuality: this.getScoreDescription(score),
                sizeCategory: flowchartSize.name
            }
        };
    }

    evaluateAdaptationBySize(actions, flowchartSize) {
        const actionTypes = new Set(actions.map(a => a.action_type));
        let score = 0;

        switch (flowchartSize.category) {
            case 'SMALL':
                // Perfect simple flowcharts need minimal variety
                const hasBasicTypes = actionTypes.has('add_node') && actionTypes.has('connect_nodes');
                if (hasBasicTypes) {
                    score = 1.0; // Full credit for having essential action types
                } else if (actionTypes.has('add_node')) {
                    score = 0.8; // Good credit for at least adding elements
                } else {
                    score = 0.5; // Minimum score
                }
                break;

            case 'MEDIUM':
                const varietyScore = Math.min(1.0, actionTypes.size / 3); // Expect 3 types
                score = Math.max(0.6, varietyScore);
                break;

            case 'LARGE':
                const largeVarietyScore = Math.min(1.0, actionTypes.size / 4); // Expect 4 types
                score = Math.max(0.5, largeVarietyScore);
                break;

            case 'EXTRA_LARGE':
                const extraVarietyScore = Math.min(1.0, actionTypes.size / 5); // Expect 5 types
                score = extraVarietyScore;
                break;
        }

        return {
            score: score,
            details: {
                actionTypes: Array.from(actionTypes),
                variety: actionTypes.size,
                sizeCategory: flowchartSize.name,
                note: flowchartSize.category === 'SMALL' ?
                    'Simple flowcharts require only basic action types for full credit' :
                    'All action types including moves and edits show positive adaptation'
            }
        };
    }

    assessCompletionBySize(actions, flowchartSize) {
        const elementTypes = new Set(
            actions.filter(a => a.action_type === 'add_node')
                .map(a => a.element_type)
        );

        const hasStart = elementTypes.has('start');
        const hasEnd = elementTypes.has('end');
        const hasProcess = elementTypes.has('process');
        const hasConnections = actions.some(a => a.action_type === 'connect_nodes');

        let score = 0;

        // Size-based completion expectations
        switch (flowchartSize.category) {
            case 'SMALL':
                // Basic requirements only
                score = 0.3;
                if (hasStart) score += 0.3;
                if (hasEnd) score += 0.3;
                if (hasConnections) score += 0.1;
                break;

            case 'MEDIUM':
                // Include process elements
                score = 0.2;
                if (hasStart) score += 0.2;
                if (hasEnd) score += 0.2;
                if (hasProcess) score += 0.2;
                if (hasConnections) score += 0.2;
                break;

            case 'LARGE':
                // Expect variety of elements
                score = 0.1;
                if (hasStart) score += 0.2;
                if (hasEnd) score += 0.2;
                if (hasProcess) score += 0.2;
                if (hasConnections) score += 0.2;
                if (elementTypes.has('decision')) score += 0.1;
                break;

            case 'EXTRA_LARGE':
                // Expect comprehensive flowchart
                score = 0.05;
                if (hasStart) score += 0.15;
                if (hasEnd) score += 0.15;
                if (hasProcess) score += 0.15;
                if (hasConnections) score += 0.15;
                if (elementTypes.has('decision')) score += 0.15;
                if (elementTypes.has('input_output')) score += 0.1;
                if (elementTypes.size >= 4) score += 0.1;
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                hasStart,
                hasEnd,
                hasProcess,
                hasConnections,
                elementTypes: Array.from(elementTypes),
                sizeCategory: flowchartSize.name
            }
        };
    }

    // SIZE-ADAPTIVE FINAL QUALITY ANALYSIS (15 points)
    assessConnectivityBySize(actions, flowchartSize) {
        const connections = actions.filter(a => a.action_type === 'connect_nodes').length;
        const elements = actions.filter(a => a.action_type === 'add_node').length;

        if (elements <= 1) return { score: elements > 0 ? 1 : 0, details: 'Single or no elements' };

        const connectivityRatio = connections / Math.max(elements - 1, 1);
        let score = Math.min(1.0, connectivityRatio);

        // Size-based connectivity expectations
        switch (flowchartSize.category) {
            case 'SMALL':
                // Basic connectivity sufficient
                if (connectivityRatio >= 0.8) score = 1.0;
                break;

            case 'MEDIUM':
                // Good connectivity expected
                if (connectivityRatio >= 0.9) score = 1.0;
                break;

            case 'LARGE':
                // High connectivity expected
                if (connectivityRatio >= 1.0) score = 1.0;
                break;

            case 'EXTRA_LARGE':
                // May have redundant connections - allow over-connection
                if (connectivityRatio >= 1.0) score = 1.0;
                break;
        }

        return {
            score: score,
            details: {
                connections,
                elements,
                ratio: Math.round(connectivityRatio * 100) + '%',
                sizeCategory: flowchartSize.name
            }
        };
    }

    assessCompletenessBySize(actions, flowchartSize) {
        const elementTypes = new Set(
            actions.filter(a => a.action_type === 'add_node')
                .map(a => a.element_type)
        );

        let score = 0;

        // Size-based completeness expectations
        switch (flowchartSize.category) {
            case 'SMALL':
                // Just need start and end
                if (elementTypes.has('start')) score += 0.4;
                if (elementTypes.has('end')) score += 0.4;
                if (elementTypes.size >= 3) score += 0.2;
                break;

            case 'MEDIUM':
                // Need variety of elements
                if (elementTypes.has('start')) score += 0.3;
                if (elementTypes.has('end')) score += 0.3;
                if (elementTypes.has('process')) score += 0.2;
                if (elementTypes.has('decision')) score += 0.2;
                break;

            case 'LARGE':
                // Need comprehensive element usage
                const basicTypes = ['start', 'end', 'process'].filter(type => elementTypes.has(type));
                const advancedTypes = ['decision', 'input_output'].filter(type => elementTypes.has(type));

                score = (basicTypes.length / 3) * 0.7 + (advancedTypes.length / 2) * 0.3;
                break;

            case 'EXTRA_LARGE':
                // Expect sophisticated element variety
                const requiredTypes = ['start', 'end', 'process', 'decision'];
                const bonusTypes = ['input_output', 'document', 'predefined'];

                const requiredScore = requiredTypes.filter(type => elementTypes.has(type)).length / requiredTypes.length;
                const bonusScore = bonusTypes.filter(type => elementTypes.has(type)).length / bonusTypes.length;

                score = requiredScore * 0.8 + bonusScore * 0.2;
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                elementTypes: Array.from(elementTypes),
                completeness: this.getScoreDescription(score),
                sizeCategory: flowchartSize.name
            }
        };
    }

    assessLogicalFlowBySize(actions, flowchartSize) {
        const connections = actions.filter(a => a.action_type === 'connect_nodes').length;
        const elements = actions.filter(a => a.action_type === 'add_node').length;

        if (elements === 0) return { score: 0, details: 'No elements' };

        const flowRatio = connections / Math.max(elements, 1);
        const hasStartEnd = this.hasStartAndEnd(actions);

        let score = 0;

        switch (flowchartSize.category) {
            case 'SMALL':
                // Perfect scoring for well-connected small flowcharts
                if (hasStartEnd) {
                    const expectedConnections = Math.max(1, elements - 1); // n-1 connections expected
                    if (connections >= expectedConnections) {
                        score = 1.0; // Perfect score for proper connectivity
                    } else if (connections > 0) {
                        score = 0.8; // Good score for some connectivity
                    } else {
                        score = 0.3; // Basic score for having start/end
                    }
                } else {
                    score = flowRatio * 0.5; // Reduced score without proper start/end
                }
                break;

            case 'MEDIUM':
                score = flowRatio * 0.7;
                if (hasStartEnd) score += 0.3;
                if (hasStartEnd && flowRatio >= 0.8) score = Math.max(0.7, score);
                break;

            case 'LARGE':
                score = flowRatio * 0.7;
                if (hasStartEnd) score += 0.3;
                if (hasStartEnd && flowRatio >= 1.0) score = Math.max(0.6, score);
                break;

            case 'EXTRA_LARGE':
                score = flowRatio * 0.7;
                if (hasStartEnd) score += 0.3;
                const hasComplexFlow = this.hasComplexFlowPatterns(actions);
                if (hasComplexFlow) score = Math.min(1.0, score + 0.2);
                break;
        }

        return {
            score: Math.min(1.0, score),
            details: {
                flowRatio: Math.round(flowRatio * 100) + '%',
                hasStartEnd,
                connections,
                elements,
                sizeCategory: flowchartSize.name,
                expectedConnections: flowchartSize.category === 'SMALL' ? Math.max(1, elements - 1) : 'Variable',
                note: flowchartSize.category === 'SMALL' ?
                    `Perfect flow achieved: ${connections} connections for ${elements} elements` :
                    'Flow analysis based on complexity expectations'
            }
        };
    }

    // SIZE-ADAPTIVE SCORING CALCULATION
    calculateSizeAdaptiveScores(analysis, flowchartSize) {
        // Get base scores from analysis
        const systematicScore = Math.round(
            (analysis.systematicConstruction.elementOrder.score * 8) +
            (analysis.systematicConstruction.planningEvidence.score * 8) +
            (analysis.systematicConstruction.constructionFlow.score * 9)
        );

        const efficiencyScore = Math.round(
            (analysis.efficiency.deletionRatio.score * 10) +
            (analysis.efficiency.revisionTime.score * 8) +
            (analysis.efficiency.directBuilding.score * 7)
        );

        const problemSolvingScore = Math.round(
            (analysis.problemSolving.errorRecovery.score * 8) +
            (analysis.problemSolving.adaptation.score * 6) +
            (analysis.problemSolving.completion.score * 6)
        );

        const qualityScore = Math.round(
            (analysis.finalQuality.connectivity.score * 5) +
            (analysis.finalQuality.completeness.score * 5) +
            (analysis.finalQuality.logicalFlow.score * 5)
        );

        // Enhanced perfect small flowchart detection
        if (flowchartSize.category === 'SMALL') {
            const elementCount = analysis.rawData.addActions;
            const isPerfectSimpleFlow = (
                analysis.systematicConstruction.elementOrder.details.startsWithStart &&
                analysis.systematicConstruction.elementOrder.details.endsWithEnd &&
                analysis.systematicConstruction.planningEvidence.details.deletionRatio === '0%' &&
                analysis.rawData.deleteActions === 0 &&
                analysis.rawData.connectActions >= Math.max(1, elementCount - 1) &&
                elementCount >= 3
            );

            if (isPerfectSimpleFlow) {
                console.log('🌟 Perfect simple flowchart detected - awarding maximum scores');
                return {
                    planning: 25,     // Perfect systematic construction
                    refinement: 25,   // Perfect efficiency
                    efficiency: 20,   // Perfect problem solving
                    patterns: 15,     // Perfect final quality
                    errorRecovery: 0,
                    total: 85         // Perfect total for small flowchart context
                };
            }
        }

        // Apply size-based bonuses for well-executed flowcharts
        let finalSystematicScore = systematicScore;
        let finalEfficiencyScore = efficiencyScore;
        let finalProblemSolvingScore = problemSolvingScore;
        let finalQualityScore = qualityScore;

        if (flowchartSize.category === 'SMALL') {
            // Bonus for well-executed simple flowcharts that aren't perfect
            const elementCount = analysis.rawData.addActions;
            const isWellExecuted = (
                analysis.systematicConstruction.elementOrder.details.startsWithStart &&
                analysis.systematicConstruction.elementOrder.details.endsWithEnd &&
                parseFloat(analysis.systematicConstruction.planningEvidence.details.deletionRatio) <= 10
            );

            if (isWellExecuted && elementCount >= 3) {
                finalSystematicScore = Math.min(25, systematicScore + 2);
                finalEfficiencyScore = Math.min(25, efficiencyScore + 1);
                finalProblemSolvingScore = Math.min(20, problemSolvingScore + 1);
                finalQualityScore = Math.min(15, qualityScore + 1);
            }
        }

        const total = finalSystematicScore + finalEfficiencyScore + finalProblemSolvingScore + finalQualityScore;

        return {
            planning: Math.min(25, finalSystematicScore),
            refinement: Math.min(25, finalEfficiencyScore),
            efficiency: Math.min(20, finalProblemSolvingScore),
            patterns: Math.min(15, finalQualityScore),
            errorRecovery: 0,
            total: Math.min(100, total)
        };
    }

    // Enhanced helper methods
    identifyComplexPhases(actions) {
        const phases = {
            planning: 0,
            construction: actions.filter(a => a.action_type === 'add_node').length,
            connection: actions.filter(a => a.action_type === 'connect_nodes').length,
            refinement: actions.filter(a => a.action_type === 'delete_node').length
        };

        // Identify planning phase (initial slower actions)
        if (actions.length > 5) {
            const firstFive = actions.slice(0, 5);
            phases.planning = firstFive.filter(a => a.action_type === 'add_node').length;
        }

        return phases;
    }

    hasSystematicApproach(actions) {
        // Check for evidence of systematic workflow
        const addActions = actions.filter(a => a.action_type === 'add_node');
        if (addActions.length < 5) return true; // Assume systematic for small flowcharts

        // Check if elements are added in logical groups
        const elementGroups = this.groupElementsByType(addActions);
        return elementGroups.length > 1; // Multiple phases of construction
    }

    hasComplexFlowPatterns(actions) {
        const elementTypes = new Set(
            actions.filter(a => a.action_type === 'add_node')
                .map(a => a.element_type)
        );

        // Look for complex patterns: loops, multiple decisions, etc.
        return elementTypes.has('decision') && elementTypes.size >= 5;
    }

    groupElementsByType(addActions) {
        const groups = [];
        let currentGroup = { type: null, actions: [] };

        addActions.forEach(action => {
            if (currentGroup.type !== action.element_type) {
                if (currentGroup.actions.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = { type: action.element_type, actions: [action] };
            } else {
                currentGroup.actions.push(action);
            }
        });

        if (currentGroup.actions.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    getScoreDescription(score) {
        if (score >= 0.9) return 'Excellent';
        if (score >= 0.8) return 'Very Good';
        if (score >= 0.7) return 'Good';
        if (score >= 0.6) return 'Adequate';
        if (score >= 0.5) return 'Fair';
        return 'Needs Improvement';
    }

    // SIZE-ADAPTIVE FEEDBACK GENERATION
    generateSizeAdaptiveFeedback(analysis, scores, flowchartSize) {
        const feedback = {
            strengths: [],
            improvements: [],
            suggestions: [],
            sizeSpecificAdvice: []
        };

        // Size-specific opening feedback
        switch (flowchartSize.category) {
            case 'SMALL':
                if (scores.total >= 85) {
                    feedback.strengths.push(`🌟 Excellent execution of a ${flowchartSize.name.toLowerCase()} flowchart! Perfect for simple problems.`);
                }
                break;

            case 'MEDIUM':
                if (scores.total >= 80) {
                    feedback.strengths.push(`⭐ Strong systematic approach for a ${flowchartSize.name.toLowerCase()}-sized flowchart!`);
                }
                break;

            case 'LARGE':
                if (scores.total >= 75) {
                    feedback.strengths.push(`🎯 Impressive management of a ${flowchartSize.name.toLowerCase()} flowchart complexity!`);
                }
                break;

            case 'EXTRA_LARGE':
                if (scores.total >= 70) {
                    feedback.strengths.push(`🚀 Outstanding handling of an ${flowchartSize.name.toLowerCase()} flowchart - excellent systematic thinking!`);
                }
                break;
        }

        // Size-specific advice
        switch (flowchartSize.category) {
            case 'SMALL':
                feedback.sizeSpecificAdvice.push("💡 For simple flowcharts like this, focus on clear logical flow from start to end");
                break;

            case 'MEDIUM':
                feedback.sizeSpecificAdvice.push("💡 Medium flowcharts benefit from planning element groups before construction");
                break;

            case 'LARGE':
                feedback.sizeSpecificAdvice.push("💡 Large flowcharts require systematic phase-by-phase construction");
                break;

            case 'EXTRA_LARGE':
                feedback.sizeSpecificAdvice.push("💡 Extra large flowcharts need careful planning and modular construction approach");
                break;
        }

        // General feedback based on scores
        if (scores.planning >= 20) {
            feedback.strengths.push("📋 Excellent systematic construction approach");
        }

        if (analysis.efficiency.deletionRatio.score >= 0.8) {
            feedback.strengths.push("⚡ Excellent efficiency - minimal unnecessary deletions");
        }

        // Note about moves and edits being positive
        if (analysis.rawData.moveActions > 0 || analysis.rawData.editActions > 0) {
            feedback.strengths.push("✨ Good attention to layout and labeling - moves and edits show refinement, not inefficiency");
        }

        return feedback;
    }

    // Keep existing helper methods unchanged
    hasBasicLogicalFlow(sequence) {
        const startIndex = sequence.indexOf('start');
        const endIndex = sequence.lastIndexOf('end');
        if (startIndex === -1 || endIndex === -1) return false;
        return startIndex < endIndex;
    }

    countImmediateCorrections(actions) {
        let corrections = 0;
        for (let i = 1; i < actions.length; i++) {
            const prev = actions[i - 1];
            const curr = actions[i];
            if (prev.action_type === 'add_node' &&
                curr.action_type === 'delete_node' &&
                prev.element_id === curr.element_id) {
                corrections++;
            }
        }
        return corrections;
    }

    identifySimplePhases(actions) {
        return {
            construction: actions.filter(a => a.action_type === 'add_node').length,
            connection: actions.filter(a => a.action_type === 'connect_nodes').length,
            revision: actions.filter(a => a.action_type === 'delete_node').length
        };
    }

    calculateTotalTime(actions) {
        if (actions.length < 2) return 0;
        const start = new Date(actions[0].timestamp);
        const end = new Date(actions[actions.length - 1].timestamp);
        return end - start;
    }

    hasStartAndEnd(actions) {
        const elementTypes = new Set(
            actions.filter(a => a.action_type === 'add_node')
                .map(a => a.element_type)
        );
        return elementTypes.has('start') && elementTypes.has('end');
    }

    // Updated testing breakdown to reflect size-adaptive scoring
    generateTestingBreakdown(analysis, scores) {
        return {
            systematicConstruction: {
                totalPoints: 25,
                earnedPoints: scores.planning,
                sizeCategory: analysis.flowchartSize.name,
                tests: {
                    elementOrder: {
                        description: "Did you add elements in a logical sequence?",
                        score: analysis.systematicConstruction.elementOrder.score,
                        points: Math.round(analysis.systematicConstruction.elementOrder.score * 8),
                        maxPoints: 8,
                        feedback: analysis.systematicConstruction.elementOrder.details
                    },
                    planningEvidence: {
                        description: "Did you plan before building (minimal deletions)?",
                        score: analysis.systematicConstruction.planningEvidence.score,
                        points: Math.round(analysis.systematicConstruction.planningEvidence.score * 8),
                        maxPoints: 8,
                        feedback: analysis.systematicConstruction.planningEvidence.details
                    },
                    constructionFlow: {
                        description: "Did you follow a natural construction flow?",
                        score: analysis.systematicConstruction.constructionFlow.score,
                        points: Math.round(analysis.systematicConstruction.constructionFlow.score * 9),
                        maxPoints: 9,
                        feedback: analysis.systematicConstruction.constructionFlow.details
                    }
                }
            },
            efficiency: {
                totalPoints: 25,
                earnedPoints: scores.refinement,
                sizeCategory: analysis.flowchartSize.name,
                tests: {
                    deletionRatio: {
                        description: "How few unnecessary deletions did you make?",
                        score: analysis.efficiency.deletionRatio.score,
                        points: Math.round(analysis.efficiency.deletionRatio.score * 10),
                        maxPoints: 10,
                        feedback: analysis.efficiency.deletionRatio.details
                    },
                    revisionTime: {
                        description: "How efficiently did you work?",
                        score: analysis.efficiency.revisionTime.score,
                        points: Math.round(analysis.efficiency.revisionTime.score * 8),
                        maxPoints: 8,
                        feedback: analysis.efficiency.revisionTime.details
                    },
                    directBuilding: {
                        description: "How directly did you build toward your solution?",
                        score: analysis.efficiency.directBuilding.score,
                        points: Math.round(analysis.efficiency.directBuilding.score * 7),
                        maxPoints: 7,
                        feedback: analysis.efficiency.directBuilding.details
                    }
                }
            },
            problemSolving: {
                totalPoints: 20,
                earnedPoints: scores.efficiency,
                sizeCategory: analysis.flowchartSize.name,
                tests: {
                    errorRecovery: {
                        description: "How well did you handle and fix mistakes?",
                        score: analysis.problemSolving.errorRecovery.score,
                        points: Math.round(analysis.problemSolving.errorRecovery.score * 8),
                        maxPoints: 8,
                        feedback: analysis.problemSolving.errorRecovery.details
                    },
                    adaptation: {
                        description: "How well did you adapt your approach?",
                        score: analysis.problemSolving.adaptation.score,
                        points: Math.round(analysis.problemSolving.adaptation.score * 6),
                        maxPoints: 6,
                        feedback: analysis.problemSolving.adaptation.details
                    },
                    completion: {
                        description: "How complete is your final solution?",
                        score: analysis.problemSolving.completion.score,
                        points: Math.round(analysis.problemSolving.completion.score * 6),
                        maxPoints: 6,
                        feedback: analysis.problemSolving.completion.details
                    }
                }
            },
            finalQuality: {
                totalPoints: 15,
                earnedPoints: scores.patterns,
                sizeCategory: analysis.flowchartSize.name,
                tests: {
                    connectivity: {
                        description: "Are your flowchart elements properly connected?",
                        score: analysis.finalQuality.connectivity.score,
                        points: Math.round(analysis.finalQuality.connectivity.score * 5),
                        maxPoints: 5,
                        feedback: analysis.finalQuality.connectivity.details
                    },
                    completeness: {
                        description: "Does your flowchart have all necessary elements?",
                        score: analysis.finalQuality.completeness.score,
                        points: Math.round(analysis.finalQuality.completeness.score * 5),
                        maxPoints: 5,
                        feedback: analysis.finalQuality.completeness.details
                    },
                    logicalFlow: {
                        description: "Does your flowchart follow logical flow principles?",
                        score: analysis.finalQuality.logicalFlow.score,
                        points: Math.round(analysis.finalQuality.logicalFlow.score * 5),
                        maxPoints: 5,
                        feedback: analysis.finalQuality.logicalFlow.details
                    }
                }
            }
        };
    }

    // Keep existing storage methods unchanged
    async storeProcessAssessment(sessionId, scores, feedback, analysis, studentNumber) {
        try {
            console.log('🔍 Fetching session data for storage...');

            const { data: sessionData, error: sessionError } = await supabase
                .from('flowchart_sessions')
                .select('problem_id, student_number')
                .eq('id', sessionId)
                .single();

            if (sessionError) {
                console.error('❌ Session fetch error:', sessionError);
                throw sessionError;
            }

            console.log('📋 Session data retrieved:', sessionData);

            const clampScore = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));

            const validatedScores = {
                planning_score: clampScore(scores.planning, 0, 25),
                refinement_score: clampScore(scores.refinement, 0, 25),
                efficiency_score: clampScore(scores.efficiency, 0, 20),
                pattern_score: clampScore(scores.patterns, 0, 15),
                error_recovery_score: clampScore(scores.errorRecovery || 0, 0, 15),
                total_score: clampScore(scores.total, 0, 100)
            };

            console.log('✅ Validated scores (size-adaptive):', validatedScores);

            const sanitizedFeedback = JSON.parse(JSON.stringify(feedback || {}));
            const sanitizedAnalysis = JSON.parse(JSON.stringify(analysis || {}));

            const insertData = {
                session_id: sessionId,
                problem_id: sessionData.problem_id,
                student_number: studentNumber || sessionData.student_number,
                ...validatedScores,
                feedback_details: sanitizedFeedback,
                action_analysis: sanitizedAnalysis,
                created_at: new Date().toISOString()
            };

            const { data: insertResult, error: insertError } = await supabase
                .from('process_assessments')
                .insert(insertData)
                .select()
                .single();

            if (insertError) {
                console.error('💥 Process assessment insert error:', insertError);
                throw insertError;
            }

            console.log('✅ Size-adaptive process assessment stored successfully:', insertResult.id);
            return insertResult;

        } catch (error) {
            console.error('🚨 Error in storeProcessAssessment:', error);
            throw error;
        }
    }
}
