// 앱 전역에서 사용하는 인메모리 저장소 인스턴스
import { InMemoryStore } from '@navigator/database';

/**
 * 싱글톤 InMemoryStore 인스턴스.
 * 컨트롤러들이 동일한 저장소를 공유하기 위해 사용한다.
 */
export const store = new InMemoryStore();
