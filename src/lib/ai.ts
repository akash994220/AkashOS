export interface AIGenerateParams {
  action: 'idea_expansion' | 'hook_suggestions' | 'caption_hashtag' | 'seo_metadata' | 'best_time_suggestion';
  platform: 'youtube' | 'tiktok' | 'facebook' | 'instagram';
  title?: string;
  ideaNotes?: string;
  context?: Record<string, any>;
}

export async function requestAIAssistance(params: AIGenerateParams): Promise<string> {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errData.error || `Server responded with status ${response.status}`);
  }

  const data = await response.json();
  return data.result || '';
}
