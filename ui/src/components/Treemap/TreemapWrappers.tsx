import React from 'react';

interface TreemapWrappersProps {
  layout: any;
  wrapperConfig: { [level: number]: { enabled: boolean; label: string } };
}

export const TreemapWrappers: React.FC<TreemapWrappersProps> = ({
  layout,
  wrapperConfig,
}) => {
  return (
    <>
      {((layout as any).nodes || []).map((n: any, idx: number) => {
        const cfg = wrapperConfig[n.depth];
        if (!cfg || !cfg.enabled) return null;
        return (
          <div
            className="treemap-panel-wrapper"
            key={`wrapper-${idx}-${n.depth}`}
            style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              width: Math.max(1, n.w),
              height: Math.max(1, n.h),
              borderWidth: Math.max(1, n.depth - 1),
              boxSizing: 'border-box',
              pointerEvents: 'none',
              background: 'transparent'
            }}
          >
            {(n.w > 40 && n.h > 40) && <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 1,
              pointerEvents: 'none',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: 3,
              fontSize: 11,
              maxWidth: Math.max(8, (n.w || 0) - 8),
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            }}>
              {n.name.split("-")[0]}
            </div>}
          </div>
        );
      })}
    </>
  );
};
