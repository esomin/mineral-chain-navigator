import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// React 애플리케이션 진입점
const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('루트 엘리먼트를 찾을 수 없습니다.');
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
