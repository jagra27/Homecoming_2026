const assetPath = (fileName) => `${import.meta.env.BASE_URL}assets/${fileName}`

export const schools = [
  {
    id: 'bsu',
    abbreviation: 'BSU',
    name: 'Bowie State University',
    number: '161',
    colors: ['#ffc72c', '#000000'],
    cardCanvas: assetPath('BSU_CARD_CANVAS.png'),
    storyCanvas: assetPath('BSU_IG_STORY.png'),
  },
  {
    id: 'hu',
    abbreviation: 'HU',
    name: 'Howard University',
    number: '159',
    colors: ['#003a63', '#e51937'],
    cardCanvas: assetPath('HU_CARD_CANVAS.png'),
    storyCanvas: assetPath('HU_IG_STORY.png'),
  },
  {
    id: 'msu',
    abbreviation: 'MSU',
    name: 'Morgan State University',
    number: '159',
    colors: ['#ff6f00', '#003da5'],
    cardCanvas: assetPath('MSU_CARD_CANVAS.png'),
    storyCanvas: assetPath('MSU_IG_STORY.png'),
  },
  {
    id: 'csu',
    abbreviation: 'CSU',
    name: 'Coppin State University',
    number: '126',
    colors: ['#fdb927', '#003da5'],
    cardCanvas: assetPath('CSU_CARD_CANVAS.png'),
    storyCanvas: assetPath('CSU_IG_STORY.png'),
  },
]