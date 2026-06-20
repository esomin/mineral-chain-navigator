import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GraphView } from './pages/GraphView';

// 메인 애플리케이션 컴포넌트 - 라우팅 설정
export function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Phase 1: 단일 그래프 뷰 */}
                <Route path="/" element={<GraphView />} />
            </Routes>
        </BrowserRouter>
    );
}
