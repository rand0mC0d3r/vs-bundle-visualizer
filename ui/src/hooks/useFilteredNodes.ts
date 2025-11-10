import { useMemo } from 'react';
import { SortCriteria, SortDirection } from '../components/types';
import { FilterOptions, processAndFilterNodes, ProcessedNode } from '../utils/bundleFilterUtils';

export const useFilteredNodes = (
  bundleData: any,
  hiddenRootFolders: Set<string>,
  sortCriteria: SortCriteria,
  sortDirection: SortDirection,
  libraryFilters: string[]
) => {
  const filesToRender = useMemo((): ProcessedNode[] => {
    if (!bundleData) {
      return [];
    }

    const options: FilterOptions = {
      hiddenRootFolders,
      sortCriteria,
      sortDirection,
      libraryFilters
    };

    return processAndFilterNodes(bundleData, options);
  }, [bundleData, hiddenRootFolders, sortCriteria, sortDirection, libraryFilters]);

  return {
    filesToRender,
  };
};
