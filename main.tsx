import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { UnitProvider } from './context/UnitContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <UnitProvider>
    <App />
  </UnitProvider>
);
