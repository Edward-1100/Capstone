import { applyFieldValues, normalizeConfig } from './field-values';

function field(fieldType: string, config: any = {}, name = 'Field') {
  return {id: 'f1', name, fieldType, config};
}

describe('normalizeConfig', () => {
  describe('boolean', () => {
    it('defaults to Yes and No', () => {
      expect(normalizeConfig('boolean', {})).toEqual({trueLabel: 'Yes', falseLabel: 'No'});
    });

    it('trims the names', () => {
      expect(normalizeConfig('boolean', {trueLabel: ' Alive ', falseLabel: ' Dead '})).toEqual({trueLabel: 'Alive', falseLabel: 'Dead'});
    });

    it('rejects names that only differ by case', () => {
      expect(() => normalizeConfig('boolean', {trueLabel: 'Intact', falseLabel: 'intact'})).toThrow('Option names must be different');
    });

    it('rejects a blank name', () => {
      expect(() => normalizeConfig('boolean', {trueLabel: '  ', falseLabel: 'No'})).toThrow('Option name must be 1 to 50 characters');
    });
  });

  describe('scale', () => {
    it('keeps the range and the step names', () => {
      const config = normalizeConfig('scale', {min: 1, max: 3, labels: {'1': 'Low', '3': 'High'}});

      expect(config).toEqual({min: 1, max: 3, labels: {'1': 'Low', '3': 'High'}});
    });

    it('drops names outside the range and blank names', () => {
      const config = normalizeConfig('scale', {min: 1, max: 3, labels: {'0': 'Zero', '2': '  ', '3': 'High', '9': 'Nine'}});

      expect(config).toEqual({min: 1, max: 3, labels: {'3': 'High'}});
    });

    it('keeps the old values when only the names are sent', () => {
      const config = normalizeConfig('scale', {labels: {'2': 'Mid'}}, {min: 1, max: 5, labels: {}});

      expect(config).toEqual({min: 1, max: 5, labels: {'2': 'Mid'}});
    });

    it('rejects a minimum that is not lower than the maximum', () => {
      expect(() => normalizeConfig('scale', {min: 5, max: 5})).toThrow('Scale minimum must be lower than maximum');
      expect(() => normalizeConfig('scale', {min: 6, max: 5})).toThrow('Scale minimum must be lower than maximum');
    });

    it('rejects numbers that are not whole', () => {
      expect(() => normalizeConfig('scale', {min: 1.5, max: 5})).toThrow('A scale needs a whole number minimum and maximum');
      expect(() => normalizeConfig('scale', {min: 1})).toThrow('A scale needs a whole number minimum and maximum');
    });

    it('allows 100 steps and rejects 101', () => {
      expect(normalizeConfig('scale', {min: 1, max: 100})).toEqual({min: 1, max: 100, labels: {}});
      expect(() => normalizeConfig('scale', {min: 1, max: 101})).toThrow('A scale can have up to 100 steps');
    });

    it('allows negative numbers', () => {
      expect(normalizeConfig('scale', {min: -5, max: 5})).toEqual({min: -5, max: 5, labels: {}});
    });
  });

  describe('choice', () => {
    it('gives every new option its own id', () => {
      const config: any = normalizeConfig('choice', {options: [{label: 'Red'}, {label: 'Blue'}]});

      expect(config.options).toHaveLength(2);
      expect(config.options[0].label).toBe('Red');
      expect(typeof config.options[0].id).toBe('string');
      expect(config.options[0].id).not.toBe(config.options[1].id);
    });

    it('keeps the id of an option that was renamed', () => {
      const existing = {options: [{id: 'a', label: 'Red'}, {id: 'b', label: 'Blue'}]};
      const config: any = normalizeConfig('choice', {options: [{id: 'a', label: 'Crimson'}, {id: 'b', label: 'Blue'}]}, existing);

      expect(config.options).toEqual([{id: 'a', label: 'Crimson'}, {id: 'b', label: 'Blue'}]);
    });

    it('does not trust an id that was not already on the field', () => {
      const existing = {options: [{id: 'a', label: 'Red'}]};
      const config: any = normalizeConfig('choice', {options: [{id: 'made-up', label: 'Red'}]}, existing);

      expect(config.options[0].id).not.toBe('made-up');
    });

    it('rejects names that only differ by case', () => {
      expect(() => normalizeConfig('multi_choice', {options: [{label: 'Red'}, {label: 'red'}]})).toThrow('Option names must be different');
    });

    it('rejects no options and more than 50', () => {
      const many = Array.from({length: 51}, (item, index) => ({label: `Option ${index}`}));

      expect(() => normalizeConfig('choice', {options: []})).toThrow('Add 1 to 50 options');
      expect(() => normalizeConfig('choice', {options: many})).toThrow('Add 1 to 50 options');
      expect(() => normalizeConfig('choice', {})).toThrow('Add 1 to 50 options');
    });

    it('allows exactly 50 options', () => {
      const fifty = Array.from({length: 50}, (item, index) => ({label: `Option ${index}`}));
      const config: any = normalizeConfig('choice', {options: fifty});

      expect(config.options).toHaveLength(50);
    });

    it('rejects a blank option name', () => {
      expect(() => normalizeConfig('choice', {options: [{label: '   '}]})).toThrow('Option name must be 1 to 50 characters');
    });
  });

  it('returns an empty config for text, long text, and number', () => {
    expect(normalizeConfig('text', {anything: true})).toEqual({});
    expect(normalizeConfig('long_text', undefined)).toEqual({});
    expect(normalizeConfig('number', null)).toEqual({});
  });
});

