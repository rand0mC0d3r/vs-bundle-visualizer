import React from 'react';
import { formatFileSize, getFileColor } from '../../utils/fileUtils';

interface TreemapTilesProps {
  hoveredFolder: string | null;
  setHoveredFolder: React.Dispatch<React.SetStateAction<string | null>>;
  layout: any;
  selectedNode: string | null;
  onScrollToFile: (filePath: string) => void;
}

export const TreemapTiles: React.FC<TreemapTilesProps> = ({
  hoveredFolder,
  setHoveredFolder,
  layout,
  selectedNode,
  onScrollToFile,
}) => {

  return (
    <>
      {layout.tiles.map((t: any) => {
        const baseColor = getFileColor(t.name);
        const lightColor = baseColor + '80';

        return <>
          <div
            key={t.key}
            className={`treemap-file ${selectedNode === t.fullPath ? 'selected' : ''} ${hoveredFolder === t.groupKey ? 'hovered-folder' : ''}`}
            style={{
              position: 'absolute',
              left: t.x,
              top: t.y,
              width: t.w,
              height: t.h,
              backgroundColor: lightColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHoveredFolder(t.groupKey)}
            onMouseLeave={() => setHoveredFolder(null)}
            onClick={() => onScrollToFile(t.fullPath)}
            title={`${t.fullPath} - ${formatFileSize(t.size)}`}
          >

              {(t.w > 40 && t.h > 40) && <div
                style={{
                  position: 'absolute',
                  left: 4,
                  bottom: 4,
                  pointerEvents: 'none',
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  padding: '1px 6px',
                  opacity: 0.45,
                  fontSize: 10,
                  borderRadius: 3,
                  maxWidth: Math.max(8, (t.w || 0) - 8),
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
              >
                {t.name.split('.')[0]}
              </div>}
              <div className="treemap-file-size">{formatFileSize(t.size)}</div>
          </div>
        </>;
      })}
    </>
  );
};
