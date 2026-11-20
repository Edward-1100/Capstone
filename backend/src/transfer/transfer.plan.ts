import { BadRequestException } from '@nestjs/common';
import { CATEGORIES, Category, Selection, readSelection } from './transfer.manifest';

export type Action = 'keep' | 'replace' | 'rename';

export interface Resolution {
  action: Action;
  name: string;
}

export interface ImportOptions {
  images: boolean;
  comments: boolean;
  notes: boolean;
}

export interface ImportPlan {
  world: {name: string; description: string};
  options: ImportOptions;
  select: Selection;
  resolutions: Record<Category, Record<string, Resolution>>;
}

const ACTIONS = ['keep', 'replace', 'rename'];

export function readPlan(raw: string | undefined): ImportPlan {
  let input: any;

  try {
    input = JSON.parse(raw ?? '');
  } catch {
    throw new BadRequestException('The import choices are not valid');
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('The import choices are not valid');
  }

  const world = input.world && typeof input.world === 'object' ? input.world : {};
  const options = input.options && typeof input.options === 'object' ? input.options : {};
  const resolutions = {} as Record<Category, Record<string, Resolution>>;

  for (const category of CATEGORIES) {
    resolutions[category] = {};

    const source = input.resolutions && typeof input.resolutions === 'object' ? input.resolutions[category] : null;

    if (!source || typeof source !== 'object') {
      continue;
    }

    for (const ref of Object.keys(source)) {
      const item = source[ref];

      if (item && typeof item === 'object' && ACTIONS.includes(item.action)) {
        resolutions[category][ref] = {action: item.action, name: typeof item.name === 'string' ? item.name.trim() : ''};
      }
    }
  }

  return {
    world: {name: typeof world.name === 'string' ? world.name.trim() : '', description: typeof world.description === 'string' ? world.description : ''},
    options: {images: options.images === true, comments: options.comments === true, notes: options.notes === true},
    select: readSelection(input.select),
    resolutions,
  };
}
