export const MEDICINE_TYPES = [
  'Rice Powder',
  'Jaggery',
  'Yeast',
  'Probiotics',
  'EDTA',
  'Mineral',
  'Oxygen Supplement',
  'White Gut Supplement',
  'Bleaching',
  'Gas Tablets',
  'Meothrin',
  'PVC Lime',
  'PP',
  'Teaseed Cake',
  'Decomposer',
  'Other',
];

export const MEDICINE_TYPE_OPTIONS = MEDICINE_TYPES.map((type) => ({
  value: type,
  label: type,
}));

export const LEGACY_MEDICINE_TYPES = [
  'White Cul Supplement',
];

export const ALL_VALID_MEDICINE_TYPES = [
  ...MEDICINE_TYPES,
  ...LEGACY_MEDICINE_TYPES,
];

export const normalizeMedicineType = (type) => {
  if (type === 'White Cul Supplement') return 'White Gut Supplement';
  return type;
};
