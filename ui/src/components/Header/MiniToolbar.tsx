import React from 'react';

interface MiniToolbarProps {
  items: any[];
  children?: React.ReactNode;
  position?: 'start' | 'end'
}

export const MiniToolbar: React.FC<MiniToolbarProps> = ({
  items,
  children,
  position = 'end'
}) => {

  return (
    <div className="toolbar-section">
      {position === 'start' && children}
      {items.map(item => (
        <button
          key={item.name}
          className={`toolbar-button ${item.isVisible ? 'active' : ''}`}
          onClick={item.action}
          disabled={item.disabled}
          title={item.title}
        >
        {item.label}
      </button>
      ))}
      {position === 'end' && children}
    </div>
  );
};
