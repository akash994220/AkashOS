import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ContentCategory, ContentItem, ContentFormat, ContentStatus, PostedPlatform } from '../types/content';

/**
 * One-time migration that reads all existing YouTube/TikTok/Facebook/Instagram items,
 * maps each into a ContentItem:
 * - existing content_type on YouTube items -> format directly
 * - all others default to long_form unless they were shorts/reel/story, which map to short_form
 * - collapses every old stage value down to draft/ready/posted:
 *     anything before "posted" -> draft unless it has real content in script/caption fields, then ready
 * - drops all items into a default "Uncategorized" ContentCategory
 * - preserves title, script_text/caption_text/draft_text (merged into script_text), and tags from seo.tags
 * - old collections are preserved as-is.
 */
export async function runContentMigration(uid: string): Promise<{ migratedCount: number }> {
  if (!uid || !db) return { migratedCount: 0 };
  const storageKey = `content_migration_completed_${uid}`;
  if (localStorage.getItem(storageKey) === 'true') {
    return { migratedCount: 0 };
  }

  try {
    // 1. Fetch all items from old platform collections
    const platforms = ['youtube', 'tiktok', 'facebook', 'instagram'] as const;
    const oldItems: Array<{ platform: typeof platforms[number]; data: any; id: string }> = [];

    for (const p of platforms) {
      const qOld = query(collection(db, `content_${p}`), where('owner_uid', '==', uid));
      const snap = await getDocs(qOld);
      snap.forEach((d) => {
        oldItems.push({ platform: p, data: d.data(), id: d.id });
      });
    }

    // Even if no old items, ensure a default category exists if user has none
    const qCat = query(collection(db, 'content_categories'), where('owner_uid', '==', uid));
    const catSnap = await getDocs(qCat);
    let uncategorizedId = '';

    catSnap.forEach((d) => {
      const data = d.data();
      if ((data.name || '').toLowerCase() === 'uncategorized') {
        uncategorizedId = d.id;
      }
    });

    if (!uncategorizedId) {
      uncategorizedId = `cat_uncat_${uid}`;
      const uncatCategory: ContentCategory = {
        id: uncategorizedId,
        owner_uid: uid,
        name: 'Uncategorized',
        parent_category_id: null,
        created_at: new Date().toISOString(),
      };
      await setDoc(doc(db, 'content_categories', uncategorizedId), uncatCategory);
    }

    if (oldItems.length === 0) {
      localStorage.setItem(storageKey, 'true');
      return { migratedCount: 0 };
    }

    let migratedCount = 0;

    for (const entry of oldItems) {
      const { platform, data, id } = entry;
      const targetDocId = `migrated_${platform}_${id}`;

      let format: ContentFormat = 'long_form';
      if (platform === 'youtube') {
        if (data.content_type === 'shorts' || data.content_type === 'short_form') {
          format = 'short_form';
        } else {
          format = 'long_form';
        }
      } else {
        const fmt = String(data.content_format || '').toLowerCase();
        if (fmt === 'shorts' || fmt === 'reel' || fmt === 'story') {
          format = 'short_form';
        } else {
          format = 'long_form';
        }
      }

      // Stage mapping
      let status: ContentStatus = 'draft';
      const oldStage = String(data.stage || '').toLowerCase();

      // Check if real content exists in script / caption / draft fields
      const textParts: string[] = [];
      if (data.script_text?.trim()) textParts.push(data.script_text.trim());
      if (data.caption_text?.trim()) textParts.push(data.caption_text.trim());
      if (data.draft_text?.trim()) textParts.push(data.draft_text.trim());
      if (data.hook_text?.trim()) textParts.push(`Hook: ${data.hook_text.trim()}`);
      if (data.script_body?.trim()) textParts.push(data.script_body.trim());
      if (data.idea_notes?.trim()) textParts.push(data.idea_notes.trim());

      const mergedScript = textParts.join('\n\n');
      const hasRealContent = mergedScript.trim().length > 0;

      if (oldStage === 'posted') {
        status = 'posted';
      } else if (hasRealContent) {
        status = 'ready';
      } else {
        status = 'draft';
      }

      // Tags extraction
      let tags: string[] = [];
      if (data.seo?.tags) {
        if (typeof data.seo.tags === 'string') {
          tags = data.seo.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean);
        } else if (Array.isArray(data.seo.tags)) {
          tags = data.seo.tags.filter(Boolean);
        }
      }

      const postedTo: PostedPlatform[] = status === 'posted' ? [platform] : [];

      const resolvedPostedDate =
        data.posted_date ||
        (status === 'posted' ? (data.updated_at || new Date().toISOString()) : undefined);

      const newItem: ContentItem = {
        id: targetDocId,
        owner_uid: uid,
        category_id: uncategorizedId,
        format,
        title: data.title || 'Untitled Content',
        script_text: mergedScript,
        tags,
        status,
        posted_to: postedTo,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      };

      if (resolvedPostedDate) {
        newItem.posted_date = resolvedPostedDate;
      }

      await setDoc(doc(db, 'content_items', targetDocId), newItem, { merge: true });
      migratedCount++;
    }

    localStorage.setItem(storageKey, 'true');
    return { migratedCount };
  } catch (error) {
    console.error('Content migration error:', error);
    return { migratedCount: 0 };
  }
}
