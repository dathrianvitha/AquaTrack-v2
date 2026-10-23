export const OTHER_STOCK_CATEGORIES = [
  "Water Pumping Motor",
  "Aerators",
  "Generators",
  "Rig Bore",
  "Small Bore",
  "Extra Gear Box & Motors",
  "Spare Parts",
  "Other"
];

export const LEGACY_OTHER_STOCK_CATEGORIES = [
  "Motors"
];

export const ALL_VALID_OTHER_STOCK_CATEGORIES = [
  ...OTHER_STOCK_CATEGORIES,
  ...LEGACY_OTHER_STOCK_CATEGORIES
];

export const OTHER_STOCK_SUBCATEGORIES = {
  "Water Pumping Motor": [
    "2HP Motor",
    "5HP Motor",
    "7.5HP Motor"
  ],
  "Motors": [
    "2HP Motor",
    "5HP Motor",
    "7.5HP Motor"
  ],
  "Aerators": [
    "Long Arm Aerators",
    "2HP Short Aerators"
  ],
  "Generators": [
    "60KV",
    "125KV",
    "165KV",
    "180KV",
    "250KV"
  ],
  "Rig Bore": [
    "7.5HP",
    "10HP",
    "15HP"
  ],
  "Small Bore": [
    "3HP",
    "5HP"
  ]
};

export const normalizeOtherStockCategory = (category) => {
  if (!category) return category;
  if (category.trim().toLowerCase() === "motors") {
    return "Water Pumping Motor";
  }
  return category;
};
