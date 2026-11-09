import { render } from './pages';
import './styles/newspaper.css';

window.addEventListener('hashchange', render);
void render();
