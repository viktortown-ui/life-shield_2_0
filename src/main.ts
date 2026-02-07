import './styles/main.css';
import { ensureState } from './core/store';
import { initPwaUpdate } from './core/pwaUpdate';
import { initRouter } from './ui/router';

ensureState();
initPwaUpdate();

const root = document.getElementById('app');
if (root) {
  initRouter(root);
}
