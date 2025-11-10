import React from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
}

interface ResizablePanelProps {
  title: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  title,
  children,
  fullWidth = false
}) => {

  return (
    <div className={`side-panel`} style={{ width: fullWidth ? '100%' : undefined }}>
      <div className="side-panel-header">
        <h3>{title}</h3>
      </div>
      <div className="side-panel-content">
        {children}
      </div>
    </div>
  );
};
