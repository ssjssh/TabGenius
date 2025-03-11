import React from 'react';

interface OptionProps {
  icon: string;
  text: string;
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export const Option: React.FC<OptionProps> = ({ icon, text, checked, disabled, onClick }) => {
  return (
    <div 
      className={`option ${disabled ? 'disabled' : ''}`} 
      onClick={disabled ? undefined : onClick}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <div className="option-icon">{icon}</div>
      <div className="option-text">{text}</div>
      {checked && <div className="check-icon">✓</div>}
    </div>
  );
};
