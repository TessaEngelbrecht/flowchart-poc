import React from 'react';

const RoleSelector = ({ onRoleSelect }) => {
    return (
        <div className="role-selector-container">
            <div className="role-selector">
                <h2 className="role-selector-title">Select Your Role</h2>
                <div className="role-options">
                    <div
                        className="role-option role-option-lecturer"
                        onClick={() => onRoleSelect('lecturer')}
                    >
                        <div className="role-icon">👨‍🏫</div>
                        <h3>Lecturer</h3>
                        <p>Create assessment problems and solution templates</p>
                    </div>
                    <div
                        className="role-option role-option-student"
                        onClick={() => onRoleSelect('student')}
                    >
                        <div className="role-icon">👨‍🎓</div>
                        <h3>Student</h3>
                        <p>Solve flowchart problems and get assessed</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelector;
