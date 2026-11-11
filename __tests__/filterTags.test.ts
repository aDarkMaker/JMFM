import {
  removeFilterTag,
  setFilterTag,
  suggestFilterTags,
  validateTagInput,
} from '@/web/library/filterTags';

describe('validateTagInput', () => {
  it('trims and accepts valid tags', () => {
    expect(validateTagInput('  校园  ', [])).toEqual({ok: true, tag: '校园'});
  });

  it('rejects empty input', () => {
    expect(validateTagInput('  ', [])).toEqual({ok: false, reason: 'empty'});
  });

  it('rejects hard-blocked keywords', () => {
    expect(validateTagInput('AI绘图', [])).toEqual({ok: false, reason: 'blocked'});
  });

  it('rejects case-insensitive duplicates', () => {
    expect(validateTagInput('NTR', ['ntr'])).toEqual({ok: false, reason: 'duplicate'});
  });
});

describe('setFilterTag', () => {
  it('appends to the target list', () => {
    expect(setFilterTag({blacklistTags: ['a'], whitelistTags: []}, 'b', 'blacklist')).toEqual({
      blacklistTags: ['a', 'b'],
      whitelistTags: [],
    });
  });

  it('moves a tag out of the other list', () => {
    expect(setFilterTag({blacklistTags: ['a'], whitelistTags: ['b']}, 'a', 'whitelist')).toEqual({
      blacklistTags: [],
      whitelistTags: ['b', 'a'],
    });
  });

  it('keeps the stored spelling when re-adding in the same list', () => {
    expect(setFilterTag({blacklistTags: ['校园'], whitelistTags: []}, '校园', 'blacklist')).toEqual({
      blacklistTags: ['校园'],
      whitelistTags: [],
    });
  });

  it('moves case-insensitively without duplicating', () => {
    expect(setFilterTag({blacklistTags: ['NTR'], whitelistTags: []}, 'ntr', 'whitelist')).toEqual({
      blacklistTags: [],
      whitelistTags: ['ntr'],
    });
  });
});

describe('removeFilterTag', () => {
  it('only touches the given list', () => {
    const lists = {blacklistTags: ['a'], whitelistTags: ['b']};
    expect(removeFilterTag(lists, 'a', 'blacklist')).toEqual({blacklistTags: [], whitelistTags: ['b']});
    expect(removeFilterTag(lists, 'b', 'whitelist')).toEqual({blacklistTags: ['a'], whitelistTags: []});
  });
});

describe('suggestFilterTags', () => {
  const items = [
    {tags: ['校园', '纯爱', '中文']},
    {tags: ['校园', '搞笑']},
    {tags: ['校园', '纯爱']},
  ];

  it('excludes language tags and existing entries', () => {
    const suggestions = suggestFilterTags(items, ['纯爱'], 8);
    expect(suggestions).toEqual(['校园', '搞笑']);
  });

  it('excludes entries from either list', () => {
    expect(suggestFilterTags(items, ['校园', '搞笑'], 8)).toEqual(['纯爱']);
  });

  it('respects the limit', () => {
    const suggestions = suggestFilterTags(items, [], 1);
    expect(suggestions).toEqual(['校园']);
  });

  it('returns empty when everything is already listed', () => {
    expect(suggestFilterTags(items, ['校园', '纯爱', '搞笑'], 8)).toEqual([]);
  });
});
