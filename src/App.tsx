/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider } from './context/VaultContext';
import { NavigationProvider } from './context/NavigationContext';
import { ConnectedAccountsProvider } from './context/ConnectedAccountsContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { NavigationShell } from './components/navigation/NavigationShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function MainRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-500 gap-3">
        <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-poppins">Initializing secure workspace...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <ErrorBoundary fallbackTitle="Workspace encountered an error">
      <VaultProvider>
        <ConnectedAccountsProvider>
          <NavigationProvider>
            <NavigationShell />
          </NavigationProvider>
        </ConnectedAccountsProvider>
      </VaultProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
