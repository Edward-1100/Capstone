import { BadRequestException } from '@nestjs/common';
import { canReviewSuggestions, canSee, canSubmitSuggestion, DEFAULT_SETTINGS, readSettings } from './dashboard.settings';

describe('dashboard settings', () => {
  describe('readSettings', () => {
    it('uses the defaults for missing or empty settings', () => {
      expect(readSettings({})).toEqual(DEFAULT_SETTINGS);
      expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
      expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    });

    it('merges what is given over the defaults', () => {
      const result = readSettings({featured: {visibleTo: 'owner'}, activity: {shown: false}, suggestions: {submit: 'none'}});

      expect(result.featured).toEqual({shown: true, visibleTo: 'owner'});
      expect(result.activity).toEqual({shown: false, visibleTo: 'all'});
      expect(result.suggestions).toEqual({submit: 'none', see: 'editor'});
      expect(result.pinned).toEqual(DEFAULT_SETTINGS.pinned);
    });

    it('does not change the defaults', () => {
      readSettings({featured: {visibleTo: 'owner'}});

      expect(DEFAULT_SETTINGS.featured.visibleTo).toBe('all');
    });

    it('rejects an audience the widget does not allow', () => {
      expect(() => readSettings({pinned: {visibleTo: 'all'}})).toThrow(BadRequestException);
    });

    it('rejects values of the wrong type or unknown levels', () => {
      expect(() => readSettings({featured: {shown: 'yes'}})).toThrow(BadRequestException);
      expect(() => readSettings({featured: 'owner'})).toThrow(BadRequestException);
      expect(() => readSettings({activity: {shown: 1}})).toThrow(BadRequestException);
      expect(() => readSettings({suggestions: {submit: 'everyone'}})).toThrow(BadRequestException);
      expect(() => readSettings({suggestions: {see: 'viewer'}})).toThrow(BadRequestException);
    });
  });

  describe('canSee', () => {
    it('hides a widget that is switched off', () => {
      expect(canSee({shown: false, visibleTo: 'all'}, 'owner')).toBe(false);
    });

    it('shows an everyone widget to signed out people too', () => {
      expect(canSee({shown: true, visibleTo: 'all'}, null)).toBe(true);
      expect(canSee({shown: true, visibleTo: 'all'}, 'viewer')).toBe(true);
    });

    it('limits editor widgets to editors and owners', () => {
      const widget = {shown: true, visibleTo: 'editor' as const};

      expect(canSee(widget, null)).toBe(false);
      expect(canSee(widget, 'viewer')).toBe(false);
      expect(canSee(widget, 'editor')).toBe(true);
      expect(canSee(widget, 'owner')).toBe(true);
    });

    it('limits owner widgets to owners', () => {
      const widget = {shown: true, visibleTo: 'owner' as const};

      expect(canSee(widget, 'editor')).toBe(false);
      expect(canSee(widget, 'owner')).toBe(true);
    });
  });

  describe('suggestions', () => {
    it('follows the submit level', () => {
      const open = readSettings({suggestions: {submit: 'viewer'}});
      const editors = readSettings({suggestions: {submit: 'editor'}});
      const off = readSettings({suggestions: {submit: 'none'}});

      expect(canSubmitSuggestion(open, null)).toBe(true);
      expect(canSubmitSuggestion(open, 'viewer')).toBe(true);
      expect(canSubmitSuggestion(editors, 'viewer')).toBe(false);
      expect(canSubmitSuggestion(editors, 'editor')).toBe(true);
      expect(canSubmitSuggestion(off, 'owner')).toBe(false);
    });

    it('follows the review level', () => {
      const editors = readSettings({suggestions: {see: 'editor'}});
      const owner = readSettings({suggestions: {see: 'owner'}});

      expect(canReviewSuggestions(editors, 'editor')).toBe(true);
      expect(canReviewSuggestions(editors, 'viewer')).toBe(false);
      expect(canReviewSuggestions(editors, null)).toBe(false);
      expect(canReviewSuggestions(owner, 'editor')).toBe(false);
      expect(canReviewSuggestions(owner, 'owner')).toBe(true);
    });
  });
});
