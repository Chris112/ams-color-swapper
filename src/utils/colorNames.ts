// Basic color palette with common color names
const COLOR_NAMES: Record<string, string> = {
  '#000000': 'Black',
  '#FFFFFF': 'White',
  '#FF0000': 'Red',
  '#00FF00': 'Lime',
  '#0000FF': 'Blue',
  '#FFFF00': 'Yellow',
  '#FF00FF': 'Magenta',
  '#00FFFF': 'Cyan',
  '#FFA500': 'Orange',
  '#800080': 'Purple',
  '#FFC0CB': 'Pink',
  '#A52A2A': 'Brown',
  '#808080': 'Gray',
  '#008000': 'Green',
  '#000080': 'Navy',
  '#808000': 'Olive',
  '#800000': 'Maroon',
  '#008080': 'Teal',
  '#C0C0C0': 'Silver',
  '#FFD700': 'Gold',
  '#FF6347': 'Tomato',
  '#4B0082': 'Indigo',
  '#EE82EE': 'Violet',
  '#F0E68C': 'Khaki',
  '#E6E6FA': 'Lavender',
  '#FF69B4': 'Hot Pink',
  '#00CED1': 'Dark Turquoise',
  '#DC143C': 'Crimson',
  '#00FA9A': 'Medium Spring Green',
  '#F5DEB3': 'Wheat',
  '#FFDAB9': 'Peach Puff',
  '#98FB98': 'Pale Green',
  '#AFEEEE': 'Pale Turquoise',
  '#FFE4E1': 'Misty Rose',
  '#FAEBD7': 'Antique White',
  '#F5F5DC': 'Beige',
  '#2F4F4F': 'Dark Slate Gray',
  '#696969': 'Dim Gray',
  '#708090': 'Slate Gray',
  '#778899': 'Light Slate Gray',
  '#B0C4DE': 'Light Steel Blue',
  '#4169E1': 'Royal Blue',
  '#1E90FF': 'Dodger Blue',
  '#6495ED': 'Cornflower Blue',
  '#87CEEB': 'Sky Blue',
  '#87CEFA': 'Light Sky Blue',
  '#00BFFF': 'Deep Sky Blue',
  '#5F9EA0': 'Cadet Blue',
  '#B0E0E6': 'Powder Blue',
  '#ADD8E6': 'Light Blue',
  '#20B2AA': 'Light Sea Green',
  '#48D1CC': 'Medium Turquoise',
  '#40E0D0': 'Turquoise',
  '#7FFFD4': 'Aquamarine',
  '#66CDAA': 'Medium Aquamarine',
  '#3CB371': 'Medium Sea Green',
  '#2E8B57': 'Sea Green',
  '#228B22': 'Forest Green',
  '#32CD32': 'Lime Green',
  '#90EE90': 'Light Green',
  '#00FF7F': 'Spring Green',
  '#7CFC00': 'Lawn Green',
  '#7FFF00': 'Chartreuse',
  '#ADFF2F': 'Green Yellow',
  '#9ACD32': 'Yellow Green',
  '#6B8E23': 'Olive Drab',
  '#556B2F': 'Dark Olive Green',
  '#8FBC8F': 'Dark Sea Green',
  '#FF8C00': 'Dark Orange',
  '#FF7F50': 'Coral',
  '#F08080': 'Light Coral',
  '#FA8072': 'Salmon',
  '#E9967A': 'Dark Salmon',
  '#FFA07A': 'Light Salmon',
  '#FF4500': 'Orange Red',
  '#B22222': 'Fire Brick',
  '#8B0000': 'Dark Red',
  '#CD5C5C': 'Indian Red',
  '#F5F5F5': 'White Smoke',
  '#DCDCDC': 'Gainsboro',
  '#D3D3D3': 'Light Gray',
  '#A9A9A9': 'Dark Gray',
  '#FF1493': 'Deep Pink',
  '#C71585': 'Medium Violet Red',
  '#DB7093': 'Pale Violet Red',
  '#DDA0DD': 'Plum',
  '#D8BFD8': 'Thistle',
  '#DA70D6': 'Orchid',
  '#BA55D3': 'Medium Orchid',
  '#9932CC': 'Dark Orchid',
  '#9400D3': 'Dark Violet',
  '#8B008B': 'Dark Magenta',
  '#9370DB': 'Medium Purple',
  '#7B68EE': 'Medium Slate Blue',
  '#6A5ACD': 'Slate Blue',
  '#483D8B': 'Dark Slate Blue',
  '#663399': 'Rebecca Purple',
  '#F0F8FF': 'Alice Blue',
  '#F0FFFF': 'Azure',
  '#F5FFFA': 'Mint Cream',
  '#F0FFF0': 'Honeydew',
  '#FFFFF0': 'Ivory',
  '#FFFAF0': 'Floral White',
  '#FAF0E6': 'Linen',
  '#FDF5E6': 'Old Lace',
  '#FFEFD5': 'Papaya Whip',
  '#FFE4B5': 'Moccasin',
  '#FFDEAD': 'Navajo White',
  '#FFEBCD': 'Blanched Almond',
  '#FFE4C4': 'Bisque',
  '#F4A460': 'Sandy Brown',
  '#DEB887': 'Burly Wood',
  '#D2B48C': 'Tan',
  '#BC8F8F': 'Rosy Brown',
  '#CD853F': 'Peru',
  '#D2691E': 'Chocolate',
  '#8B4513': 'Saddle Brown',
  '#A0522D': 'Sienna',
};

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Calculate color distance using Euclidean distance in RGB space
function colorDistance(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Get approximate color name for any hex color
export function getColorName(hex: string): string {
  // First check if we have an exact match
  const upperHex = hex.toUpperCase();
  if (COLOR_NAMES[upperHex]) {
    return COLOR_NAMES[upperHex];
  }

  // Convert input hex to RGB
  const inputRgb = hexToRgb(hex);
  if (!inputRgb) {
    return hex; // Return original hex if invalid
  }

  // Find the closest color
  let closestColor = '';
  let minDistance = Infinity;

  for (const [colorHex, colorName] of Object.entries(COLOR_NAMES)) {
    const colorRgb = hexToRgb(colorHex);
    if (!colorRgb) continue;

    const distance = colorDistance(inputRgb, colorRgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = colorName;
    }
  }

  // If the color is very close to a named color, just use the name
  // Otherwise, add a modifier to indicate it's approximate
  if (minDistance < 20) {
    return closestColor;
  } else if (minDistance < 50) {
    return `${closestColor}-ish`;
  } else {
    // For colors that are quite different, describe them more generically
    const { r, g, b } = inputRgb;

    // Determine if it's more light or dark
    const brightness = (r + g + b) / 3;
    const prefix = brightness > 200 ? 'Light' : brightness < 55 ? 'Dark' : '';

    // Determine dominant color channel
    if (r > g && r > b) {
      return `${prefix} ${r > 200 && g < 100 && b < 100 ? 'Red' : 'Reddish'}`.trim();
    } else if (g > r && g > b) {
      return `${prefix} ${g > 200 && r < 100 && b < 100 ? 'Green' : 'Greenish'}`.trim();
    } else if (b > r && b > g) {
      return `${prefix} ${b > 200 && r < 100 && g < 100 ? 'Blue' : 'Bluish'}`.trim();
    } else if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20) {
      // Grayscale
      if (brightness > 230) return 'Near White';
      if (brightness < 25) return 'Near Black';
      return 'Gray';
    } else {
      return `${prefix} ${closestColor}-ish`.trim();
    }
  }
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

  // If we have a good color name (not generic), use it
  if (
    colorName !== hexColor &&
    !colorName.includes('-ish') &&
    !colorName.includes('Near') &&
    !colorName.includes('Reddish') &&
    !colorName.includes('Greenish') &&
    !colorName.includes('Bluish')
  ) {
    return colorName;
  }

  // If the provided name is generic like "Color 1", try to use a better approximation
  if (colorIdOrName.match(/^Color \d+/)) {
    // Even if it's an approximation, return it if we have one
    if (colorName !== hexColor) {
      return colorName;
    }
  }

  // Otherwise return the original
  return colorIdOrName;
}
