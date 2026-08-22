export interface MockAlbum {
  albumId: number;
  title: string;
  author: string;
  tags: string[];
  chapterCount: number;
  coverColor: string;
}

export const dailyRecommendations: MockAlbum[] = [
  {
    albumId: 1327951,
    title: '放学后的秘密',
    author: '某杂志社',
    tags: ['校园', '青春'],
    chapterCount: 12,
    coverColor: '#e8d5c0',
  },
  {
    albumId: 1327952,
    title: '星空下的约定',
    author: '画室出品',
    tags: ['治愈', '日常'],
    chapterCount: 8,
    coverColor: '#d0dbe8',
  },
  {
    albumId: 1327953,
    title: '深夜食堂物语',
    author: '深夜工房',
    tags: ['美食', '温情'],
    chapterCount: 6,
    coverColor: '#e8d0c8',
  },
  {
    albumId: 1327954,
    title: '雨后的城市',
    author: '某某工作室',
    tags: ['都市', '剧情'],
    chapterCount: 15,
    coverColor: '#c8d8e0',
  },
  {
    albumId: 1327955,
    title: '春日限定',
    author: '花见小组',
    tags: ['恋爱', '青春'],
    chapterCount: 10,
    coverColor: '#e8d8d0',
  },
  {
    albumId: 1327956,
    title: '山间旅人',
    author: '远行社',
    tags: ['冒险', '自然'],
    chapterCount: 9,
    coverColor: '#d8e0c8',
  },
];
