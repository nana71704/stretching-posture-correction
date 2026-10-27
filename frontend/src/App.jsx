import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import MainPage from './pages/MainPage';
import StretchSelectPage from './pages/StretchSelectPage';
import GuidePage from './pages/GuidePage';
import LiveAnalysisPage from './pages/LiveAnalysisPage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/stretches" element={<StretchSelectPage />} />
          <Route path="/stretches/:id/guide" element={<GuidePage />} />
          <Route path="/sessions/:id/live" element={<LiveAnalysisPage />} />
          <Route path="/sessions/:id" element={<ResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
