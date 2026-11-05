import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type MainSection = 'workspace' | 'settings';
export type WorkspaceSection =
  | 'hub'
  | 'daily_tasks'
  | 'work_threads'
  | 'ideas_notes'
  | 'content'
  | 'idea_tree'
  | 'financial'
  | 'vault';

interface NavigationContextType {
  activeSection: MainSection;
  setActiveSection: (section: MainSection) => void;
  workspacePage: WorkspaceSection;
  setWorkspacePage: (page: WorkspaceSection) => void;
  openWorkspaceApp: (page: WorkspaceSection) => void;
  canGoBack: boolean;
  goBack: () => void;
  backLabel: string;
  registerBackHandler: (handler: () => boolean) => () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSection, setActiveSectionState] = useState<MainSection>('workspace');
  const [sectionHistory, setSectionHistory] = useState<MainSection[]>(['workspace']);
  
  const [workspacePage, setWorkspacePageState] = useState<WorkspaceSection>(() => {
    try {
      const saved = sessionStorage.getItem('workspace_active_page');
      if (
        saved === 'daily_tasks' ||
        saved === 'work_threads' ||
        saved === 'ideas_notes' ||
        saved === 'content' ||
        saved === 'idea_tree' ||
        saved === 'financial' ||
        saved === 'vault'
      ) {
        return saved as WorkspaceSection;
      }
    } catch {
      // Ignore sessionStorage access errors
    }
    return 'hub';
  });

  // Stack of registered back handlers (e.g. For open modals, folders, or details)
  const backHandlersRef = useRef<(() => boolean)[]>([]);

  const registerBackHandler = useCallback((handler: () => boolean) => {
    backHandlersRef.current.push(handler);
    return () => {
      backHandlersRef.current = backHandlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const setActiveSection = useCallback((newSection: MainSection) => {
    setActiveSectionState((current) => {
      if (current === newSection) return current;
      setSectionHistory((prev) => [...prev, newSection]);
      return newSection;
    });
  }, []);

  const setWorkspacePage = useCallback((page: WorkspaceSection) => {
    setWorkspacePageState(page);
    try {
      sessionStorage.setItem('workspace_active_page', page);
    } catch {
      // Ignore
    }
  }, []);

  const openWorkspaceApp = useCallback((page: WorkspaceSection) => {
    setWorkspacePageState(page);
    try {
      sessionStorage.setItem('workspace_active_page', page);
    } catch {
      // Ignore
    }
    setActiveSectionState((current) => {
      if (current === 'workspace') return current;
      setSectionHistory((prev) => [...prev, 'workspace']);
      return 'workspace';
    });
  }, []);

  // Compute if back action is available
  const isInsideWorkspaceSubpage = activeSection === 'workspace' && workspacePage !== 'hub';
  const hasSectionHistory = sectionHistory.length > 1;
  const canGoBack = isInsideWorkspaceSubpage || hasSectionHistory || backHandlersRef.current.length > 0;

  // Compute human-friendly label for where back will navigate
  let backLabel = 'Back';
  if (isInsideWorkspaceSubpage) {
    backLabel = 'Workspace Hub';
  } else if (hasSectionHistory) {
    const prevSection = sectionHistory[sectionHistory.length - 2];
    switch (prevSection) {
      case 'workspace':
        backLabel = 'Workspace';
        break;
      case 'settings':
        backLabel = 'Settings';
        break;
      default:
        backLabel = 'Workspace';
    }
  }

  const goBack = useCallback(() => {
    // 1. Check custom registered handlers (e.g. Detail view or modal)
    if (backHandlersRef.current.length > 0) {
      const topHandler = backHandlersRef.current[backHandlersRef.current.length - 1];
      const handled = topHandler();
      if (handled) return;
    }

    // 2. If inside workspace subpage, go back to workspace hub
    if (activeSection === 'workspace' && workspacePage !== 'hub') {
      setWorkspacePage('hub');
      return;
    }

    // 3. Otherwise pop the section history
    setSectionHistory((prev) => {
      if (prev.length <= 1) return prev;
      const nextHistory = prev.slice(0, prev.length - 1);
      const targetSection = nextHistory[nextHistory.length - 1];
      setActiveSectionState(targetSection);
      return nextHistory;
    });
  }, [activeSection, workspacePage, setWorkspacePage]);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (canGoBack) {
        goBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [canGoBack, goBack]);

  return (
    <NavigationContext.Provider
      value={{
        activeSection,
        setActiveSection,
        workspacePage,
        setWorkspacePage,
        openWorkspaceApp,
        canGoBack,
        goBack,
        backLabel,
        registerBackHandler,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return ctx;
};
