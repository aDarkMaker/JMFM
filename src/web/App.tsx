import {useEffect, useRef, useState} from 'react';
import {gsap} from 'gsap';
import {Icon} from './components/Icon';
import {HomeScreen} from './screens/HomeScreen';
import {LibraryScreen} from './screens/LibraryScreen';
import {TasksScreen} from './screens/TasksScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {useSettingsStore} from './stores/settings';

type TabId = 'home' | 'library' | 'tasks' | 'settings';

const TABS: {id: TabId; label: string; icon: 'home' | 'auto-stories' | 'download' | 'settings'}[] = [
  {id: 'home', label: '首页', icon: 'home'},
  {id: 'library', label: '资源', icon: 'auto-stories'},
  {id: 'tasks', label: '下载', icon: 'download'},
  {id: 'settings', label: '设置', icon: 'settings'},
];

const SCREENS: Record<TabId, () => import('react').ReactElement> = {
  home: HomeScreen,
  library: LibraryScreen,
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

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const keyboardOpen = vv.height < window.innerHeight * 0.8;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
    };
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);

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
        {Object.entries(SCREENS).map(([id, Screen]) =>
          tab === id ? <Screen key={id} /> : null,
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
    </div>
  );
}

function getTabIndex(id: TabId): number {
  return TABS.findIndex(t => t.id === id);
}
