// Express 서버 엔트리포인트
import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { router } from './routes/index.js';

const app = express();

// === 미들웨어 설정 ===

// CORS 미들웨어
app.use(cors());

// JSON 바디 파서
app.use(express.json());

// === API 라우트 ===
app.use('/api', router);

// === 에러 핸들링 미들웨어 ===

/** 애플리케이션 에러 타입 */
interface AppError extends Error {
    statusCode?: number;
    type?: 'validation' | 'not_found' | 'internal';
}

/** 404 핸들러 — 정의되지 않은 라우트 처리 */
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.', statusCode: 404 });
});

/** 전역 에러 핸들러 */
app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode ?? (err.type === 'validation' ? 400 : 500);

    // 프로덕션에서는 내부 에러 메시지 노출 방지
    const message =
        statusCode === 500
            ? '서버 내부 오류가 발생했습니다.'
            : err.message || '알 수 없는 오류가 발생했습니다.';

    res.status(statusCode).json({ error: message, statusCode });
});

/** 서버 기본 포트 */
const DEFAULT_PORT = 3001;

/**
 * 서버를 시작한다.
 * @param port 리스닝 포트 (기본값: 3001)
 */
export function startServer(port: number = DEFAULT_PORT): Promise<void> {
    return new Promise((resolve) => {
        app.listen(port, () => {
            console.log(`[backend] 서버가 포트 ${port}에서 실행 중입니다.`);
            resolve();
        });
    });
}

export { app };
