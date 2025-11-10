import { useEffect } from 'react';
import { SortCriteria } from '../components/types';
import { VSCodeAPI } from '../types';

interface KeyboardShortcutsProps {
  vscodeApi: VSCodeAPI;
  showSidePanel: boolean;
  showTreemapPanel: boolean;
  hideZeroByteFiles: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleSidePanel: () => void;
  onToggleTreemapPanel: () => void;
  onToggleZeroByteFiles: () => void;
  onToggleSortDirection: () => void;
  onChangeSortCriteria: (criteria: SortCriteria) => void;
  onToggleRootFolderVisibility: () => void;
}

export const useKeyboardShortcuts = ({
  vscodeApi,
  showSidePanel,
  showTreemapPanel,
  hideZeroByteFiles,
  onExpandAll,
  onCollapseAll,
  onToggleSidePanel,
  onToggleTreemapPanel,
  onToggleZeroByteFiles,
  onToggleSortDirection,
  onChangeSortCriteria,
  onToggleRootFolderVisibility
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Global keyboard shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'e':
            event.preventDefault();
            onExpandAll();
            break;
          case 'w':
            event.preventDefault();
            onCollapseAll();
            break;
          case 'b':
            event.preventDefault();
            onToggleSidePanel();
            break;
          case 't':
            event.preventDefault();
            onToggleTreemapPanel();
            break;
          case 's':
            event.preventDefault();
            onToggleSortDirection();
            break;
          case '1':
            event.preventDefault();
            onChangeSortCriteria('filename');
            break;
          case '2':
            event.preventDefault();
            onChangeSortCriteria('fileCount');
            break;
          case '3':
            event.preventDefault();
            onChangeSortCriteria('fileSize');
            break;
          case 'h':
            event.preventDefault();
            onToggleZeroByteFiles();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [
    vscodeApi,
    showSidePanel,
    showTreemapPanel,
    hideZeroByteFiles,
    onExpandAll,
    onCollapseAll,
    onToggleSidePanel,
    onToggleTreemapPanel,
    onToggleZeroByteFiles,
    onToggleSortDirection,
    onChangeSortCriteria,
    onToggleRootFolderVisibility
  ]);
};