describe('applyFieldValues', () => {
  describe('text and number', () => {
    it('allows 500 characters of text and rejects 501', () => {
      const definitions = [field('text', {}, 'Title')];

      expect(applyFieldValues(definitions, {}, {f1: 'a'.repeat(500)})).toEqual({f1: 'a'.repeat(500)});
      expect(() => applyFieldValues(definitions, {}, {f1: 'a'.repeat(501)})).toThrow('Title can only be up to 500 characters');
    });

    it('allows 20000 characters of long text and rejects 20001', () => {
      const definitions = [field('long_text', {}, 'Story')];

      expect(applyFieldValues(definitions, {}, {f1: 'a'.repeat(20000)})).toEqual({f1: 'a'.repeat(20000)});
      expect(() => applyFieldValues(definitions, {}, {f1: 'a'.repeat(20001)})).toThrow('Story can only be up to 20000 characters');
    });

    it('rejects text that is not a string', () => {
      expect(() => applyFieldValues([field('text', {}, 'Title')], {}, {f1: 5})).toThrow('Title must be text');
    });

    it('accepts numbers including zero and negatives', () => {
      const definitions = [field('number', {}, 'Weight')];

      expect(applyFieldValues(definitions, {}, {f1: 0})).toEqual({f1: 0});
      expect(applyFieldValues(definitions, {}, {f1: -2.5})).toEqual({f1: -2.5});
    });

    it('rejects a number sent as text or a number that is not finite', () => {
      const definitions = [field('number', {}, 'Weight')];

      expect(() => applyFieldValues(definitions, {}, {f1: '5'})).toThrow('Weight must be a number');
      expect(() => applyFieldValues(definitions, {}, {f1: Infinity})).toThrow('Weight must be a number');
    });
  });

  describe('boolean', () => {
    const definitions = [field('boolean', {trueLabel: 'Intact', falseLabel: 'Broken'}, 'Status')];

    it('accepts false as a real value', () => {
      expect(applyFieldValues(definitions, {}, {f1: false})).toEqual({f1: false});
    });

    it('rejects anything that is not true or false', () => {
      expect(() => applyFieldValues(definitions, {}, {f1: 'Intact'})).toThrow('Status must be Intact or Broken');
      expect(() => applyFieldValues(definitions, {}, {f1: 1})).toThrow('Status must be Intact or Broken');
    });
  });

  describe('scale', () => {
    const definitions = [field('scale', {min: 1, max: 5, labels: {}}, 'Rank')];

    it('accepts the lowest and highest step', () => {
      expect(applyFieldValues(definitions, {}, {f1: 1})).toEqual({f1: 1});
      expect(applyFieldValues(definitions, {}, {f1: 5})).toEqual({f1: 5});
    });

    it('rejects a value outside the range or not whole', () => {
      expect(() => applyFieldValues(definitions, {}, {f1: 0})).toThrow('Rank must be a whole number from 1 to 5');
      expect(() => applyFieldValues(definitions, {}, {f1: 6})).toThrow('Rank must be a whole number from 1 to 5');
      expect(() => applyFieldValues(definitions, {}, {f1: 2.5})).toThrow('Rank must be a whole number from 1 to 5');
    });

    it('keeps saving an unchanged value that is now outside the range', () => {
      expect(applyFieldValues(definitions, {f1: 7}, {f1: 7})).toEqual({f1: 7});
    });

    it('rejects a changed value that is outside the range', () => {
      expect(() => applyFieldValues(definitions, {f1: 7}, {f1: 8})).toThrow('Rank must be a whole number from 1 to 5');
    });

    it('lets an out of range value be moved back into the range', () => {
      expect(applyFieldValues(definitions, {f1: 7}, {f1: 3})).toEqual({f1: 3});
    });
  });

  describe('choice and multiple choice', () => {
    const options = [{id: 'a', label: 'Red'}, {id: 'b', label: 'Blue'}];

    it('accepts an option id and rejects an unknown one', () => {
      const definitions = [field('choice', {options}, 'Color')];

      expect(applyFieldValues(definitions, {}, {f1: 'a'})).toEqual({f1: 'a'});
      expect(() => applyFieldValues(definitions, {}, {f1: 'zzz'})).toThrow('Color must be one of its options');
      expect(() => applyFieldValues(definitions, {}, {f1: ['a']})).toThrow('Color must be one of its options');
    });

    it('accepts several option ids and removes duplicates', () => {
      const definitions = [field('multi_choice', {options}, 'Colors')];

      expect(applyFieldValues(definitions, {}, {f1: ['a', 'b', 'a']})).toEqual({f1: ['a', 'b']});
    });

    it('rejects an unknown id or a value that is not a list', () => {
      const definitions = [field('multi_choice', {options}, 'Colors')];

      expect(() => applyFieldValues(definitions, {}, {f1: ['a', 'zzz']})).toThrow('Colors must only contain its options');
      expect(() => applyFieldValues(definitions, {}, {f1: 'a'})).toThrow('Colors must only contain its options');
    });
  });

  describe('clearing and unknown ids', () => {
    it('removes a value when null or an empty string is sent', () => {
      const definitions = [field('text', {}, 'Title')];

      expect(applyFieldValues(definitions, {f1: 'old'}, {f1: null})).toEqual({});
      expect(applyFieldValues(definitions, {f1: 'old'}, {f1: ''})).toEqual({});
    });

    it('leaves a field alone when it is not in the request', () => {
      const definitions = [field('text', {}, 'Title')];

      expect(applyFieldValues(definitions, {f1: 'old'}, {})).toEqual({f1: 'old'});
    });

    it('ignores ids that the type does not have', () => {
      const definitions = [field('text', {}, 'Title')];

      expect(applyFieldValues(definitions, {}, {unknown: 'x', f1: 'ok'})).toEqual({f1: 'ok'});
    });

    it('keeps values that belong to fields of another type', () => {
      const definitions = [field('text', {}, 'Title')];

      expect(applyFieldValues(definitions, {hidden: 'kept'}, {f1: 'ok'})).toEqual({hidden: 'kept', f1: 'ok'});
    });

    it('does not change the object that was passed in', () => {
      const current = {f1: 'old'};

      applyFieldValues([field('text', {}, 'Title')], current, {f1: 'new'});

      expect(current).toEqual({f1: 'old'});
    });
  });
});
