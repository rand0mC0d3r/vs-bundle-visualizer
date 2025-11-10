import React from 'react';
import { DependencyInfo } from '../../utils/dependencyUtils';

interface TreeViewDependencyVendorProps {
  bundleInfo: DependencyInfo;
}

export const TreeViewDependencyVendor: React.FC<TreeViewDependencyVendorProps> = ({
  bundleInfo,
}) => {
    return <>
      {bundleInfo.consumers.length > 0 && (
          <div className="dependency-section">
            <span className="toolbar-label">Usages:</span>
            <div className="dependency-list">
              {bundleInfo.consumers.map(consumer => (
                <span key={consumer} className="dependency-item consumer-item">
                  {consumer.replace('assets/', '').replace(/^vendor\/vendor__/, '').replace(/\.js$/, '').split('-')[0]}
                </span>
              ))}
            </div>
          </div>
        )}
    </>
};
