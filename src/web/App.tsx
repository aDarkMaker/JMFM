import {useEffect, useRef, useState} from 'react';
import {gsap} from 'gsap';
import {Icon} from './components/Icon';
import {HomeScreen} from './screens/HomeScreen';
import {LibraryScreen} from './screens/LibraryScreen';
import {TasksScreen} from './screens/TasksScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {ReaderScreen} from './screens/ReaderScreen';
import {useSettingsStore} from './stores/settings';
import {useLibraryStore} from './stores/library';
import {preloadCovers} from './library/coverCache';
import {useKeyboardVisibility} from './hooks/useKeyboardVisibility';
import {useReaderLifecycle} from './hooks/usePlatformBack';

type TabId = 'home' | 'library' | 'tasks' | 'settings';

const TABS: {id: TabId; label: string; icon: 'home' | 'auto-stories' | 'download' | 'settings'}[] = [
  {id: 'home', label: '首页', icon: 'home'},
  {id: 'library', label: '资源', icon: 'auto-stories'},
  {id: 'tasks', label: '下载', icon: 'download'},
  {id: 'settings', label: '设置', icon: 'settings'},
];

const SCREENS: Record<Exclude<TabId, 'library'>, () => import('react').ReactElement> = {
  home: HomeScreen,
  tasks: TasksScreen,
  settings: SettingsScreen,
};

export function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [prevTab, setPrevTab] = useState<TabId | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({} as Record<TabId, HTMLButtonElement | null>);
  const contentRef = useRef<HTMLDivElement>(null);
  const theme = useSettingsStore(s => s.settings.theme);
  const loaded = useSettingsStore(s => s.loaded);
  const load = useSettingsStore(s => s.load);
  const {reader, readerClosing, openReader, closeReader} = useReaderLifecycle();
  useKeyboardVisibility();

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  useEffect(() => {
    const warm = () => {
      void preloadCovers(useLibraryStore.getState().items.map(i => i.coverPath));
    };
    warm();
    return useLibraryStore.subscribe(warm);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const activeEl = tabRefs.current[tab];
    if (!activeEl) return;

    gsap.fromTo(
      activeEl,
      {scale: 0.9},
      {scale: 1, duration: 0.25, ease: 'back.out(1.5)'},
    );
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
      },
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
            onOpenReader={item => openReader({filePath: item.filePath, title: item.title, pageCount: item.pageCount, pagesDir: item.pagesDir})}
          />
        ) : (
          Object.entries(SCREENS).map(([id, Screen]) =>
            tab === id ? <Screen key={id} /> : null,
          )
        )}
      </div>
      <nav className="app-tabbar">
        {TABS.map(t => (
          <button
            key={t.id}
            ref={el => { tabRefs.current[t.id] = el; }}
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
        <ReaderScreen target={reader} closing={readerClosing} onClose={closeReader} />
      ) : null}
    </div>
  );
}

function getTabIndex(id: TabId): number {
  return TABS.findIndex(t => t.id === id);
}
