import { ContentTree, ContentTreeNode, TreeNodeType, TreeNodeStatus, PostedPlatform, ContentFormat } from '../../../types/content';

export interface LayoutNode extends ContentTreeNode {
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
  isExpanded: boolean;
  depth: number;
  directChildrenCount: number;
  descendantCount: number;
  hasCustomPosition?: boolean;
}

export const NODE_WIDTH = 250;
export const NODE_HEIGHT = 100;
export const HORIZONTAL_SPACING = 80;
export const VERTICAL_SPACING = 24;

/**
 * Human-friendly level names
 */
export function getFriendlyTierLabel(depth: number, type?: TreeNodeType): { label: string; emoji: string; color: string } {
  if (depth === 0 || type === 'root') {
    return { label: 'Main Topic', emoji: '🎯', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (depth === 1 || type === 'trunk') {
    return { label: 'Angle / Pillar', emoji: '💡', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  if (depth === 2 || type === 'branch') {
    return { label: 'Post / Video', emoji: '🎬', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  }
  return { label: 'Hook / Note', emoji: '⚡', color: 'bg-sky-50 text-sky-700 border-sky-200' };
}

/**
 * Human-friendly status labels
 */
export function getFriendlyStatusLabel(status: TreeNodeStatus): { label: string; color: string; badge: string } {
  switch (status) {
    case 'harvested':
      return { label: 'Sent to Studio', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', badge: '✅ Sent' };
    case 'in_production':
      return { label: 'In Progress', color: 'text-purple-700 bg-purple-50 border-purple-200', badge: '⏳ Progress' };
    case 'sprouting':
      return { label: 'Developing', color: 'text-blue-700 bg-blue-50 border-blue-200', badge: '🌱 In Dev' };
    default:
      return { label: 'Idea', color: 'text-zinc-600 bg-zinc-100 border-zinc-200', badge: '💡 Idea' };
  }
}

/**
 * Creates starter templates for rapid brainstorming
 */
export function createStarterTemplate(
  templateId: 'multi_platform' | 'youtube_waterfall' | 'blank',
  title: string,
  userId: string,
  categoryId?: string
): ContentTree {
  const treeId = `tree_${Date.now()}`;
  const now = new Date().toISOString();

  let nodes: ContentTreeNode[] = [];

  if (templateId === 'multi_platform') {
    const rootId = `node_${Date.now()}_root`;
    const angle1Id = `node_${Date.now()}_a1`;
    const angle2Id = `node_${Date.now()}_a2`;
    const ytId = `node_${Date.now()}_yt`;
    const ttId = `node_${Date.now()}_tt`;
    const igId = `node_${Date.now()}_ig`;
    const leafYt1 = `node_${Date.now()}_lyt1`;

    nodes = [
      {
        id: rootId,
        parentId: null,
        title: title || 'Core Idea: AI Coding Revolution',
        type: 'root',
        status: 'seed',
        notes: 'Main thesis: How modern developers build full apps 10x faster using intelligent tools.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: angle1Id,
        parentId: rootId,
        title: 'Angle 1: Case Study & Breakdown',
        type: 'trunk',
        status: 'sprouting',
        notes: 'Real-world numbers, step-by-step methodology, proof of concept.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: angle2Id,
        parentId: rootId,
        title: 'Angle 2: The 3 Mistakes Beginners Make',
        type: 'trunk',
        status: 'seed',
        notes: 'Counter-intuitive advice, myth-busting, beginner pitfalls.',
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: ytId,
        parentId: angle1Id,
        title: 'YouTube Deep-Dive Video (10m)',
        type: 'branch',
        platform: 'youtube',
        format: 'long_form',
        status: 'sprouting',
        notes: 'Opening hook (0-30s), Problem breakdown, 3 core steps, Visual diagram, Outro CTA.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: leafYt1,
        parentId: ytId,
        title: 'Hook: "Stop coding like it is 2020..."',
        type: 'leaf',
        platform: 'youtube',
        format: 'long_form',
        status: 'seed',
        notes: 'High-contrast thumbnail with zoomed graph and bold 3-word title.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: ttId,
        parentId: angle2Id,
        title: 'TikTok / Short: 45s High-Retention Tip',
        type: 'branch',
        platform: 'tiktok',
        format: 'short_form',
        status: 'seed',
        notes: 'Fast 3s hook, 3 rapid-fire tips on green screen, comment prompt.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: igId,
        parentId: angle1Id,
        title: 'Instagram Carousel: 5 Step Guide',
        type: 'branch',
        platform: 'instagram',
        format: 'short_form',
        status: 'seed',
        notes: 'Slide 1: Bold stat. Slides 2-4: The framework. Slide 5: Summary & Save.',
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];
  } else if (templateId === 'youtube_waterfall') {
    const rootId = `node_${Date.now()}_root`;
    const ch1Id = `node_${Date.now()}_ch1`;
    const ch2Id = `node_${Date.now()}_ch2`;
    const short1 = `node_${Date.now()}_s1`;
    const short2 = `node_${Date.now()}_s2`;

    nodes = [
      {
        id: rootId,
        parentId: null,
        title: title || 'Cornerstone Video: Full Production',
        type: 'root',
        platform: 'youtube',
        format: 'long_form',
        status: 'sprouting',
        notes: 'Main long-form video. Repurpose key moments into Shorts.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: ch1Id,
        parentId: rootId,
        title: 'Chapter 1: The Core Problem',
        type: 'trunk',
        status: 'sprouting',
        notes: 'Relatable story, visual b-roll of frustration, shock stat.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: ch2Id,
        parentId: rootId,
        title: 'Chapter 2: The Solution Framework',
        type: 'trunk',
        status: 'seed',
        notes: 'Step-by-step walk-through demonstration.',
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: short1,
        parentId: ch1Id,
        title: 'Short #1: 30s Cut-Down Clip',
        type: 'branch',
        platform: 'tiktok',
        format: 'short_form',
        status: 'seed',
        notes: 'Clip directly from Chapter 1 with 9:16 crop and dynamic captions.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: short2,
        parentId: ch2Id,
        title: 'Short #2: Golden Rule Teaser',
        type: 'branch',
        platform: 'youtube',
        format: 'short_form',
        status: 'seed',
        notes: 'Fast paced cut pointing to full video link in description.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
  } else {
    // Blank Root
    const rootId = `node_${Date.now()}_root`;
    nodes = [
      {
        id: rootId,
        parentId: null,
        title: title || 'My Main Idea',
        type: 'root',
        status: 'seed',
        notes: 'Click the "+" button on this card to branch out your sub-topics and video ideas.',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  return {
    id: treeId,
    owner_uid: userId,
    title: title || 'Untitled Idea Tree',
    description: 'Brainstorm and map out your content branches',
    category_id: categoryId,
    nodes,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Calculates tree coordinates for 2D horizontal layout (Left-to-Right organic tree)
 */
export function computeTreeLayout(
  nodes: ContentTreeNode[],
  respectCustomPositions = true
): {
  layoutNodes: LayoutNode[];
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { layoutNodes: [], width: 800, height: 600 };
  }

  // Build parent-to-children map
  const childMap = new Map<string, ContentTreeNode[]>();
  const nodeMap = new Map<string, ContentTreeNode>();
  nodes.forEach((n) => {
    nodeMap.set(n.id, n);
    if (n.parentId) {
      const list = childMap.get(n.parentId) || [];
      list.push(n);
      childMap.set(n.parentId, list);
    }
  });

  // Sort children by order
  childMap.forEach((list) => {
    list.sort((a, b) => a.order - b.order);
  });

  // Find all root nodes (parentId is null or parent not in nodes list)
  let rootNodes = nodes.filter((n) => n.parentId === null || !nodeMap.has(n.parentId));
  if (rootNodes.length === 0) {
    rootNodes = [nodes[0]];
  }

  // Build recursive tree structure
  function buildSubtree(rawNode: ContentTreeNode, depth = 0): LayoutNode {
    const rawChildren = childMap.get(rawNode.id) || [];
    const directChildrenCount = rawChildren.length;
    const allChildren = rawChildren.map((child) => buildSubtree(child, depth + 1));
    const descendantCount = allChildren.reduce((sum, c) => sum + 1 + c.descendantCount, 0);
    const isExpanded = !rawNode.isCollapsed;
    const children = isExpanded ? allChildren : [];
    const hasCustomPosition = rawNode.x !== undefined && rawNode.y !== undefined;

    return {
      ...rawNode,
      x: rawNode.x !== undefined ? rawNode.x : 0,
      y: rawNode.y !== undefined ? rawNode.y : 0,
      hasCustomPosition,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      children,
      isExpanded,
      depth,
      directChildrenCount,
      descendantCount,
    };
  }

  const rootLayouts = rootNodes.map((r) => buildSubtree(r, 0));

  // Calculate vertical height needed for each subtree
  function computeSubtreeHeight(node: LayoutNode): number {
    if (!node.isExpanded || node.children.length === 0) {
      return NODE_HEIGHT + VERTICAL_SPACING;
    }
    let totalHeight = 0;
    node.children.forEach((child) => {
      totalHeight += computeSubtreeHeight(child);
    });
    return Math.max(NODE_HEIGHT + VERTICAL_SPACING, totalHeight);
  }

  // Assign X and Y coordinates (Left-to-Right layout)
  const START_X = 60;
  let currentRootY = 60;

  function assignPositions(node: LayoutNode, x: number, currentY: number): number {
    const subHeight = computeSubtreeHeight(node);
    const useComputed = !respectCustomPositions || !node.hasCustomPosition;

    if (useComputed) {
      node.x = x;
    }

    if (!node.isExpanded || node.children.length === 0) {
      if (useComputed) {
        node.y = currentY + (subHeight - NODE_HEIGHT) / 2;
      }
      return currentY + subHeight;
    }

    let childY = currentY;
    // Next column is based on current node's x (so if parent has custom coordinates, children follow it!)
    const nextX = (node.hasCustomPosition ? node.x : x) + NODE_WIDTH + HORIZONTAL_SPACING;

    node.children.forEach((child) => {
      childY = assignPositions(child, nextX, childY);
    });

    if (useComputed) {
      const firstChild = node.children[0];
      const lastChild = node.children[node.children.length - 1];
      node.y = (firstChild.y + lastChild.y) / 2;
    }

    return childY;
  }

  rootLayouts.forEach((root) => {
    currentRootY = assignPositions(root, START_X, currentRootY) + VERTICAL_SPACING;
  });

  // Flatten layout nodes for fast SVG and canvas rendering
  const flattened: LayoutNode[] = [];
  let maxX = 900;
  let maxY = Math.max(currentRootY + 120, 650);

  function collect(node: LayoutNode) {
    flattened.push(node);
    if (node.x + node.width > maxX) maxX = node.x + node.width + 160;
    if (node.y + node.height > maxY) maxY = node.y + node.height + 160;

    if (node.isExpanded) {
      node.children.forEach(collect);
    }
  }

  rootLayouts.forEach(collect);

  return {
    layoutNodes: flattened,
    width: maxX,
    height: maxY,
  };
}

/**
 * Duplicates a node and all of its descendants with new unique IDs
 */
export function duplicateSubtree(
  nodes: ContentTreeNode[],
  targetNodeId: string
): ContentTreeNode[] {
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (!targetNode) return nodes;

  const now = new Date().toISOString();
  const idMap = new Map<string, string>();

  // Collect all descendants of targetNode
  const toCloneIds: string[] = [targetNodeId];
  let idx = 0;
  while (idx < toCloneIds.length) {
    const curId = toCloneIds[idx++];
    nodes.filter((n) => n.parentId === curId).forEach((c) => toCloneIds.push(c.id));
  }

  toCloneIds.forEach((oldId) => {
    idMap.set(oldId, `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  });

  const clonedNodes: ContentTreeNode[] = toCloneIds.map((oldId) => {
    const original = nodes.find((n) => n.id === oldId)!;
    const isRootOfClone = oldId === targetNodeId;
    return {
      ...original,
      id: idMap.get(oldId)!,
      parentId: isRootOfClone ? original.parentId : idMap.get(original.parentId!)!,
      title: isRootOfClone ? `${original.title} (Copy)` : original.title,
      x: original.x !== undefined ? original.x + 40 : undefined,
      y: original.y !== undefined ? original.y + 40 : undefined,
      createdAt: now,
      updatedAt: now,
    };
  });

  return [...nodes, ...clonedNodes];
}

/**
 * Export tree as JSON file for download
 */
export function exportTreeToJSON(tree: ContentTree): string {
  return JSON.stringify(tree, null, 2);
}

/**
 * Parse and validate imported tree JSON
 */
export function parseTreeFromJSON(jsonStr: string, currentUserId: string): ContentTree | null {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
      return null;
    }
    const now = new Date().toISOString();
    return {
      id: `tree_${Date.now()}`,
      owner_uid: currentUserId,
      title: data.title ? `${data.title} (Imported)` : 'Imported Idea Tree',
      description: data.description || '',
      category_id: data.category_id,
      nodes: data.nodes.map((n: any, idx: number) => ({
        id: n.id || `node_${Date.now()}_${idx}`,
        parentId: n.parentId !== undefined ? n.parentId : null,
        title: n.title || 'Untitled Node',
        type: n.type || 'branch',
        platform: n.platform || 'all',
        format: n.format || 'long_form',
        notes: n.notes || '',
        status: n.status || 'seed',
        color: n.color,
        x: n.x,
        y: n.y,
        isCollapsed: Boolean(n.isCollapsed),
        order: typeof n.order === 'number' ? n.order : idx,
        createdAt: n.createdAt || now,
        updatedAt: now,
      })),
      created_at: now,
      updated_at: now,
    };
  } catch (err) {
    console.error('Failed to parse tree JSON:', err);
    return null;
  }
}

/**
 * Generates an SVG cubic bezier path connecting parent card right edge to child card left edge
 */
export function getCurvedConnectorPath(parent: LayoutNode, child: LayoutNode): string {
  const startX = parent.x + parent.width;
  const startY = parent.y + parent.height / 2;
  const endX = child.x;
  const endY = child.y + child.height / 2;

  const deltaX = Math.max((endX - startX) * 0.5, 30);
  const cp1X = startX + deltaX;
  const cp1Y = startY;
  const cp2X = endX - deltaX;
  const cp2Y = endY;

  return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
}

/**
 * Export tree as Markdown outline
 */
export function exportTreeToMarkdown(tree: ContentTree): string {
  const childMap = new Map<string, ContentTreeNode[]>();
  tree.nodes.forEach((n) => {
    if (n.parentId) {
      const list = childMap.get(n.parentId) || [];
      list.push(n);
      childMap.set(n.parentId, list);
    }
  });

  const root = tree.nodes.find((n) => n.parentId === null) || tree.nodes[0];
  if (!root) return `# ${tree.title}\n`;

  let md = `# Content Tree: ${tree.title}\n\n`;
  if (tree.description) md += `> ${tree.description}\n\n`;

  function walk(node: ContentTreeNode, depth = 0) {
    const indent = '  '.repeat(depth);
    const platformBadge = node.platform ? `[${node.platform.toUpperCase()}] ` : '';
    const statusBadge = `(${node.status})`;
    md += `${indent}- **${node.title}** ${platformBadge}${statusBadge}\n`;
    if (node.notes) {
      const noteIndent = '  '.repeat(depth + 1);
      md += `${noteIndent}*Notes: ${node.notes.replace(/\n/g, ' ')}*\n`;
    }
    const children = childMap.get(node.id) || [];
    children.forEach((c) => walk(c, depth + 1));
  }

  walk(root, 0);
  return md;
}
