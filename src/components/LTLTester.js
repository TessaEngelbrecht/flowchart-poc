// src/components/LTLTester.js

import React, { useState } from 'react';
import { LTLTestCases, runLTLTests } from '../services/AssessmentService.test';
import { AssessmentService } from '../services/AssessmentService';

const LTLTester = ({ problem }) => {
    const [testResults, setTestResults] = useState(null);
    const [customXml, setCustomXml] = useState('');
    const [testing, setTesting] = useState(false);

    const runTests = async () => {
        setTesting(true);
        try {
            const results = await runLTLTests();
            setTestResults(results);
        } catch (error) {
            console.error('Testing failed:', error);
        } finally {
            setTesting(false);
        }
    };

    const testCustomFlowchart = async () => {
        if (!customXml.trim()) return;

        setTesting(true);
        try {
            const result = await AssessmentService.assessStudentFlowchart(
                problem.id,
                'test-session',
                customXml
            );

            console.log('Custom test result:', result);

        } catch (error) {
            console.error('Custom test failed:', error);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="ltl-tester">
            <div className="tester-header">
                <h3>🧪 LTL Formula Tester</h3>
                <p>Test your LTL formulas against various flowchart scenarios</p>
            </div>

            <div className="test-actions">
                <button
                    onClick={runTests}
                    disabled={testing}
                    className="btn btn-primary"
                >
                    {testing ? 'Running Tests...' : 'Run Standard Tests'}
                </button>
            </div>

            {testResults && (
                <div className="test-results">
                    <h4>Test Results</h4>
                    {testResults.map((result, index) => (
                        <div key={index} className={`test-result ${result.passed ? 'passed' : 'failed'}`}>
                            <h5>{result.testName}</h5>
                            <p>{result.passed ? '✅ Passed' : '❌ Failed'}</p>
                            {result.failedChecks && result.failedChecks.map((check, i) => (
                                <div key={i} className="failed-check">
                                    <strong>{check.formula}:</strong> Expected {check.expected.toString()}, got {check.actual.toString()}
                                    <br />
                                    <small>{check.details}</small>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            <div className="custom-test">
                <h4>Test Custom Flowchart XML</h4>
                <textarea
                    value={customXml}
                    onChange={(e) => setCustomXml(e.target.value)}
                    placeholder="Paste flowchart XML here..."
                    rows={10}
                    className="form-textarea"
                />
                <button
                    onClick={testCustomFlowchart}
                    disabled={testing || !customXml.trim()}
                    className="btn btn-secondary"
                >
                    Test Custom XML
                </button>
            </div>
        </div>
    );
};

export default LTLTester;
