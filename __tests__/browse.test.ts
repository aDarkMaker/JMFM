import {parseAlbumDetail, parseAlbumList, parseCategories} from '@/core/api/parse';
import {SORT, SORT_OPTIONS, SEARCH_SORT_OPTIONS, CATEGORY_FALLBACK} from '@/core/constants/sort';

describe('sort constants', () => {
  it('only exposes verified codes', () => {
    expect(SORT_OPTIONS.map((o) => o.code)).toEqual([
      SORT.DEFAULT,
      SORT.TODAY_HOT,
      SORT.WEEK_HOT,
      SORT.MONTH_HOT,
    ]);
  });

  it('marks the short daily hot feed', () => {
    expect(SORT_OPTIONS.filter((o) => o.shortFeed).map((o) => o.code)).toEqual([SORT.TODAY_HOT]);
  });

  it('exposes search sorts for time / views / likes / pages', () => {
    expect(SEARCH_SORT_OPTIONS.map((o) => o.code)).toEqual([
      SORT.LATEST,
      SORT.BY_VIEWS,
      SORT.BY_LIKES,
      SORT.BY_PAGES,
    ]);
  });

  it('fallback categories use slugs the API accepts', () => {
    expect(CATEGORY_FALLBACK.map((c) => c.slug)).toEqual([
      'doujin',
      'hanman',
      'meiman',
      'short',
      'single',
      'another',
    ]);
  });
});

describe('parseCategories', () => {
  const raw = {
    categories: [
      {
        id: '1',
        name: '同人',
        slug: 'doujin',
        type: 'slug',
        total_albums: '356702',
        sub_categories: [{CID: '1', name: '汉化', slug: 'chinese'}],
      },
      {id: '8', name: '3D', slug: '', type: 'slug', total_albums: '0', sub_categories: []},
      {id: '2', name: '', slug: 'broken'},
    ],
    blocks: [
      {title: '主题A漫', content: ['校园', '纯爱']},
      {title: '空组', content: []},
    ],
  };

  it('sorts categories by album count and drops nameless ones', () => {
    const {categories} = parseCategories(raw);
    expect(categories.map((c) => c.name)).toEqual(['同人', '3D']);
    expect(categories[0].totalAlbums).toBe(356702);
    expect(categories[0].subCategories).toEqual([{cid: '1', name: '汉化', slug: 'chinese'}]);
  });

  it('falls back to the numeric id when a category has no slug', () => {
    const {categories} = parseCategories(raw);
    expect(categories[0].slug).toBe('doujin');
    expect(categories[1].slug).toBe('8');
  });

  it('keeps only non-empty tag blocks', () => {
    const {blocks} = parseCategories(raw);
    expect(blocks).toEqual([{title: '主题A漫', tags: ['校园', '纯爱']}]);
  });

  it('trims and drops blank tags inside blocks', () => {
    const {blocks} = parseCategories({
      blocks: [{title: '主题', content: [' AI绘图 ', '', '  ', '全彩', '全彩']}],
    });
    expect(blocks).toEqual([{title: '主题', tags: ['AI绘图', '全彩']}]);
  });

  it('tolerates missing payload sections', () => {
    expect(parseCategories({})).toEqual({categories: [], blocks: []});
  });
});

describe('parseAlbumList stats', () => {
  it('reads stats and category id when present', () => {
    const {albums} = parseAlbumList({
      content: [
        {
          id: '553653',
          name: '强制催眠',
          author: ['A', 'B'],
          category: {id: '5', title: '韩漫'},
          likes: '91816',
          total_views: '646760',
          total_photos: '24675',
          update_at: 1794011920,
        },
      ],
      total: 1,
    });
    expect(albums[0]).toMatchObject({
      albumId: 553653,
      author: 'A, B',
      category: '韩漫',
      categoryId: '5',
      likesCount: 91816,
      viewsCount: 646760,
      pageCount: 24675,
      updateAt: 1794011920_000,
    });
  });

  it('leaves stats undefined when the feed omits them', () => {
    const {albums} = parseAlbumList({content: [{id: 1, name: 'x'}]});
    expect(albums[0].likesCount).toBeUndefined();
    expect(albums[0].categoryId).toBeUndefined();
  });
});

