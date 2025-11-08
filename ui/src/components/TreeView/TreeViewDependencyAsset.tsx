import React from 'react';
import { DependencyInfo, DependencyMap } from '../../utils/dependencyUtils';

interface TreeViewDependencyAssetProps {
  bundleInfo: DependencyInfo;
  dependencyMap: DependencyMap;
  libraryFilters: string[];
  onAddLibraryFilter: (library: string) => void;
  onRemoveLibraryFilter: (library: string) => void;
}

export const TreeViewDependencyAsset: React.FC<TreeViewDependencyAssetProps> = ({
  bundleInfo,
  dependencyMap,
  libraryFilters,
  onAddLibraryFilter,
  onRemoveLibraryFilter
}) => {
    return <>
      {bundleInfo.dependencies.length > 0 && (
        <div className="dependency-section">
          <div className="dependency-list">
            {bundleInfo.dependencies.map(dep => {
              const depInfo = dependencyMap[dep];
              const libraryName = depInfo?.mainLibrary || dep.replace('vendor/vendor__', '').replace('.js', '');
              const isActive = depInfo?.mainLibrary && libraryFilters.includes(depInfo.mainLibrary);
              return (
                <span
                  key={dep}
                  className={`dependency-item dependency-item-vendor clickable ${isActive ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (depInfo?.mainLibrary) {
                      if (isActive) {
                        onRemoveLibraryFilter(depInfo.mainLibrary);
                      } else {
                        onAddLibraryFilter(depInfo.mainLibrary);
                      }
                    }
                  }}
                  title={`${isActive ? 'Remove' : 'Add'} filter: ${libraryName}`}
                >
                  {libraryName}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </>
};
