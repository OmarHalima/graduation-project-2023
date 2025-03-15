import React, { useState } from 'react';

const TestDropdown = ({ interviewers }) => {
    const [selectedInterviewer, setSelectedInterviewer] = useState('');

    return (
        <div>
            <select
                value={selectedInterviewer}
                onChange={(e) => {
                    console.log('Selected interviewer ID:', e.target.value);
                    setSelectedInterviewer(e.target.value);
                }}
            >
                <option value="">Select Interviewer</option>
                {interviewers.map((interviewer) => (
                    <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.full_name}
                    </option>
                ))}
            </select>
            <p>Selected Interviewer ID: {selectedInterviewer}</p>
        </div>
    );
};

export default TestDropdown; 