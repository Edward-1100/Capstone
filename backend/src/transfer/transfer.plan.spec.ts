import { readPlan } from './transfer.plan';

describe('readPlan', () => {
  it('rejects text that is not a plan', () => {
    expect(() => readPlan(undefined)).toThrow('The import choices are not valid');
    expect(() => readPlan('{')).toThrow('The import choices are not valid');
    expect(() => readPlan('[]')).toThrow('The import choices are not valid');
  });

  it('fills defaults', () => {
    const plan = readPlan('{}');

    expect(plan.world).toEqual({name: '', description: ''});
    expect(plan.options).toEqual({images: false, comments: false, notes: false});
    expect(plan.select.entries).toEqual([]);
    expect(plan.resolutions.entries).toEqual({});
  });

  it('reads options, selections and resolutions', () => {
    const plan = readPlan(JSON.stringify({
      world: {name: ' Copy ', description: 'About'},
      options: {images: true, comments: 'yes', notes: true},
      select: {entries: ['a', 5], maps: ['m']},
      resolutions: {entries: {a: {action: 'rename', name: ' Aldric II '}, b: {action: 'explode'}, c: {action: 'keep'}}, maps: 'bad'},
    }));

    expect(plan.world).toEqual({name: 'Copy', description: 'About'});
    expect(plan.options).toEqual({images: true, comments: false, notes: true});
    expect(plan.select.entries).toEqual(['a']);
    expect(plan.resolutions.entries).toEqual({a: {action: 'rename', name: 'Aldric II'}, c: {action: 'keep', name: ''}});
    expect(plan.resolutions.maps).toEqual({});
  });
});
