import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, Citation, InsightResponse } from '@navigator/shared';
import { GiDiamonds } from 'react-icons/gi';
import ReactMarkdown from 'react-markdown';

export interface AIInsightPanelProps {
    onClose: () => void;
}

/**
 * AI 인사이트 사이드 패널.
 * 그래프 토폴로지 + 문서 컨텍스트 기반 LLM 인사이트를 대화 형태로 제공한다.
 * 출처 인용 표시, 에러/재시도 UX 포함.
 * Requirements 9.1, 9.2, 9.5 구현.
 */
export function AIInsightPanel({ onClose }: AIInsightPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    // 에러 자동 제거 타이머
    const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // 메시지 리스트 스크롤 영역
    const messagesEndRef = useRef<HTMLDivElement>(null);
    // 마지막 사용자 질의 (재시도용)
    const lastQueryRef = useRef<string>('');

    // 에러 발생 시 10초 후 자동 제거
    useEffect(() => {
        if (error) {
            errorTimerRef.current = setTimeout(() => {
                setError(null);
            }, 10000);
        }
        return () => {
            if (errorTimerRef.current) {
                clearTimeout(errorTimerRef.current);
            }
        };
    }, [error]);

    // 새 메시지 추가 시 자동 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // AI 질의 전송
    const sendQuery = useCallback(async (query: string) => {
        if (!query.trim()) return;

        lastQueryRef.current = query;
        setError(null);

        // 사용자 메시지 추가
        const userMessage: ChatMessage = {
            role: 'user',
            content: query,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/insights/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId ?? undefined,
                    query: query.trim(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    errorData?.error ?? `서버 오류가 발생했습니다 (${response.status})`,
                );
            }

            const data: InsightResponse = await response.json();

            // 응답에 에러가 포함된 경우
            if (data.error) {
                setError(data.error);
                return;
            }

            // 세션 ID 저장
            if (data.sessionId) {
                setSessionId(data.sessionId);
            }

            // 어시스턴트 메시지 추가
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: data.answer,
                citations: data.citations,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (err) {
            setError(err instanceof Error ? err.message : '인사이트 생성에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    // 입력 폼 제출 핸들러
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendQuery(inputValue);
    };

    // 재시도 핸들러
    const handleRetry = () => {
        if (lastQueryRef.current) {
            setError(null);
            sendQuery(lastQueryRef.current);
        }
    };

    return (
        <aside
            className="fixed top-0 right-0 w-[600px] max-w-[90vw] h-full bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col animate-slide-in"
            aria-label="AI 인사이트 패널"
        >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                    <GiDiamonds color='#4796e3' size={20} />
                    <h2 className="m-0 text-base font-semibold text-gray-800">AI 인사이트</h2>
                </div>
                <button
                    onClick={onClose}
                    className="bg-transparent border-none text-lg cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="AI 인사이트 패널 접기"
                >
                    ▶
                </button>
            </div>

            {/* 메시지 리스트 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* 초기 안내 메시지 */}
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-gray-400 text-sm mt-8">
                        <p className="mb-2">리튬 공급망에 대해 질문해 보세요.</p>
                        <p className="text-xs text-gray-300">
                            예: &quot;칠레에서 한국까지 리튬 공급 경로를 설명해 줘&quot;
                        </p>
                    </div>
                )}

                {messages.map((msg, index) => (
                    <MessageBubble key={index} message={msg} />
                ))}

                {/* 로딩 인디케이터 */}
                {isLoading && <TypingIndicator />}

                {/* 에러 표시 */}
                {error && (
                    <ErrorDisplay
                        error={error}
                        onRetry={handleRetry}
                        hasLastQuery={!!lastQueryRef.current}
                    />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50"
            >
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="질문을 입력하세요..."
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    aria-label="AI 인사이트 질문 입력"
                />
                <button
                    type="submit"
                    disabled={isLoading || !inputValue.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    aria-label="질문 전송"
                >
                    전송
                </button>
            </form>
        </aside>
    );
}

// === 하위 컴포넌트 ===

/** 메시지 버블 컴포넌트 */
function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);

    // 답변 복사 핸들러
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            console.warn('클립보드 복사 실패');
        }
    };

    return (
        <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm relative ${isUser
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
            >
                {/* 복사 버튼 (어시스턴트 메시지에만 표시) */}
                {!isUser && (
                    <button
                        onClick={handleCopy}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 text-xs border-none cursor-pointer"
                        aria-label="답변 복사"
                        title={copied ? '복사됨!' : '복사'}
                    >
                        {copied ? '✓' : '📋'}
                    </button>
                )}

                {/* 메시지 내용 */}
                <div className="m-0 prose prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>

                {/* 출처 인용 (어시스턴트 메시지에만 표시) */}
                {!isUser && message.citations && message.citations.length > 0 && (
                    <CitationList citations={message.citations} />
                )}

                {/* 타임스탬프 */}
                <span
                    className={`block text-[0.65rem] mt-1 ${isUser ? 'text-blue-100' : 'text-gray-400'
                        }`}
                >
                    {new Date(message.timestamp).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
            </div>
        </div>
    );
}

/** 출처 인용 리스트 컴포넌트 */
function CitationList({ citations }: { citations: Citation[] }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="mt-2 pt-2 border-t border-gray-200">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-gray-500 bg-transparent border-none cursor-pointer hover:text-gray-700 p-0"
                aria-expanded={isExpanded}
                aria-label="출처 목록 토글"
            >
                <span className="text-[0.7rem]">{isExpanded ? '▼' : '▶'}</span>
                <span>출처 ({citations.length})</span>
            </button>

            {isExpanded && (
                <ul className="mt-1.5 m-0 p-0 list-none space-y-1.5">
                    {citations.map((citation, idx) => (
                        <li
                            key={idx}
                            className="p-1.5 bg-white rounded border border-gray-200 text-xs"
                        >
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="font-medium text-gray-700 truncate">
                                    📄 {citation.source}
                                </span>
                                <span className="text-[0.6rem] text-gray-400 ml-1 whitespace-nowrap">
                                    관련도 {Math.round(citation.relevance * 100)}%
                                </span>
                            </div>
                            <p className="m-0 text-gray-500 line-clamp-2">
                                {citation.content}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** 타이핑 인디케이터 컴포넌트 */
function TypingIndicator() {
    return (
        <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 rounded-bl-sm">
                <div className="flex items-center gap-1" aria-label="응답 생성 중">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
            </div>
        </div>
    );
}

/** 에러 표시 + 재시도 컴포넌트 */
function ErrorDisplay({
    error,
    onRetry,
    hasLastQuery,
}: {
    error: string;
    onRetry: () => void;
    hasLastQuery: boolean;
}) {
    return (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm" role="alert">
            <p className="m-0 text-red-700 mb-2">⚠️ {error}</p>
            <div className="flex items-center gap-2 flex-wrap">
                {hasLastQuery && (
                    <button
                        onClick={onRetry}
                        className="px-3 py-1 bg-red-100 text-red-700 border border-red-300 rounded text-xs cursor-pointer hover:bg-red-200 transition-colors"
                    >
                        다시 시도
                    </button>
                )}
                <span className="text-xs text-gray-500">
                    다른 질문을 해 보세요
                </span>
            </div>
        </div>
    );
}
