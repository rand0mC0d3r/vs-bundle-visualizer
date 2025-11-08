import React from 'react';

interface TreeViewBundleMainLibraries {
  bundleInfo: any;
  libraryFilters: string[];
  onAddLibraryFilter: (library: string) => void;
  onRemoveLibraryFilter: (library: string) => void;
}

export const TreeViewBundleMainLibraries: React.FC<TreeViewBundleMainLibraries> = ({
  bundleInfo,
  libraryFilters,
  onAddLibraryFilter,
  onRemoveLibraryFilter
}) => {
    return (
      <>
        {bundleInfo?.mainLibrary && (
          <span
            className={`dependency-item dependency-item-vendor clickable ${libraryFilters.includes(bundleInfo.mainLibrary) ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (libraryFilters.includes(bundleInfo.mainLibrary!)) {
                onRemoveLibraryFilter(bundleInfo.mainLibrary!);
              } else {
                onAddLibraryFilter(bundleInfo.mainLibrary!);
              }
            }}
            title={`${libraryFilters.includes(bundleInfo.mainLibrary!) ? 'Remove' : 'Add'} filter: ${bundleInfo.mainLibrary}`}
          >
            {bundleInfo.mainLibrary}
          </span>
        )}

        {bundleInfo?.mainLibraries && bundleInfo?.mainLibraries
          .map((lib) => lib !== bundleInfo.mainLibrary)
          .filter(Boolean).length > 0 && (
          <span className="additional-libraries" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {' '}
            [+
            {bundleInfo.mainLibraries
              .filter((lib) => lib !== bundleInfo.mainLibrary)
              .map((lib) => (
                <span
                  key={lib}
                  className={`dependency-item dependency-item-vendor clickable ${libraryFilters.includes(lib) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (libraryFilters.includes(lib)) {
                      onRemoveLibraryFilter(lib);
                    } else {
                      onAddLibraryFilter(lib);
                    }
                  }}
                  title={`${libraryFilters.includes(lib) ? 'Remove' : 'Add'} filter: ${lib}`}
                >
                  {lib}
                </span>
              ))
              .reduce((prev, curr) => [prev, ', ', curr])}
            ]
          </span>
        )}
      </>
    );
};
