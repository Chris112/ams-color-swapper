// Basic color palette - only essential colors for fallback when FilamentDatabase unavailable
const COLOR_NAMES: Record<string, string> = {
  '#000000': 'Black',
  '#FFFFFF': 'White',
  '#FF0000': 'Red',
  '#00FF00': 'Green',
  '#0000FF': 'Blue',
  '#FFFF00': 'Yellow',
  '#FF00FF': 'Magenta',
  '#00FFFF': 'Cyan',
  '#FFA500': 'Orange',
  '#800080': 'Purple',
  '#FFC0CB': 'Pink',
  '#A52A2A': 'Brown',
  '#808080': 'Gray',
  '#C0C0C0': 'Silver',
  '#FFD700': 'Gold',
};

// Get basic color name for fallback - only exact matches, no fuzzy matching
export function getColorName(hex: string): string {
  // Only return exact matches for basic colors
  const upperHex = hex.toUpperCase();
  if (COLOR_NAMES[upperHex]) {
    return COLOR_NAMES[upperHex];
  }

  // No fuzzy matching - return original hex
  // This encourages reliance on FilamentDatabase for accurate names
  return hex;
}

// Helper function to format color display
export function formatColorDisplay(hexColor: string | undefined, colorIdOrName: string): string {
  if (!hexColor) {
    return colorIdOrName;
  }

  // First check if the provided name is already meaningful (enhanced from FilamentDatabase)
  // Don't re-resolve color names that are already enhanced with manufacturer info
  if (
    colorIdOrName &&
    !colorIdOrName.match(/^(Color \d+|T\d+|#[0-9A-Fa-f]{6})/) && // Not generic patterns
    !colorIdOrName.includes('Unused') &&
    colorIdOrName.length > 3 // Not just basic color names like "Red"
  ) {
    return colorIdOrName;
  }

  // Only fallback to basic color resolution if we have a generic name
  const colorName = getColorName(hexColor);

  // If we have an exact basic color match, use it
  if (colorName !== hexColor) {
    return colorName;
  }

  // Otherwise return the original
  return colorIdOrName;
}
