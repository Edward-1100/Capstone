export const FIELD_TYPE_LABELS = {
  text: 'Text',
  long_text: 'Long text',
  number: 'Number',
  boolean: 'Yes/no',
  scale: 'Scale',
  choice: 'Choice',
  multi_choice: 'Multiple choice',
};

export function scaleSteps(config) {
  const steps = [];

  for (let step = config.min; step <= config.max; step += 1) {
    steps.push(step);
  }

  return steps;
}

export function stepLabel(config, step) {
  const name = config.labels && config.labels[String(step)];

  return name ? `${step} - ${name}` : String(step);
}

export function optionLabel(config, optionId) {
  const option = (config.options || []).find((item) => item.id === optionId);

  return option ? option.label : '';
}

export function formatValue(definition, value) {
  const config = definition.config || {};

  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (definition.fieldType === 'boolean') {
    return value ? config.trueLabel : config.falseLabel;
  }

  if (definition.fieldType === 'scale') {
    const name = config.labels && config.labels[String(value)];

    return name ? `${name} (${value})` : String(value);
  }

  if (definition.fieldType === 'choice') {
    return optionLabel(config, value);
  }

  if (definition.fieldType === 'multi_choice') {
    return value.map((optionId) => optionLabel(config, optionId)).filter((label) => label).join(', ');
  }

  return String(value);
}

export function describeField(field) {
  const config = field.config || {};

  if (field.fieldType === 'boolean') {
    return `Yes/no (${config.trueLabel} or ${config.falseLabel})`;
  }

  if (field.fieldType === 'scale') {
    return `Scale from ${config.min} to ${config.max}`;
  }

  if (field.fieldType === 'choice' || field.fieldType === 'multi_choice') {
    return `${FIELD_TYPE_LABELS[field.fieldType]} (${(config.options || []).length} options)`;
  }

  return FIELD_TYPE_LABELS[field.fieldType];
}
