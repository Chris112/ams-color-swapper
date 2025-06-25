export interface ExampleFile {
  name: string;
  filename: string;
  description: string;
  colors: number;
  size: string;
  modelUrl: string;
  imageUrl?: string;
  placeholderColor: string;
  author: string;
  authorUrl?: string;
}

export const EXAMPLE_FILES: ExampleFile[] = [
  {
    name: '4 Color Slowpoke',
    filename: '4_color_Slowpoke.gcode',
    description: 'Multi-color Pokémon print with 4 different filaments',
    colors: 4,
    size: 'Medium',
    modelUrl: 'https://makerworld.com/en/models/545413-slowpoke-multicolor',
    imageUrl:
      'https://makerworld.bblmw.com/makerworld/model/US465b70652cb5d4/design/2024-07-17_5d173df969058.jpg?x-oss-process=image/resize,w_1920/format,webp',
    placeholderColor: '#FF69B4', // Pink for Slowpoke
    author: 'entroisdimensions_figurine',
    authorUrl: 'https://makerworld.com/en/@etd_figurine',
  },
  {
    name: '5 Color Squirtle',
    filename: '5 colour Squirtle.gcode',
    description: 'Detailed Squirtle model using 5 colors',
    colors: 5,
    size: 'Medium',
    modelUrl:
      'https://makerworld.com/en/models/449109-5-color-squirtle-using-1-ams-swap-spool-at-pause',
    imageUrl:
      'https://makerworld.bblmw.com/makerworld/model/US24e0d70bc660da/design/2024-04-30_1646984342781.jpg?x-oss-process=image/resize,w_1920/format,webp',
    placeholderColor: '#5DADE2', // Blue for Squirtle
    author: 'KillaPrintzilla',
    authorUrl: 'https://makerworld.com/en/@KillaPrintzilla',
  },
  {
    name: '6 Color Slowbro',
    filename: '6_color_Slowbro.gcode',
    description: 'Complex Slowbro print with 6 different colors',
    colors: 6,
    size: 'Large',
    modelUrl:
      'https://makerworld.com/en/models/545414-slowbro-multicolor?from=search#profileId-463225',
    imageUrl:
      'https://makerworld.bblmw.com/makerworld/model/US727abe6d057050/design/2024-07-17_a7f32dfb72ba8.jpg?x-oss-process=image/resize,w_1920/format,webp',
    placeholderColor: '#FFB6C1', // Light pink for Slowbro
    author: 'entroisdimensions_figurine',
    authorUrl: 'https://makerworld.com/en/@etd_figurine',
  },
  {
    name: '6 Color Slowking',
    filename: '6_color_Slowking.gcode',
    description: 'Advanced Slowking model with maximum color complexity',
    colors: 6,
    size: 'Large',
    modelUrl: 'https://makerworld.com/en/models/1364313-slowking-multicolor',
    imageUrl:
      'https://makerworld.bblmw.com/makerworld/model/UScd76ec97483a3/design/2025-04-28_ba079bdaab968.jpg?x-oss-process=image/resize,w_1920/format,webp',
    placeholderColor: '#DDA0DD', // Plum for Slowking
    author: 'entroisdimensions_figurine',
    authorUrl: 'https://makerworld.com/en/@etd_figurine',
  },
  {
    name: '5 Color Blastoise',
    filename: '5 colour Blastoise.gcode',
    description: 'Powerful Blastoise model with detailed water cannons',
    colors: 5,
    size: 'Large',
    modelUrl: 'https://makerworld.com/en/models/188184-blastoise-multicolor',
    imageUrl:
      'https://makerworld.bblmw.com/makerworld/model/USa1b804ee27db7f/design/2024-02-16_0d7715b42d73a.jpg?x-oss-process=image/resize,w_1920/format,webp',
    placeholderColor: '#4682B4', // Steel blue for Blastoise
    author: 'entroisdimensions_figurine',
    authorUrl: 'https://makerworld.com/en/@etd_figurine',
  },
  {
    name: '7 Color Venusaur',
    filename: '7 colour Venusaur.gcode',
    description: 'Complex Venusaur model with 7 colors - perfect for testing manual swaps',
    colors: 7,
    size: 'Extra Large',
    modelUrl: 'https://makerworld.com/en/models/172862-venusaur-multicolor',
    imageUrl:
      'https://makerworld.bblmw.com/makerworld/model/USc7c82e3aa2c50b/design/2024-02-02_190f23cd4d3e7.jpg?x-oss-process=image/resize,w_1920/format,webp',
    placeholderColor: '#00CED1', // Arctic Teal for Venusaur
    author: 'entroisdimensions_figurine',
    authorUrl: 'https://makerworld.com/en/@etd_figurine',
  },
];
