import '../styles/student.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FirebaseProvider } from '../shared/FirebaseContext.jsx';
import StudentApp from './StudentApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FirebaseProvider>
      <StudentApp />
    </FirebaseProvider>
  </StrictMode>,
);
