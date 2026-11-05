import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { Shield, Sparkles, UserCheck, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { theme } = useTheme();
  const { signIn, signUp, signInAnonymously } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = async () => {
    setError('');
    setLoading(true);
    try {
      await signInAnonymously();
    } catch (err: any) {
      setError(err?.message || 'Failed to start guest session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-screen"
      style={{
        backgroundColor: theme.isGlass ? 'transparent' : theme.colors.bgPrimary,
        color: theme.colors.textPrimary,
      }}
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
    >
      <div
        style={{
          backgroundColor: theme.colors.bgCard,
          borderRadius: theme.radius.xl,
          border: `1px solid ${theme.colors.borderLight}`,
          boxShadow: theme.shadows.lg,
          maxWidth: '420px',
          width: '100%',
          padding: theme.spacing.xl,
        }}
        className="space-y-6 relative z-10"
      >
        <div className="text-center space-y-2">
          <div
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              width: '44px',
              height: '44px',
            }}
            className="flex items-center justify-center mx-auto shadow-sm"
          >
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            AkashOS
          </h1>
          <p className="text-xs text-zinc-500">
            Personal productivity & studio OS with content pipelines, BDT finance, and encrypted vault
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderRadius: theme.radius.md,
            padding: '3px',
          }}
          className="flex text-xs font-semibold"
        >
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              backgroundColor: mode === 'login' ? theme.colors.bgCard : 'transparent',
              color: mode === 'login' ? theme.colors.textPrimary : theme.colors.textMuted,
              borderRadius: theme.radius.sm,
              minHeight: '36px',
            }}
            className="flex-1 transition-all cursor-pointer"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            style={{
              backgroundColor: mode === 'signup' ? theme.colors.bgCard : 'transparent',
              color: mode === 'signup' ? theme.colors.textPrimary : theme.colors.textMuted,
              borderRadius: theme.radius.sm,
              minHeight: '36px',
            }}
            className="flex-1 transition-all cursor-pointer"
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
              Email Address
            </label>
            <input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.borderLight,
                minHeight: '44px',
              }}
              className="w-full px-3 py-2 border font-medium focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1" style={{ color: theme.colors.textSecondary }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                backgroundColor: theme.colors.bgSecondary,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.borderLight,
                minHeight: '44px',
              }}
              className="w-full px-3 py-2 border font-medium focus:outline-none"
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: theme.colors.dangerBg,
                color: theme.colors.danger,
                borderRadius: theme.radius.sm,
              }}
              className="p-2.5 flex items-center gap-2 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: theme.colors.accent,
              color: theme.colors.accentText,
              borderRadius: theme.radius.md,
              minHeight: '44px',
            }}
            className="w-full font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In to Workspace' : 'Create New Account'}
          </button>
        </form>

        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-zinc-200 w-full" />
          <span className="bg-white px-3 text-[11px] text-zinc-400 uppercase tracking-wider absolute">
            Or Quick Access
          </span>
        </div>

        <button
          id="guest-signin-btn"
          type="button"
          onClick={handleGuestAccess}
          disabled={loading}
          style={{
            backgroundColor: theme.colors.bgSecondary,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.md,
            minHeight: '44px',
          }}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold border hover:bg-zinc-100 text-zinc-800 transition-colors cursor-pointer"
        >
          <UserCheck className="w-4 h-4 text-zinc-600" />
          <span>Continue as Guest Demo Session</span>
        </button>
      </div>
    </div>
  );
};
