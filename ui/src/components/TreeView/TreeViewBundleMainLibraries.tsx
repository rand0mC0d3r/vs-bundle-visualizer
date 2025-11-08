import React from 'react';
import { DependencyInfo } from '../../utils/dependencyUtils';

interface TreeViewBundleMainLibraries {
  bundleInfo: DependencyInfo;
  libraryFilters: string[];
  onAddLibraryFilter: (library: string) => void;
  onRemoveLibraryFilter: (library: string) => void;
  uniqueAssetDependencies: string[]
}

export const TreeViewBundleMainLibraries: React.FC<TreeViewBundleMainLibraries> = ({
  bundleInfo,
  libraryFilters,
  onAddLibraryFilter,
  onRemoveLibraryFilter,
  uniqueAssetDependencies = []
}) => {

    const secondaryLibraries = bundleInfo && (bundleInfo?.mainLibraries || [])
          .filter((lib) => uniqueAssetDependencies.includes(lib))
          .filter((lib) => lib !== bundleInfo.mainLibrary)

        const ternaryLibraries = bundleInfo && (bundleInfo?.mainLibraries || [])
          .filter((lib) => !uniqueAssetDependencies.includes(lib))
          .filter((lib) => lib !== bundleInfo.mainLibrary)

    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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

        {bundleInfo?.mainLibraries && secondaryLibraries.length > 0 && (
          <span className="additional-libraries" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {' '}
            [+
            {secondaryLibraries
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

         {bundleInfo?.mainLibraries && ternaryLibraries.length > 0 && (
          <span className="additional-libraries" title={ternaryLibraries.join(', ')} style={{ opacity: 0.5, width: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ternaryLibraries
              .map((lib) => lib)
              .reduce((prev, curr) => [prev, ', ', curr])}
          </span>
        )}
      </div>
    );
};
