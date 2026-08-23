import {useState} from 'react';
import {Icon} from './components/Icon';
import {HomeScreen} from './screens/HomeScreen';
import {LibraryScreen} from './screens/LibraryScreen';
import {TasksScreen} from './screens/TasksScreen';
import {SettingsScreen} from './screens/SettingsScreen';

type TabId = 'home' | 'library' | 'tasks' | 'settings';

const TABS: {id: TabId; label: string; icon: 'home' | 'auto-stories' | 'download' | 'settings'}[] = [
  {id: 'home', label: '首页', icon: 'home'},
  {id: 'library', label: '漫画库', icon: 'auto-stories'},
  {id: 'tasks', label: '下载', icon: 'download'},
  {id: 'settings', label: '设置', icon: 'settings'},
];

export function App() {
  const [tab, setTab] = useState<TabId>('home');

  return (
    <div className="app">
      <div className="app-content">
        {tab === 'home' ? <HomeScreen /> : null}
        {tab === 'library' ? <LibraryScreen /> : null}
        {tab === 'tasks' ? <TasksScreen /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </div>
      <nav className="app-tabbar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-item${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
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
