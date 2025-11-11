import React from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
}

interface ResizablePanelProps {
  title: string;
  children: React.ReactNode;
  titleChildren?: React.ReactNode;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  title,
  children,
  titleChildren,
}) => {

  return (
    <div className={`side-panel`} style={{ flex: '1 1 auto' }}>
      <div className="side-panel-header" style={{ minHeight: '24px'}}>
        <h3 style={{ lineHeight: 0 }}>{title}</h3>
        {titleChildren}
      </div>
      <div className="side-panel-content">
        {children}
      </div>
    </div>
  );
};
