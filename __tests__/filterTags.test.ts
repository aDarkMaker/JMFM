import {suggestFilterTags, validateTagInput} from '@/web/library/filterTags';

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

  it('respects the limit', () => {
    const suggestions = suggestFilterTags(items, [], 1);
    expect(suggestions).toEqual(['校园']);
  });

  it('returns empty when everything is already listed', () => {
    expect(suggestFilterTags(items, ['校园', '纯爱', '搞笑'], 8)).toEqual([]);
  });
});
