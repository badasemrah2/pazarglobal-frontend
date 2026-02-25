export const normalizePhoneTR = (input: string): string | null => {
  if (!input) return null;
  let value = input.trim();
  if (!value) return null;

  // digits only
  value = value.replace(/\D/g, '');
  if (!value) return null;

  // trim leading 0
  if (value.startsWith('0')) {
    value = value.slice(1);
  }

  // ensure country code 90
  if (!value.startsWith('90')) {
    value = `90${value}`;
  }

  return `+${value}`;
};
