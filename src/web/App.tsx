import {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {gsap} from 'gsap';
import {Icon} from './components/Icon';
import {HomeScreen} from './screens/HomeScreen';
import {LibraryScreen} from './screens/LibraryScreen';
import {TasksScreen} from './screens/TasksScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {useSettingsStore} from './stores/settings';
import {useLibraryStore} from './stores/library';
import {preloadCovers} from './library/coverCache';
import {useKeyboardVisibility} from './hooks/useKeyboardVisibility';
import {useReaderLifecycle} from './hooks/reader-lifecycle';

const ReaderScreen = lazy(() =>
  import('./screens/ReaderScreen').then((m) => ({default: m.ReaderScreen}))
);

type TabId = 'home' | 'library' | 'tasks' | 'settings';

/** Only eagerly preload the first N covers; the rest are lazy-loaded on scroll. */
const COVER_PRELOAD_COUNT = 8;

const TABS: {id: TabId; label: string; icon: 'home' | 'auto-stories' | 'download' | 'settings'}[] =
  [
    {id: 'home', label: '首页', icon: 'home'},
    {id: 'library', label: '资源', icon: 'auto-stories'},
    {id: 'tasks', label: '下载', icon: 'download'},
    {id: 'settings', label: '设置', icon: 'settings'},
  ];

const SCREEN_ENTRIES: [Exclude<TabId, 'library'>, () => import('react').ReactElement][] = [
  ['home', HomeScreen],
  ['tasks', TasksScreen],
  ['settings', SettingsScreen],
];

export function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [prevTab, setPrevTab] = useState<TabId | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>(
    {} as Record<TabId, HTMLButtonElement | null>
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const theme = useSettingsStore((s) => s.settings.theme);
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  const {reader, readerClosing, openReader, closeReader} = useReaderLifecycle();
  useKeyboardVisibility();

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  useEffect(() => {
    void useLibraryStore.getState().load();
  }, []);

  useEffect(() => {
    const warm = () => {
      const covers = useLibraryStore
        .getState()
        .items.slice(0, COVER_PRELOAD_COUNT)
        .map((i) => i.coverPath);
      void preloadCovers(covers);
    };
    warm();
    return useLibraryStore.subscribe((state, prev) => {
      if (state.items !== prev.items) warm();
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const activeEl = tabRefs.current[tab];
    if (!activeEl) return;

    gsap.fromTo(activeEl, {scale: 0.9}, {scale: 1, duration: 0.25, ease: 'back.out(1.5)'});
  }, [tab]);

  useEffect(() => {
    if (!contentRef.current || prevTab === null) return;

    const content = contentRef.current;
    const direction = getTabIndex(tab) > getTabIndex(prevTab) ? 1 : -1;

    gsap.fromTo(
      content,
      {
        opacity: 0,
        x: 24 * direction,
      },
      {
        opacity: 1,
        x: 0,
        duration: 0.28,
        ease: 'power2.out',
      }
    );

    setPrevTab(null);
  }, [tab, prevTab]);

  const handleTabChange = (newTab: TabId) => {
    if (newTab === tab) return;
    setPrevTab(tab);
    setTab(newTab);
  };

  return (
    <div className="app">
      <div ref={contentRef} className="app-content">
        {tab === 'library' ? (
          <LibraryScreen
            onOpenReader={(item) =>
              openReader({
                filePath: item.filePath,
                title: item.title,
                pageCount: item.pageCount,
                pagesDir: item.pagesDir,
              })
            }
          />
        ) : (
          SCREEN_ENTRIES.map(([id, Screen]) => (tab === id ? <Screen key={id} /> : null))
        )}
      </div>
      <nav className="app-tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            className={`tab-item${tab === t.id ? ' is-active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            <span className="tab-icon">
              <Icon name={t.icon} size={24} />
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
      {reader ? (
        <Suspense fallback={null}>
          <ReaderScreen target={reader} closing={readerClosing} onClose={closeReader} />
        </Suspense>
      ) : null}
    </div>
  );
}

const TAB_INDEX = new Map(TABS.map((t, i) => [t.id, i]));

function getTabIndex(id: TabId): number {
  return TAB_INDEX.get(id) ?? 0;
}
