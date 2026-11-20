import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DashboardItemsService, MAX_FEATURED, MAX_OPEN_SUGGESTIONS, MAX_PINNED } from './dashboard.items';

function createService() {
  const db = {query: jest.fn()} as any;

  return {service: new DashboardItemsService(db), db};
}

const ENTRY = {id: 'e1', name: 'Aria'};

describe('DashboardItemsService', () => {
  describe('settings', () => {
    it('merges changes into the stored settings and trims the announcement', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{announcement: 'Old', settings: {featured: {shown: true, visibleTo: 'all'}}}]}).mockResolvedValueOnce({rows: []});

      const result = await service.updateSettings('w1', {settings: {featured: {visibleTo: 'owner'}}, announcement: '  Hello  '});

      expect(result.announcement).toBe('Hello');
      expect(result.settings.featured).toEqual({shown: true, visibleTo: 'owner'});
      expect(JSON.parse(db.query.mock.calls[1][1][1]).featured.visibleTo).toBe('owner');
    });

    it('keeps the announcement when it is not sent', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{announcement: 'Keep me', settings: {}}]}).mockResolvedValueOnce({rows: []});

      expect((await service.updateSettings('w1', {settings: {activity: {shown: false}}})).announcement).toBe('Keep me');
    });

    it('rejects invalid settings without saving', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{announcement: '', settings: {}}]});

      await expect(service.updateSettings('w1', {settings: {pinned: {visibleTo: 'all'}}})).rejects.toThrow(BadRequestException);
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('featured', () => {
    it('features an entry with the default layout', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: [{count: 2}]}).mockResolvedValueOnce({rows: [{id: 'i1'}]});

      expect(await service.addFeatured('w1', 'u1', {entryId: 'e1'})).toEqual({id: 'i1'});
      expect(db.query.mock.calls[2][1]).toEqual(['w1', 'u1', 'entry', 'e1', null, '[]', 'image', '']);
    });

    it('features an entry with the chosen layout and a trimmed message', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: [{count: 2}]}).mockResolvedValueOnce({rows: [{id: 'i1'}]});

      await service.addFeatured('w1', 'u1', {entryId: 'e1', layout: 'side', message: '  Start here  '});

      expect(db.query.mock.calls[2][1]).toEqual(['w1', 'u1', 'entry', 'e1', null, '[]', 'side', 'Start here']);
    });

    it('returns no id when the entry is already featured', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: [{count: 2}]}).mockResolvedValueOnce({rows: []});

      expect(await service.addFeatured('w1', 'u1', {entryId: 'e1'})).toEqual({id: null});
    });

    it('features a relationship', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'r1'}]}).mockResolvedValueOnce({rows: [{count: 0}]}).mockResolvedValueOnce({rows: [{id: 'i1'}]});

      await service.addFeatured('w1', 'u1', {kind: 'relationship', relationshipId: 'r1', message: 'They broke up'});

      expect(db.query.mock.calls[2][1]).toEqual(['w1', 'u1', 'relationship', null, 'r1', '[]', 'image', 'They broke up']);
    });

    it('requires a relationship that is in the world', async () => {
      const {service, db} = createService();

      await expect(service.addFeatured('w1', 'u1', {kind: 'relationship'})).rejects.toThrow('Relationship is required');

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.addFeatured('w1', 'u1', {kind: 'relationship', relationshipId: 'r9'})).rejects.toThrow(NotFoundException);
    });

    it('features details of an entry', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria', typeId: 't1'}]})
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'text'}, {id: 'f2', fieldType: 'long_text'}]})
        .mockResolvedValueOnce({rows: [{count: 0}]})
        .mockResolvedValueOnce({rows: [{id: 'i1'}]});

      await service.addFeatured('w1', 'u1', {kind: 'details', entryId: 'e1', fieldIds: ['f1', 'f2', 'f1']});

      expect(db.query.mock.calls[3][1]).toEqual(['w1', 'u1', 'details', 'e1', null, '["f1","f2"]', 'image', '']);
    });

    it('rejects details that are missing, from another type, or take more than 3 spaces', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria', typeId: 't1'}]});

      await expect(service.addFeatured('w1', 'u1', {kind: 'details', entryId: 'e1'})).rejects.toThrow('Choose at least one detail');

      db.query.mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria', typeId: 't1'}]}).mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'text'}]});

      await expect(service.addFeatured('w1', 'u1', {kind: 'details', entryId: 'e1', fieldIds: ['f1', 'f9']})).rejects.toThrow('Those details are not on this entry');

      db.query
        .mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria', typeId: 't1'}]})
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'long_text'}, {id: 'f2', fieldType: 'long_text'}]});

      await expect(service.addFeatured('w1', 'u1', {kind: 'details', entryId: 'e1', fieldIds: ['f1', 'f2']})).rejects.toThrow('Details can fill up to 3 spaces and long text fills 2');
    });

    it('stops at the limit', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: [{count: MAX_FEATURED}]});

      await expect(service.addFeatured('w1', 'u1', {entryId: 'e1'})).rejects.toThrow(`Up to ${MAX_FEATURED} items can be featured`);
    });

    it('rejects an entry that is not in the world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.addFeatured('w1', 'u1', {entryId: 'e9'})).rejects.toThrow(NotFoundException);
      await expect(service.addFeatured('w1', 'u1', {})).rejects.toThrow('Entry is required');
    });

    it('changes the layout and message of a featured item', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'i1'}]});

      expect(await service.changeFeatured('w1', 'i1', {layout: 'title', message: ' Hi '})).toEqual({id: 'i1'});
      expect(db.query.mock.calls[0][1]).toEqual(['i1', 'w1', 'title', 'Hi']);
    });

    it('keeps what is not sent and can clear the message', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: [{id: 'i1'}]});

      await service.changeFeatured('w1', 'i1', {});
      await service.changeFeatured('w1', 'i1', {message: ''});

      expect(db.query.mock.calls[0][1]).toEqual(['i1', 'w1', null, null]);
      expect(db.query.mock.calls[1][1]).toEqual(['i1', 'w1', null, '']);
    });

    it('rejects a change for an item that is not featured', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.changeFeatured('w1', 'i1', {layout: 'title'})).rejects.toThrow(NotFoundException);
    });
  });

  describe('pinned', () => {
    it('pins an entry with a note from that entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: [{id: 'n1'}]}).mockResolvedValueOnce({rows: [{count: 0}]}).mockResolvedValueOnce({rows: [{id: 'i1'}]});

      await service.addPinned('w1', 'u1', {entryId: 'e1', noteId: 'n1', message: 'Address this'});

      expect(db.query.mock.calls[3][1]).toEqual(['w1', 'u1', 'entry', 'e1', null, '[]', 'image', 'Address this', 'n1']);
    });

    it('does not attach a note to a relationship', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'r1'}]}).mockResolvedValueOnce({rows: [{count: 0}]}).mockResolvedValueOnce({rows: [{id: 'i1'}]});

      await service.addPinned('w1', 'u1', {kind: 'relationship', relationshipId: 'r1', noteId: 'n1'});

      expect(db.query.mock.calls[2][1][8]).toBeNull();
    });

    it('rejects a note that belongs to another entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: []});

      await expect(service.addPinned('w1', 'u1', {entryId: 'e1', noteId: 'n9'})).rejects.toThrow('That note is not on this entry');
    });

    it('stops at the limit', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: [{count: MAX_PINNED}]});

      await expect(service.addPinned('w1', 'u1', {entryId: 'e1'})).rejects.toThrow(`Up to ${MAX_PINNED} items can be pinned`);
    });

    it('changes or clears the note on a pinned entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{entryId: 'e1', kind: 'entry'}]}).mockResolvedValueOnce({rows: []});

      expect(await service.changePinned('w1', 'i1', {noteId: null})).toEqual({id: 'i1'});
      expect(db.query.mock.calls[1][1]).toEqual(['i1', 'w1', null, null, true, null]);
    });

    it('leaves the note alone when only the message changes', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{entryId: 'e1', kind: 'entry'}]}).mockResolvedValueOnce({rows: []});

      await service.changePinned('w1', 'i1', {message: 'Look at this'});

      expect(db.query.mock.calls[1][1]).toEqual(['i1', 'w1', null, 'Look at this', false, null]);
    });

    it('only lets an entry have a note', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{entryId: null, kind: 'relationship'}]});

      await expect(service.changePinned('w1', 'i1', {noteId: 'n1'})).rejects.toThrow('Only an entry can have a note');
    });

    it('rejects a change for an item that is not pinned', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.changePinned('w1', 'i1', {message: 'Hi'})).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSuggestion', () => {
    it('saves a suggestion about an entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{settings: {}}]}).mockResolvedValueOnce({rows: [ENTRY]}).mockResolvedValueOnce({rows: [{count: 1}]}).mockResolvedValueOnce({rows: [{id: 's1'}]});

      expect(await service.createSuggestion('w1', 'u1', 'viewer', '  Add a map  ', 'e1', true)).toEqual({id: 's1'});
      expect(db.query.mock.calls[3][1]).toEqual(['w1', 'u1', 'e1', 'Aria', 'Add a map', true]);
    });

    it('is anonymous only when asked', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{settings: {}}]}).mockResolvedValueOnce({rows: [{count: 0}]}).mockResolvedValueOnce({rows: [{id: 's1'}]});

      await service.createSuggestion('w1', 'u1', 'viewer', 'Hello');

      expect(db.query.mock.calls[2][1]).toEqual(['w1', 'u1', null, null, 'Hello', false]);
    });

    it('refuses when suggestions are off or limited to editors', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{settings: {suggestions: {submit: 'none'}}}]}).mockResolvedValueOnce({rows: [{settings: {suggestions: {submit: 'editor'}}}]});

      await expect(service.createSuggestion('w1', 'u1', 'owner', 'Hi')).rejects.toThrow(ForbiddenException);
      await expect(service.createSuggestion('w1', 'u1', 'viewer', 'Hi')).rejects.toThrow(ForbiddenException);
    });

    it('stops at the open suggestion limit', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{settings: {}}]}).mockResolvedValueOnce({rows: [{count: MAX_OPEN_SUGGESTIONS}]});

      await expect(service.createSuggestion('w1', 'u1', 'viewer', 'Hi')).rejects.toThrow(`You already have ${MAX_OPEN_SUGGESTIONS} open suggestions in this world`);
    });
  });

  describe('reviewing suggestions', () => {
    it('lets editors list them by default and owners only when set', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{settings: {}}]}).mockResolvedValueOnce({rows: [{id: 's1'}]}).mockResolvedValueOnce({rows: [{settings: {suggestions: {see: 'owner'}}}]});

      expect(await service.listSuggestions('w1', 'editor', false)).toEqual([{id: 's1'}]);
      await expect(service.listSuggestions('w1', 'editor', false)).rejects.toThrow(ForbiddenException);
    });

    it('refuses viewers', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{settings: {}}]});

      await expect(service.listSuggestions('w1', 'viewer', false)).rejects.toThrow(ForbiddenException);
    });

    it('changes the status, and rejects an unknown suggestion', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{settings: {}}]}).mockResolvedValueOnce({rows: [{id: 's1', status: 'done'}]}).mockResolvedValueOnce({rows: [{settings: {}}]}).mockResolvedValueOnce({rows: []});

      expect(await service.setSuggestionStatus('w1', 'editor', 'u1', 's1', 'done')).toEqual({id: 's1', status: 'done'});
      await expect(service.setSuggestionStatus('w1', 'editor', 'u1', 's9', 'done')).rejects.toThrow(NotFoundException);
    });
  });
});
