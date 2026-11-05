import React from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { useConnectedAccounts } from '../../context/ConnectedAccountsContext';
import { ContentCategory, ContentItem } from '../../types/content';
import { ContentCard } from './ContentCard';
import { 
  BarChart3, 
  Video, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  Layers, 
  TrendingUp, 
  Folder,
  Calendar,
  Sparkles,
  Send
} from 'lucide-react';

interface ContentDashboardProps {
  categories: ContentCategory[];
  items: ContentItem[];
  onSelectCategory: (categoryId: string) => void;
  onViewAll: () => void;
  onEditItem?: (item: ContentItem) => void;
  onStatusCycle?: (item: ContentItem) => void;
  onDuplicateItem?: (item: ContentItem) => void;
  onDeleteItem?: (itemId: string) => void;
}

export const ContentDashboard: React.FC<ContentDashboardProps> = ({
  categories,
  items,
  onSelectCategory,
  onViewAll,
  onEditItem,
  onStatusCycle,
  onDuplicateItem,
  onDeleteItem,
}) => {
  const { theme } = useTheme();
  const { status: accountStatus } = useConnectedAccounts();

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
  const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

  // Format breakdowns
  const longItems = items.filter((it) => it.format === 'long_form');
  const shortItems = items.filter((it) => it.format === 'short_form');

  // Status breakdowns
  const draftItems = items.filter((it) => it.status === 'draft');
  const readyItems = items.filter((it) => it.status === 'ready');
  const postedItems = items.filter((it) => it.status === 'posted');

  // Platform distribution for posted
  const platformCounts = {
    youtube: postedItems.filter((it) => (it.posted_to || []).includes('youtube')).length,
    tiktok: postedItems.filter((it) => (it.posted_to || []).includes('tiktok')).length,
    facebook: postedItems.filter((it) => (it.posted_to || []).includes('facebook')).length,
    instagram: postedItems.filter((it) => (it.posted_to || []).includes('instagram')).length,
  };

  const postedThisWeek = postedItems.filter((it) => {
    const d = new Date(it.posted_date || it.updated_at).getTime();
    return now - d <= SEVEN_DAYS_MS;
  }).length;

  const postedThisMonth = postedItems.filter((it) => {
    const d = new Date(it.posted_date || it.updated_at).getTime();
    return now - d <= THIRTY_DAYS_MS;
  }).length;

  return (
    <div className="space-y-4">
      {/* Header with YouTube Uploads Usage Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900 text-white shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold flex items-center gap-2">
              <span>Publishing & Quota Overview</span>
              {accountStatus?.youtube?.connected ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                  Connected: {accountStatus.youtube.channelTitle}
                </span>
              ) : (
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  YouTube Not Connected (Connect in Settings)
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-400">
              Direct-to-platform publishing tracking with daily API quota limits.
            </div>
          </div>
        </div>

        {/* Usage Indicator: "X of ~100 YouTube uploads used today" */}
        <div className="flex items-center gap-2 self-start sm:self-center bg-zinc-800/90 px-3 py-1.5 rounded-lg border border-zinc-700/60 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-zinc-100">
            {accountStatus?.youtubeQuota?.used || 0} of ~{accountStatus?.youtubeQuota?.limit || 100} YouTube uploads used today
          </span>
        </div>
      </div>

      {/* Ready to Publish Queue (Content Cards with Status Ready) */}
      {readyItems.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-blue-600" />
                <span>Ready to Publish ({readyItems.length})</span>
              </span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Publish direct to YouTube
              </span>
            </div>
            {onViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                View all content →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {readyItems.slice(0, 6).map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                categoryName={categories.find((c) => c.id === item.category_id)?.name}
                onEdit={onEditItem || (() => {})}
                onStatusCycle={onStatusCycle || (() => {})}
                onDuplicate={onDuplicateItem || (() => {})}
                onDelete={onDeleteItem}
              />
            ))}
          </div>
        </div>
      )}
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Content */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-[11px] font-semibold">Total Content</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-zinc-900">{items.length}</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Across {categories.length} categories</div>
        </div>

        {/* Long Form */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-xs"
        >
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[11px] font-semibold">Long Form</span>
            <Video className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-900">{longItems.length}</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Videos & in-depth articles</div>
        </div>

        {/* Short Form */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-xs"
        >
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-[11px] font-semibold">Short Form</span>
            <Smartphone className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-900">{shortItems.length}</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Shorts, Reels & TikToks</div>
        </div>

        {/* Posted Velocity */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-3.5 border shadow-xs"
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-semibold">Published (30d)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-900">{postedThisMonth}</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">{postedThisWeek} posted this week</div>
        </div>
      </div>

      {/* Production Pipeline Health & Category Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline Health */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border space-y-3.5 shadow-xs"
        >
          <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            <span>Production Status Distribution</span>
          </h3>

          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-800 font-semibold">Drafts (Ideas & Outlines)</span>
                <span className="font-bold text-zinc-900">{draftItems.length}</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${items.length > 0 ? (draftItems.length / items.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-800 font-semibold">Ready (Scripted & Ready to Film)</span>
                <span className="font-bold text-zinc-900">{readyItems.length}</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${items.length > 0 ? (readyItems.length / items.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-800 font-semibold">Posted & Live</span>
                <span className="font-bold text-zinc-900">{postedItems.length}</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all"
                  style={{ width: `${items.length > 0 ? (postedItems.length / items.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Published Platforms */}
          <div
            style={{
              borderTop: `1px solid ${theme.colors.borderLight}`,
              paddingTop: theme.spacing.sm,
            }}
            className="pt-2 text-xs"
          >
            <span className="text-[11px] font-semibold text-zinc-500 block mb-2">
              Cross-Platform Distribution of Published Items:
            </span>
            <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
              <div className="p-1.5 rounded bg-red-50 text-red-800 border border-red-100 font-medium">
                <div className="font-bold text-xs">{platformCounts.youtube}</div>
                <div className="text-[9px]">YouTube</div>
              </div>
              <div className="p-1.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-medium">
                <div className="font-bold text-xs">{platformCounts.tiktok}</div>
                <div className="text-[9px]">TikTok</div>
              </div>
              <div className="p-1.5 rounded bg-blue-50 text-blue-800 border border-blue-100 font-medium">
                <div className="font-bold text-xs">{platformCounts.facebook}</div>
                <div className="text-[9px]">Facebook</div>
              </div>
              <div className="p-1.5 rounded bg-purple-50 text-purple-800 border border-purple-100 font-medium">
                <div className="font-bold text-xs">{platformCounts.instagram}</div>
                <div className="text-[9px]">Instagram</div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Distribution */}
        <div
          style={{
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radius.lg,
          }}
          className="p-4 border space-y-3 shadow-xs flex flex-col justify-between"
        >
          <div>
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
              <Folder className="w-4 h-4 text-zinc-500" />
              <span>Top Categories</span>
            </h3>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {categories.map((c) => {
                const count = items.filter((it) => it.category_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectCategory(c.id)}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-50 transition-colors text-xs text-left cursor-pointer border border-zinc-100"
                  >
                    <span className="font-medium text-zinc-800 truncate">{c.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-bold shrink-0">
                      {count} items
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onViewAll}
            style={{
              backgroundColor: theme.colors.bgSecondary,
              color: theme.colors.textPrimary,
              borderRadius: theme.radius.md,
              minHeight: '34px',
            }}
            className="w-full text-xs font-semibold py-1.5 hover:bg-zinc-200 transition-colors cursor-pointer text-center mt-2"
          >
            Explore All Content & Multi-Filters →
          </button>
        </div>
      </div>
    </div>
  );
};
