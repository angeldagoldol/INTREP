import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { Playground } from './Playground.jsx';
import '../styles/tokens.css';
import '../styles/base.css';

// Dev-only entry (served at /playground.html, never part of the production build).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Playground />
    </MotionConfig>
  </StrictMode>,
);
