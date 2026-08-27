import {createRoot} from 'react-dom/client';
import {App} from './App';
import './theme/index.css';
import './styles/fonts.css';
import './styles/app.css';
import './styles/albumCard.css';
import './styles/emptyState.css';
import './styles/listTile.css';
import './styles/progressBar.css';
import './styles/searchBar.css';
import './styles/sectionHeader.css';
import './styles/home.css';
import './styles/library.css';
import './styles/tasks.css';
import './styles/settings.css';
import './styles/tagFilter.css';
import './styles/reader.css';
import './styles/confirmDialog.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('root element not found');
}
createRoot(rootEl).render(<App />);
