import { BadRequestException } from '@nestjs/common';

export type Audience = 'all' | 'editor' | 'owner';
export type SubmitLevel = 'viewer' | 'editor' | 'none';
export type SeeLevel = 'editor' | 'owner';

export interface AudienceWidget {
  shown: boolean;
  visibleTo: Audience;
}

export interface DashboardSettings {
  announcement: AudienceWidget;
  entries: AudienceWidget;
  attention: AudienceWidget;
  featured: AudienceWidget;
  pinned: AudienceWidget;
  activity: AudienceWidget;
  suggestions: {submit: SubmitLevel; see: SeeLevel};
}

export const MAX_ANNOUNCEMENT = 1000;

export const AUDIENCE_WIDGETS = ['announcement', 'entries', 'attention', 'featured', 'pinned', 'activity'] as const;

const ALLOWED: Record<string, Audience[]> = {
  announcement: ['all', 'editor', 'owner'],
  entries: ['all', 'editor', 'owner'],
  attention: ['all', 'editor', 'owner'],
  featured: ['all', 'editor', 'owner'],
  pinned: ['editor', 'owner'],
  activity: ['all', 'editor', 'owner'],
};

export const DEFAULT_SETTINGS: DashboardSettings = {
  announcement: {shown: true, visibleTo: 'all'},
  entries: {shown: true, visibleTo: 'all'},
  attention: {shown: true, visibleTo: 'editor'},
  featured: {shown: true, visibleTo: 'all'},
  pinned: {shown: true, visibleTo: 'editor'},
  activity: {shown: true, visibleTo: 'all'},
  suggestions: {submit: 'viewer', see: 'editor'},
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readSettings(raw: unknown): DashboardSettings {
  const source = isObject(raw) ? raw : {};
  const result: DashboardSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  for (const name of AUDIENCE_WIDGETS) {
    const item = source[name];

    if (item === undefined) {
      continue;
    }

    if (!isObject(item)) {
      throw new BadRequestException(`Dashboard setting ${name} is not valid`);
    }

    if (item.shown !== undefined) {
      if (typeof item.shown !== 'boolean') {
        throw new BadRequestException(`Dashboard setting ${name} is not valid`);
      }

      result[name].shown = item.shown;
    }

    if (item.visibleTo !== undefined) {
      if (typeof item.visibleTo !== 'string' || !ALLOWED[name].includes(item.visibleTo as Audience)) {
        throw new BadRequestException(`Dashboard setting ${name} is not valid`);
      }

      result[name].visibleTo = item.visibleTo as Audience;
    }
  }

  const suggestions = source.suggestions;

  if (suggestions !== undefined) {
    if (!isObject(suggestions)) {
      throw new BadRequestException('Dashboard setting suggestions is not valid');
    }

    if (suggestions.submit !== undefined) {
      if (suggestions.submit !== 'viewer' && suggestions.submit !== 'editor' && suggestions.submit !== 'none') {
        throw new BadRequestException('Dashboard setting suggestions is not valid');
      }

      result.suggestions.submit = suggestions.submit;
    }

    if (suggestions.see !== undefined) {
      if (suggestions.see !== 'editor' && suggestions.see !== 'owner') {
        throw new BadRequestException('Dashboard setting suggestions is not valid');
      }

      result.suggestions.see = suggestions.see;
    }
  }

  return result;
}

export function canSee(settings: AudienceWidget, role: string | null) {
  if (!settings.shown) {
    return false;
  }

  if (settings.visibleTo === 'all') {
    return true;
  }

  if (settings.visibleTo === 'editor') {
    return role === 'editor' || role === 'owner';
  }

  return role === 'owner';
}

export function canSubmitSuggestion(settings: DashboardSettings, role: string | null) {
  if (settings.suggestions.submit === 'none') {
    return false;
  }

  if (settings.suggestions.submit === 'editor') {
    return role === 'editor' || role === 'owner';
  }

  return true;
}

export function canReviewSuggestions(settings: DashboardSettings, role: string | null) {
  if (settings.suggestions.see === 'owner') {
    return role === 'owner';
  }

  return role === 'editor' || role === 'owner';
}
