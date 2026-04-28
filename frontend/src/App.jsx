import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Tool from './pages/Tool.jsx';
import Cursor from './components/Cursor.jsx';
import { DemoOne } from './components/PromptBoxDemo.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Cursor />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/builder" element={<Tool />} />
        <Route path="/demo" element={<DemoOne />} />
        <Route path="/chat" element={<Navigate to="/builder" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
