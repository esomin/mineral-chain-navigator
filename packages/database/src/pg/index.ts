/**
 * Phase 2: PostgreSQL/pgvector 저장소 모듈 (placeholder).
 *
 * InMemoryStore와 동일한 DataStore 인터페이스를 구현할 예정이다.
 * Phase 2에서 pg, pgvector 의존성을 추가하고 구현한다.
 */

import type { DataStore } from '../types.js';

/**
 * PostgreSQL 연결 설정.
 */
export interface PgConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

/**
 * PostgreSQL 기반 저장소 (Phase 2 구현 대비).
 * DataStore 인터페이스를 구현하여 InMemoryStore와 교체 가능하다.
 */
export class PgStore {
    // Phase 2에서 DataStore 인터페이스 구현
    // 현재는 placeholder로 타입 정의만 제공
    static readonly INTERFACE: string = 'DataStore';
}

export type { DataStore };