describe('parseAlbumDetail extras', () => {
  it('parses stats, tags and related albums', () => {
    const detail = parseAlbumDetail({
      id: 1488996,
      name: '本子',
      tags: ['巨乳', '中文'],
      works: ['Fate'],
      actors: ['セイバー', ''],
      likes: 91816,
      total_views: 646760,
      total_photos: 24675,
      comment_total: 731,
      category: {title: '同人'},
      series: [{id: '1', sort: '1', name: '第一话'}],
      related_list: [
        {id: '447', name: '相关A', author: '作者A'},
        {id: 'bad', name: '无效'},
      ],
    });
    expect(detail).toMatchObject({
      albumId: 1488996,
      tags: ['巨乳', '中文'],
      works: ['Fate'],
      actors: ['セイバー'],
      authors: [],
      likesCount: 91816,
      viewsCount: 646760,
      pageCount: 24675,
      commentCount: 731,
      category: '同人',
    });
    expect(detail.related.map((a) => a.albumId)).toEqual([447]);
    expect(detail.related[0].coverUrl).toContain('/media/albums/447_3x4.jpg');
  });

  it('degrades to a single synthetic episode and empty related', () => {
    const detail = parseAlbumDetail({id: 7, name: '单话'});
    expect(detail.episodes).toEqual([{photoId: 7, sort: 1, name: '单话'}]);
    expect(detail.related).toEqual([]);
    expect(detail.works).toEqual([]);
    expect(detail.actors).toEqual([]);
  });

  it('does not treat works array as description', () => {
    const detail = parseAlbumDetail({
      id: 1,
      name: 'x',
      works: ['作品A'],
      description: '',
    });
    expect(detail.description).toBe('');
    expect(detail.works).toEqual(['作品A']);
  });

  it('parses author/works/actors lists and addtime', () => {
    const detail = parseAlbumDetail({
      id: 410090,
      name: '原神本',
      author: ['うぱ西', ''],
      tags: ['巨乳', '中文'],
      works: ['原神', 'Genshin'],
      actors: ['申鹤', '神里绫华', '甘雨'],
      addtime: '1672854561',
      description: '',
    });
    expect(detail.authors).toEqual(['うぱ西']);
    expect(detail.author).toBe('うぱ西');
    expect(detail.works).toEqual(['原神', 'Genshin']);
    expect(detail.actors).toEqual(['申鹤', '神里绫华', '甘雨']);
    expect(detail.updateAt).toBe(1672854561 * 1000);
  });

  it('dedupes related by id, near-title, and excludes self', () => {
    const detail = parseAlbumDetail({
      id: 16949,
      name: '(C91) [The Dungeon In Yarn (与根金次)] マイクロビキニで海に行ったらおじさんたちにれいぷ(和姦)してもらえちゃった女の子の本',
      related_list: [
        {
          id: '16949',
          name: '(C91) [The Dungeon In Yarn (与根金次)] マイクロビキニで海に行ったらおじさんたちにれいぷ(和姦)してもらえちゃった女の子の本',
        },
        {
          id: '21313',
          name: '(C91) [The Dungeon in Yarn (与根金次)] マイクロビキニで海に行ったらおじさんたちにれい(和姦)してもらえちゃった女の子の本 [DL版]',
        },
        {id: '447', name: '相关A', author: '作者A'},
        {id: '447', name: '相关A 重复 id'},
        {id: '7121', name: '[The Dungeon In Yarn(与根金次)][こうかん☆にっき]'},
      ],
    });
    expect(detail.related.map((a) => a.albumId)).toEqual([447, 7121]);
  });
});
