import React from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <>
      <div className="section-title">{title}</div>
      {children}
    </>
  );
};
