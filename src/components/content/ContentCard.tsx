import React, { useState, useRef } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { useConnectedAccounts } from '../../context/ConnectedAccountsContext';
import { db } from '../../lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ContentItem, ContentStatus, PostedPlatform } from '../../types/content';
import { formatDateTimeWithHM } from '../../lib/threadTimer';
import { 
  FileText, 
  Video, 
  Smartphone, 
  Copy, 
  Trash2, 
  Clock, 
  Tag as TagIcon,
  CheckCircle2,
  Sparkles,
  MoreVertical,
  Edit2,
  ExternalLink,
  AlertCircle,
  X
} from 'lucide-react';
import { LinkWithPreview } from '../common/LinkWithPreview';
import { tokenizeTextWithLinks } from '../../lib/linkUtils';

interface ContentCardProps {
  item: ContentItem;
  categoryName?: string;
  onEdit: (item: ContentItem) => void;
  onStatusCycle: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onDelete?: (itemId: string) => void;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  categoryName,
  onEdit,
  onStatusCycle,
  onDuplicate,
  onDelete,
}) => {
  const { theme } = useTheme();
  const { status: accountStatus, publishToYouTube } = useConnectedAccounts();
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Publishing state
  const [publishing, setPublishing] = useState<'youtube' | 'facebook' | 'instagram' | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSuccessUrl, setInlineSuccessUrl] = useState<string | null>(null);

  const isYouTubeConnected = Boolean(accountStatus?.youtube?.connected);
  const isFacebookConnected = Boolean(accountStatus?.facebook?.connected);
  const isInstagramConnected = Boolean(accountStatus?.instagram?.connected);

  const handlePublishYouTube = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isYouTubeConnected) return;
    setInlineError(null);
    setInlineSuccessUrl(null);
    setPublishing('youtube');

    try {
      const res = await publishToYouTube({
        contentItemId: item.id,
        title: item.title,
        script_text: item.script_text,
        tags: item.tags,
      });

      setInlineSuccessUrl(res.videoUrl);

      // Update Firestore content item posted_to array and status
      try {
        await updateDoc(doc(db, 'content_items', item.id), {
          posted_to: arrayUnion('youtube'),
          status: 'posted',
          posted_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not update Firestore document after publishing:', dbErr);
      }
    } catch (err: any) {
      setInlineError(err?.message || 'Failed to publish to YouTube');
    } finally {
      setPublishing(null);
    }
  };

  // Status styling and next label
  const getStatusBadge = (status: ContentStatus) => {
    switch (status) {
      case 'posted':
        return {
          label: 'Archived',
          bg: '#ECFDF5',
          text: '#065F46',
          border: '#A7F3D0',
          dot: '#059669',
          next: 'draft' as ContentStatus,
        };
      case 'ready':
        return {
          label: 'Refined',
          bg: '#EEF2FF',
          text: '#3730A3',
          border: '#C7D2FE',
          dot: '#4F46E5',
          next: 'posted' as ContentStatus,
        };
      case 'draft':
      default:
        return {
          label: 'Idea / Draft',
          bg: '#FFFBEB',
          text: '#92400E',
          border: '#FDE68A',
          dot: '#D97706',
          next: 'ready' as ContentStatus,
        };
    }
  };

  const statusBadge = getStatusBadge(item.status);

  // Timestamp helper with date, hour, and minute
  const getRelativeTime = (isoString?: string): string => {
    if (!isoString) return 'recently';
    return formatDateTimeWithHM(isoString);
  };

  // Long press handler for Duplicate
  const startLongPress = () => {
    setLongPressTriggered(false);
    timerRef.current = setTimeout(() => {
      setLongPressTriggered(true);
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
      onDuplicate(item);
    }, 600);
  };

  const cancelLongPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (longPressTriggered) {
      setLongPressTriggered(false);
      return;
    }
    onEdit(item);
  };

  const tags = item.tags || [];
  const displayTags = tags.slice(0, 3);
  const remainingTagsCount = tags.length - 3;

  return (
    <div
      onClick={handleClick}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      style={{
        backgroundColor: theme.colors.bgCard,
        borderColor: theme.colors.borderLight,
        borderRadius: theme.radius.lg,
      }}
      className={`p-3.5 sm:p-4 border transition-all hover:border-zinc-400 cursor-pointer shadow-xs group flex flex-col justify-between relative select-none ${
        longPressTriggered ? 'ring-2 ring-indigo-500 scale-[0.99]' : ''
      }`}
    >
      {/* Top row: Format Badge, Category (if provided) & Quick Actions */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Format Badge */}
            <span
              style={{
                backgroundColor: item.format === 'long_form' ? '#EFF6FF' : '#FAF5FF',
                color: item.format === 'long_form' ? '#1D4ED8' : '#7E22CE',
                borderColor: item.format === 'long_form' ? '#BFDBFE' : '#E9D5FF',
                borderRadius: theme.radius.full,
              }}
              className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 border flex items-center gap-1 shrink-0"
            >
              {item.format === 'long_form' ? (
                <>
                  <Video className="w-3 h-3" />
                  <span>Long Form</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3 h-3" />
                  <span>Short Form</span>
                </>
              )}
            </span>

            {/* Category tag if available */}
            {categoryName && (
              <span
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  color: theme.colors.textSecondary,
                  borderRadius: theme.radius.sm,
                }}
                className="text-[10px] px-1.5 py-0.5 truncate max-w-[120px]"
              >
                {categoryName}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Duplicate Button (also triggered by long-press) */}
            <button
              type="button"
              onClick={() => onDuplicate(item)}
              title="Duplicate (or long-press card)"
              style={{ minHeight: '28px', minWidth: '28px' }}
              className="p-1 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center justify-center cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* Delete button */}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete content "${item.title || 'Untitled'}"?`)) {
                    onDelete(item.id);
                  }
                }}
                title="Delete content"
                style={{ minHeight: '28px', minWidth: '28px' }}
                className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Title (with blue clickable links) */}
        <h3
          className="text-xs sm:text-sm font-bold truncate line-clamp-1 mb-1.5"
          style={{ color: theme.colors.textPrimary }}
        >
          {tokenizeTextWithLinks(item.title || 'Untitled Content').map((token, i) =>
            token.type === 'link' && token.url ? (
              <LinkWithPreview
                key={`${token.url}-${i}`}
                url={token.url}
                domain={token.domain}
                path={token.path}
                className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                stopPropagation={true}
              >
                {token.content}
              </LinkWithPreview>
            ) : (
              <React.Fragment key={i}>{token.content}</React.Fragment>
            )
          )}
        </h3>

        {/* Script preview snippet (with blue clickable links) */}
        {item.script_text ? (
          <p
            className="text-[11px] sm:text-xs line-clamp-2 leading-relaxed mb-2.5"
            style={{ color: theme.colors.textSecondary }}
          >
            {tokenizeTextWithLinks(item.script_text).map((token, i) =>
              token.type === 'link' && token.url ? (
                <LinkWithPreview
                  key={`${token.url}-${i}`}
                  url={token.url}
                  domain={token.domain}
                  path={token.path}
                  className="!text-[#2563eb] hover:!text-[#1d4ed8] font-bold !underline !decoration-[#3b82f6] hover:!decoration-[#1d4ed8]"
                  stopPropagation={true}
                >
                  {token.content}
                </LinkWithPreview>
              ) : (
                <React.Fragment key={i}>{token.content}</React.Fragment>
              )
            )}
          </p>
        ) : (
          <p
            className="text-[11px] italic mb-2.5"
            style={{ color: theme.colors.textMuted }}
          >
            No script draft written yet...
          </p>
        )}

        {/* Tags chips: first 2-3 chips + (+N more) */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-3">
            {displayTags.map((tag, idx) => (
              <span
                key={idx}
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  color: theme.colors.textPrimary,
                  borderRadius: theme.radius.sm,
                }}
                className="text-[10px] px-1.5 py-0.5 flex items-center gap-0.5 border border-zinc-200/50"
              >
                <span className="text-zinc-400">#</span>
                <span>{tag}</span>
              </span>
            ))}
            {remainingTagsCount > 0 && (
              <span
                style={{
                  backgroundColor: theme.colors.bgSecondary,
                  color: theme.colors.textMuted,
                  borderRadius: theme.radius.sm,
                }}
                className="text-[10px] px-1.5 py-0.5 font-medium"
              >
                +{remainingTagsCount} more
              </span>
            )}
            {item.custom_data && item.custom_data.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70">
                {item.custom_data.length} custom {item.custom_data.length === 1 ? 'section' : 'sections'}
              </span>
            )}
          </div>
        )}

        {/* Per-Platform Publish Toolbar (rendered on cards with status 'ready' or with posted platforms) */}
        {(item.status === 'ready' || (item.posted_to && item.posted_to.length > 0)) && (
          <div className="mb-3 pt-2 border-t border-zinc-100 flex flex-col gap-1.5">
            {/* Inline Success Banner */}
            {inlineSuccessUrl && (
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Published to YouTube!</span>
                </div>
                <a
                  href={inlineSuccessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold underline flex items-center gap-0.5 text-emerald-900 hover:text-emerald-700"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Inline Error Banner */}
            {inlineError && (
              <div className="p-2 rounded bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="truncate">{inlineError}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInlineError(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-700 ml-1 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Buttons / Badges Row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mr-0.5">
                Publish:
              </span>

              {/* YouTube */}
              {(item.posted_to || []).includes('youtube') ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>YouTube</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handlePublishYouTube}
                  disabled={publishing !== null || !isYouTubeConnected}
                  title={
                    isYouTubeConnected
                      ? `Publish to YouTube channel (${accountStatus?.youtube?.channelTitle || 'Connected'})`
                      : 'YouTube not connected. Connect in Settings screen.'
                  }
                  style={{
                    backgroundColor: isYouTubeConnected ? '#EF4444' : '#F4F4F5',
                    color: isYouTubeConnected ? '#FFFFFF' : '#A1A1AA',
                    borderColor: isYouTubeConnected ? '#DC2626' : '#E4E4E7',
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded border flex items-center gap-1 transition-colors ${
                    isYouTubeConnected ? 'hover:bg-red-600 cursor-pointer shadow-2xs' : 'cursor-not-allowed opacity-60'
                  }`}
                >
                  {publishing === 'youtube' ? (
                    <span className="inline-block w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  )}
                  <span>{publishing === 'youtube' ? 'Uploading...' : 'YouTube'}</span>
                </button>
              )}

              {/* Facebook */}
              {(item.posted_to || []).includes('facebook') ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  <span>Facebook</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled
                  title={
                    isFacebookConnected
                      ? 'Publish to Facebook Page'
                      : 'Facebook Page not connected. Connect in Settings.'
                  }
                  className="text-[10px] font-medium px-2 py-1 rounded border border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed opacity-60"
                >
                  Facebook
                </button>
              )}

              {/* Instagram */}
              {(item.posted_to || []).includes('instagram') ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  <CheckCircle2 className="w-3 h-3 text-purple-600" />
                  <span>Instagram</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled
                  title={
                    isInstagramConnected
                      ? 'Publish to Instagram'
                      : 'Instagram account not connected. Connect in Settings.'
                  }
                  className="text-[10px] font-medium px-2 py-1 rounded border border-zinc-200 text-zinc-400 bg-zinc-50 cursor-not-allowed opacity-60"
                >
                  Instagram
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Status Pill (tap to cycle) & Last Updated Time */}
      <div
        style={{
          borderTop: `1px solid ${theme.colors.borderLight}`,
          paddingTop: theme.spacing.sm,
        }}
        className="flex items-center justify-between gap-2 mt-auto"
      >
        {/* Status Pill (tap to cycle draft -> ready -> posted) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStatusCycle(item);
          }}
          title={`Status: ${statusBadge.label} (Tap to change to ${statusBadge.next})`}
          style={{
            backgroundColor: statusBadge.bg,
            color: statusBadge.text,
            borderColor: statusBadge.border,
            borderRadius: theme.radius.full,
          }}
          className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 border flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
        >
          <span
            style={{ backgroundColor: statusBadge.dot }}
            className="w-1.5 h-1.5 rounded-full inline-block"
          />
          <span>{statusBadge.label}</span>
          <span className="text-[9px] opacity-60 font-mono">↻</span>
        </button>

        {/* Last updated timestamp */}
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-400">
          <Clock className="w-3 h-3" />
          <span>{getRelativeTime(item.updated_at || item.created_at)}</span>
        </div>
      </div>
    </div>
  );
};
