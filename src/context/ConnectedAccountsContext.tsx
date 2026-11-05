import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface ConnectedAccountsStatus {
  youtube: {
    connected: boolean;
    channelTitle?: string;
    connectedAt?: string;
  };
  facebook: {
    connected: boolean;
    pageName?: string;
    connectedAt?: string;
  };
  instagram: {
    connected: boolean;
    accountName?: string;
    connectedAt?: string;
  };
  youtubeQuota: {
    used: number;
    limit: number;
    resetsAt: string;
  };
}

interface PublishResult {
  success: boolean;
  videoUrl: string;
  videoId: string;
  message: string;
}

interface ConnectedAccountsContextType {
  status: ConnectedAccountsStatus | null;
  loading: boolean;
  refreshStatus: () => Promise<void>;
  connectYouTube: () => Promise<void>;
  disconnectPlatform: (platform: 'youtube' | 'facebook' | 'instagram') => Promise<void>;
  publishToYouTube: (params: {
    contentItemId: string;
    title: string;
    script_text: string;
    tags: string[];
    video_url?: string;
  }) => Promise<PublishResult>;
}

const defaultStatus: ConnectedAccountsStatus = {
  youtube: { connected: false },
  facebook: { connected: false },
  instagram: { connected: false },
  youtubeQuota: { used: 0, limit: 100, resetsAt: '00:00 UTC' },
};

const ConnectedAccountsContext = createContext<ConnectedAccountsContextType>({
  status: defaultStatus,
  loading: false,
  refreshStatus: async () => {},
  connectYouTube: async () => {},
  disconnectPlatform: async () => {},
  publishToYouTube: async () => ({
    success: false,
    videoUrl: '',
    videoId: '',
    message: '',
  }),
});

export const ConnectedAccountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectedAccountsStatus | null>(defaultStatus);
  const [loading, setLoading] = useState(false);

  const getHeaders = useCallback(() => {
    return user ? { 'x-user-id': user.uid } : {};
  }, [user]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts/status', {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn('Failed to fetch connected accounts status:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Listen for OAuth success postMessage from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS' || event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        refreshStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshStatus]);

  const connectYouTube = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/youtube/url${user ? `?userId=${user.uid}` : ''}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error('Failed to generate YouTube authorization URL');
      }
      const { url } = await res.json();

      const width = 580;
      const height = 680;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

      const popup = window.open(
        url,
        'oauth_youtube_window',
        `width=${width},height=${height},left=${left},top=${top},status=yes,scrollbars=yes`
      );

      if (!popup) {
        alert('Please allow popups to connect your YouTube account.');
      }
    } finally {
      setLoading(false);
    }
  }, [getHeaders, user]);

  const disconnectPlatform = useCallback(
    async (platform: 'youtube' | 'facebook' | 'instagram') => {
      const res = await fetch('/api/accounts/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to disconnect ${platform}`);
      }
      await refreshStatus();
    },
    [getHeaders, refreshStatus]
  );

  const publishToYouTube = useCallback(
    async (params: {
      contentItemId: string;
      title: string;
      script_text: string;
      tags: string[];
      video_url?: string;
    }): Promise<PublishResult> => {
      const res = await fetch('/api/publish/youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(params),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload video to YouTube');
      }

      await refreshStatus();

      return {
        success: true,
        videoUrl: data.videoUrl || `https://youtu.be/${data.videoId}`,
        videoId: data.videoId,
        message: data.message || 'Video uploaded successfully!',
      };
    },
    [getHeaders, refreshStatus]
  );

  return (
    <ConnectedAccountsContext.Provider
      value={{
        status,
        loading,
        refreshStatus,
        connectYouTube,
        disconnectPlatform,
        publishToYouTube,
      }}
    >
      {children}
    </ConnectedAccountsContext.Provider>
  );
};

export function useConnectedAccounts() {
  return useContext(ConnectedAccountsContext);
}
