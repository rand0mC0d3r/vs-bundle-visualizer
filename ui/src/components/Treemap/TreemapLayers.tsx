import React from 'react';

interface TreemapLayersProps {
  layout: any;
  wrapperConfig: { [level: number]: { enabled: boolean; label: string } };
  setWrapperConfig: React.Dispatch<React.SetStateAction<{ [level: number]: { enabled: boolean; label: string } }>>;
}

export const TreemapLayers: React.FC<TreemapLayersProps> = ({
  layout,
  wrapperConfig,
  setWrapperConfig,
}) => {

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center'}}>
      <div style={{ fontSize: 12, color: '#666' }}>Level wrappers:</div>
      {Array.from({ length: (layout as any).maxDepth + 1 }).map((_, i) => {
        const cfg = wrapperConfig[i] || { enabled: false, label: String(i) };
        return (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ fontSize: 12, lineHeight: 0, display: 'flex', alignItems: 'center' }}>
              <input
                style={{ margin: 0}}
                type="checkbox"
                checked={cfg.enabled}
                onChange={(e) => setWrapperConfig(prev => ({ ...prev, [i]: { ...cfg, enabled: e.target.checked } }))}
              />
              <span style={{ marginLeft: 6 }}>{i}</span>
            </label>
          </div>
        );
      })}
    </div>
  );
};
