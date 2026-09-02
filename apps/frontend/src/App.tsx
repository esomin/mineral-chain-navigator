import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GraphView } from './pages/GraphView';
import { MapViewPage } from './pages/MapViewPage';
import { Toaster } from './components/ui/sonner';

// 메인 애플리케이션 컴포넌트 - 라우팅 설정
export function App() {
    return (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Toaster position="top-center" />
            <Routes>
                {/* Phase 1: 그래프 뷰 */}
                <Route path="/" element={<GraphView />} />
                {/* Phase 2: GIS 지도 뷰 */}
                <Route path="/map" element={<MapViewPage />} />
            </Routes>
        </BrowserRouter>
    );
}
