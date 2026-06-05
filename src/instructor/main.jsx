import '../styles/instructor.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FirebaseProvider } from '../shared/FirebaseContext.jsx';
import InstructorApp from './InstructorApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FirebaseProvider>
      <InstructorApp />
    </FirebaseProvider>
  </StrictMode>
);
