export type ContentFormat = 'long_form' | 'short_form';
export type ContentStatus = 'draft' | 'ready' | 'posted';
export type PostedPlatform = 'youtube' | 'tiktok' | 'facebook' | 'instagram';

export interface ContentCategory {
  id: string;
  owner_uid: string;
  name: string;
  parent_category_id: string | null;
  created_at: string;
}

export interface CustomDataField {
  id: string;
  title: string;
  body: string;
}

export interface ContentItem {
  id: string;
  owner_uid: string;
  category_id: string;
  format: ContentFormat;
  title: string;
  script_text: string;
  tags: string[];
  raw_tags?: string;
  custom_data?: CustomDataField[];
  status: ContentStatus;
  posted_to?: PostedPlatform[];
  posted_date?: string;
  created_at: string;
  updated_at: string;
}

export type TreeNodeType = 'root' | 'trunk' | 'branch' | 'leaf';
export type TreeNodeStatus = 'seed' | 'sprouting' | 'in_production' | 'harvested';

export interface ContentTreeNode {
  id: string;
  parentId: string | null;
  title: string;
  type: TreeNodeType;
  platform?: PostedPlatform | 'all';
  format?: ContentFormat;
  notes?: string;
  status: TreeNodeStatus;
  color?: string;
  x?: number;
  y?: number;
  isCollapsed?: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentTree {
  id: string;
  owner_uid: string;
  title: string;
  description?: string;
  category_id?: string;
  nodes: ContentTreeNode[];
  created_at: string;
  updated_at: string;
}

