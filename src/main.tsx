import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AccessGate from './components/AccessGate';
import ReminderAction from './components/ReminderAction';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReminderAction /><AccessGate><App /></AccessGate>
  </StrictMode>,
);
