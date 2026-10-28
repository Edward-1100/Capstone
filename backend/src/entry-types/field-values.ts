import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const FIELD_TYPES = ['text', 'long_text', 'number', 'boolean', 'scale', 'choice', 'multi_choice'];
export const MAX_FIELDS = 33;

const MAX_TEXT = 500;
const MAX_LONG_TEXT = 20000;
const MAX_STEPS = 100;
const MAX_OPTIONS = 50;
const MAX_LABEL = 50;

function cleanLabel(value: any, what: string) {
  const label = typeof value === 'string' ? value.trim() : '';

  if (!label || label.length > MAX_LABEL) {
    throw new BadRequestException(`${what} must be 1 to ${MAX_LABEL} characters`);
  }

  return label;
}

export function normalizeConfig(fieldType: string, config: any, existing?: any) {
  const input = config ?? {};
  const base = existing ?? {};

  if (fieldType === 'boolean') {
    const trueLabel = cleanLabel(input.trueLabel ?? base.trueLabel ?? 'Yes', 'Option name');
    const falseLabel = cleanLabel(input.falseLabel ?? base.falseLabel ?? 'No', 'Option name');

    if (trueLabel.toLowerCase() === falseLabel.toLowerCase()) {
      throw new BadRequestException('Option names must be different');
    }

    return {trueLabel, falseLabel};
  }

  if (fieldType === 'scale') {
    const min = input.min ?? base.min;
    const max = input.max ?? base.max;

    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new BadRequestException('A scale needs a whole number minimum and maximum');
    }

    if (min >= max) {
      throw new BadRequestException('Scale minimum must be lower than maximum');
    }

    if (max - min + 1 > MAX_STEPS) {
      throw new BadRequestException(`A scale can have up to ${MAX_STEPS} steps`);
    }

    const rawLabels = input.labels ?? base.labels ?? {};
    const labels: Record<string, string> = {};

    for (const key of Object.keys(rawLabels)) {
      const step = Number(key);
      const label = typeof rawLabels[key] === 'string' ? rawLabels[key].trim() : '';

      if (Number.isInteger(step) && step >= min && step <= max && label) {
        labels[String(step)] = cleanLabel(label, 'Step name');
      }
    }

    return {min, max, labels};
  }

  if (fieldType === 'choice' || fieldType === 'multi_choice') {
    const raw = input.options ?? base.options;

    if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_OPTIONS) {
      throw new BadRequestException(`Add 1 to ${MAX_OPTIONS} options`);
    }

    const known = new Set((base.options ?? []).map((option: any) => option.id));
    const usedIds = new Set<string>();
    const usedLabels = new Set<string>();

    const options = raw.map((option: any) => {
      const label = cleanLabel(option?.label, 'Option name');

      if (usedLabels.has(label.toLowerCase())) {
        throw new BadRequestException('Option names must be different');
      }

      usedLabels.add(label.toLowerCase());

      const keep = typeof option?.id === 'string' && known.has(option.id) && !usedIds.has(option.id);
      const id = keep ? option.id : randomUUID();

      usedIds.add(id);

      return {id, label};
    });

    return {options};
  }

  return {};
}

function checkValue(definition: any, value: any) {
  const name = definition.name;
  const config = definition.config ?? {};

  if (definition.fieldType === 'text' || definition.fieldType === 'long_text') {
    const limit = definition.fieldType === 'text' ? MAX_TEXT : MAX_LONG_TEXT;

    if (typeof value !== 'string') {
      throw new BadRequestException(`${name} must be text`);
    }

    if (value.length > limit) {
      throw new BadRequestException(`${name} can only be up to ${limit} characters`);
    }

    return value;
  }

  if (definition.fieldType === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`${name} must be a number`);
    }

    return value;
  }

  if (definition.fieldType === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${name} must be ${config.trueLabel} or ${config.falseLabel}`);
    }

    return value;
  }

  if (definition.fieldType === 'scale') {
    if (!Number.isInteger(value) || value < config.min || value > config.max) {
      throw new BadRequestException(`${name} must be a whole number from ${config.min} to ${config.max}`);
    }

    return value;
  }

  const ids = (config.options ?? []).map((option: any) => option.id);

  if (definition.fieldType === 'choice') {
    if (typeof value !== 'string' || !ids.includes(value)) {
      throw new BadRequestException(`${name} must be one of its options`);
    }

    return value;
  }

  if (definition.fieldType === 'multi_choice') {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !ids.includes(item))) {
      throw new BadRequestException(`${name} must only contain its options`);
    }

    return Array.from(new Set(value));
  }

  throw new BadRequestException(`${name} has an unknown field type`);
}

export function applyFieldValues(definitions: any[], current: Record<string, any>, incoming: Record<string, any>) {
  const result = Object.assign({}, current);

  for (const definition of definitions) {
    if (!(definition.id in incoming)) {
      continue;
    }

    const value = incoming[definition.id];

    if (value === null || value === '') {
      delete result[definition.id];

      continue;
    }

    if (JSON.stringify(value) === JSON.stringify(current[definition.id])) {
      continue;
    }

    result[definition.id] = checkValue(definition, value);
  }

  return result;
}
