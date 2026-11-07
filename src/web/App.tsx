import {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {gsap} from 'gsap';
import {Icon} from './components/Icon';
import {HomeScreen} from './screens/HomeScreen';
import {LibraryScreen} from './screens/LibraryScreen';
import {TasksScreen} from './screens/TasksScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {DiscoverScreen} from './screens/DiscoverScreen';
import {SearchScreen} from './screens/SearchScreen';
import {AlbumDetailScreen} from './screens/AlbumDetailScreen';
import {ToastHost} from './components/Toast';
import {useSettingsStore} from './stores/settings';
import {useLibraryStore} from './stores/library';
import {preloadCovers} from './library/coverCache';
import {useKeyboardVisibility} from './hooks/useKeyboardVisibility';
import {useReaderLifecycle} from './hooks/reader-lifecycle';
import {useNavStack} from './hooks/useNavStack';
import {useHistoryStore} from './stores/history';
import {useHideOnScroll} from './hooks/useHideOnScroll';
import {usePullToRefresh} from './hooks/usePullToRefresh';
import {useEdgeSwipeBack} from './hooks/useEdgeSwipeBack';
import {useTabKeepAlive} from './hooks/useTabKeepAlive';
import {useDailyStore} from './stores/daily';
import {useBrowseStore} from './stores/browse';

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

const THEME_COLORS = {dark: '#101318', light: '#f3f6fa'} as const;

export function App() {
  const [tab, setTab] = useState<TabId>('home');
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>(
    {} as Record<TabId, HTMLButtonElement | null>
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const theme = useSettingsStore((s) => s.settings.theme);
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  const {reader, readerClosing, openReader, closeReader} = useReaderLifecycle();
  const {stack, closing: navClosing, back: navBack} = useNavStack();
  const navEntry = navClosing ?? stack[stack.length - 1];
  useKeyboardVisibility();
  const chromeHidden = useHideOnScroll();
  const navLayerRef = useEdgeSwipeBack(navBack, stack.length > 0 && !navClosing);

  const refreshHome = useCallback(async () => {
    await useDailyStore.getState().refresh();
    await useBrowseStore.getState().loadHot(true);
  }, []);
  const homePullRef = usePullToRefresh(refreshHome);

  const homeKeepAlive = useTabKeepAlive(tab === 'home');
  const libraryKeepAlive = useTabKeepAlive(tab === 'library');
  const tasksKeepAlive = useTabKeepAlive(tab === 'tasks');
  const settingsKeepAlive = useTabKeepAlive(tab === 'settings');

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  useEffect(() => {
    void useLibraryStore.getState().load();
    void useHistoryStore.getState().load();
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
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  }, [theme]);

  useEffect(() => {
    const activeEl = tabRefs.current[tab];
    if (!activeEl) return;

    gsap.fromTo(activeEl, {scale: 0.9}, {scale: 1, duration: 0.25, ease: 'back.out(1.5)'});
  }, [tab]);

  const handleTabChange = (newTab: TabId) => {
    if (newTab === tab) return;
    if (stack.length > 0) navBack();
    setTab(newTab);
  };

  const navTarget = useMemo(() => {
    if (!navEntry) return null;
    if (navEntry.type === 'discover') {
      return (
        <DiscoverScreen
          initialCategory={navEntry.params?.category}
          initialOrder={navEntry.params?.order}
        />
      );
    }
    if (navEntry.type === 'search') {
      return <SearchScreen initialQuery={navEntry.params?.query ?? ''} />;
    }
    return (
      <AlbumDetailScreen
        albumId={navEntry.params.albumId}
        fallbackTitle={navEntry.params.title}
        onOpenReader={openReader}
      />
    );
  }, [navEntry, openReader]);

  const renderPane = (
    id: TabId,
    keepAlive: ReturnType<typeof useTabKeepAlive>,
    node: React.ReactNode,
    pullRef?: React.Ref<HTMLDivElement>
  ) => (
    <div
      key={id}
      ref={pullRef}
      className="tab-pane"
      hidden={tab !== id}
      aria-hidden={tab !== id}
      onScrollCapture={keepAlive.onScrollCapture}
    >
      <div ref={keepAlive.paneRef} className="tab-pane-inner">
        {keepAlive.mounted ? node : null}
      </div>
    </div>
  );

  return (
    <div className={`app${chromeHidden ? ' chrome-hidden' : ''}${navEntry ? ' nav-open' : ''}`}>
      <div ref={contentRef} className={`app-content${navEntry ? ' is-covered' : ''}`}>
        {renderPane(
          'home',
          homeKeepAlive,
          <HomeScreen onOpenReader={openReader} />,
          homePullRef
        )}
        {renderPane(
          'library',
          libraryKeepAlive,
          <LibraryScreen
            onOpenReader={(item, startPage) =>
              openReader({
                filePath: item.filePath,
                title: item.title,
                pageCount: item.pageCount,
                pagesDir: item.pagesDir,
                albumId: item.albumId,
                ...(startPage != null ? {startPage} : {}),
              })
            }
          />
        )}
        {renderPane('tasks', tasksKeepAlive, <TasksScreen />)}
        {renderPane('settings', settingsKeepAlive, <SettingsScreen />)}
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
      {navTarget ? (
        <div
          ref={navLayerRef}
          className={`nav-layer${navEntry?.type === 'search' ? ' is-search' : ''}${navClosing ? ' is-closing' : ''}`}
        >
          {navTarget}
        </div>
      ) : null}
      {reader ? (
        <Suspense fallback={null}>
          <ReaderScreen target={reader} closing={readerClosing} onClose={closeReader} />
        </Suspense>
      ) : null}
      <ToastHost />
    </div>
  );
}
