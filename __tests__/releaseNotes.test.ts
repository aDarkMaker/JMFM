/** Guards the manifest `notes` parser used by the update dialogs. */
import {parseNotes} from '@/web/features/update/notes';

describe('parseNotes', () => {
  it('returns no blocks for empty input', () => {
    expect(parseNotes('')).toEqual([]);
    expect(parseNotes(null)).toEqual([]);
    expect(parseNotes('  \n \n')).toEqual([]);
  });

  it('splits headings, bullets and prose lines', () => {
    const blocks = parseNotes('## 修复\n- 首页推荐\n- 搜索\n\n普通说明');
    expect(blocks).toEqual([
      {kind: 'heading', text: '修复'},
      {kind: 'bullet', text: '首页推荐'},
      {kind: 'bullet', text: '搜索'},
      {kind: 'text', text: '普通说明'},
    ]);
  });

  it('accepts ordered lists and strips inline emphasis', () => {
    const blocks = parseNotes('1. **性能**\n2. `构建`');
    expect(blocks).toEqual([
      {kind: 'bullet', text: '性能'},
      {kind: 'bullet', text: '构建'},
    ]);
  });
});
