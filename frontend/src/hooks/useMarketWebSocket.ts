import {useEffect, useRef, useState} from 'react';
import {useAuthStore} from '../store/useAuthStore';

export interface MarketTick {
    symbol: string;
    exchange: string;
    amount: number;
    total_qty: number;
    min_price: number;
    max_price: number;
    avg_price: number;
    min_total_price: number;
    max_total_price: number;
    avg_total_price: number;
    time: number;
}

export type MarketConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting' | 'error';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:8000/ticker/ws';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeSymbol(value: string): string {
    return value.trim().toUpperCase();
}

function parseMarketTick(value: unknown): MarketTick | null {
    if (!isRecord(value) || typeof value.symbol !== 'string' || typeof value.avg_price !== 'number') return null;
    return {
        symbol: normalizeSymbol(value.symbol),
        exchange: typeof value.exchange === 'string' ? value.exchange : 'Unknown',
        amount: typeof value.amount === 'number' ? value.amount : 0,
        total_qty: typeof value.total_qty === 'number' ? value.total_qty : 0,
        min_price: typeof value.min_price === 'number' ? value.min_price : value.avg_price,
        max_price: typeof value.max_price === 'number' ? value.max_price : value.avg_price,
        avg_price: value.avg_price,
        min_total_price: typeof value.min_total_price === 'number' ? value.min_total_price : 0,
        max_total_price: typeof value.max_total_price === 'number' ? value.max_total_price : 0,
        avg_total_price: typeof value.avg_total_price === 'number' ? value.avg_total_price : 0,
        time: typeof value.time === 'number' && Number.isFinite(value.time)
            ? value.time
            : Math.floor(Date.now() / 1000),
    };
}

function useMarketWebSocket(exchange = 'binance') {
    const token = useAuthStore((state) => state.token);
    const [status, setStatus] = useState<MarketConnectionStatus>('disconnected');
    const [ticks, setTicks] = useState<MarketTick[]>([]);
    const [error, setError] = useState<string | null>(null);
    const desiredRef = useRef(new Set<string>());
    const activeRef = useRef(new Set<string>());
    const socketRef = useRef<WebSocket | null>(null);
    const authenticatedRef = useRef(false);

    useEffect(() => {
        if (!token) {
            return;
        }

        let disposed = false;
        let retryCount = 0;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
        let socket: WebSocket | null = null;

        const sendSubscription = (action: 'subscribe' | 'unsubscribe', symbols: string[]) => {
            if (socket?.readyState !== WebSocket.OPEN || !authenticatedRef.current || symbols.length === 0) return;
            socket.send(JSON.stringify({action, token, exchange, tickers: symbols}));
        };

        const connect = () => {
            if (disposed) return;
            setStatus(retryCount === 0 ? 'connecting' : 'reconnecting');
            setError(null);
            authenticatedRef.current = false;
            activeRef.current.clear();
            socket = new WebSocket(WS_URL);
            socketRef.current = socket;

            socket.onopen = () => {
                if (!disposed) {
                    setStatus('authenticating');
                    socket?.send(JSON.stringify({action: 'auth', token}));
                }
            };

            socket.onmessage = (event) => {
                let payload: unknown;
                try {
                    payload = JSON.parse(String(event.data));
                } catch {
                    return;
                }

                if (isRecord(payload) && typeof payload.error === 'string') {
                    setError(payload.error);
                    setStatus('error');
                    return;
                }

                if (isRecord(payload) && payload.status === 'success' && !authenticatedRef.current) {
                    authenticatedRef.current = true;
                    retryCount = 0;
                    setStatus('connected');
                    const symbols = [...desiredRef.current];
                    if (symbols.length > 0) {
                        sendSubscription('subscribe', symbols);
                        symbols.forEach((symbol) => activeRef.current.add(symbol));
                    }
                    return;
                }

                const tick = parseMarketTick(payload);
                if (tick) {
                    setTicks((current) => {
                        const next = [...current, tick].slice(-200);
                        const map = new Map(next.map((item) => [`${item.exchange}:${item.symbol}`, item]));
                        return [...map.values()].slice(-200);
                    });
                }
            };

            socket.onerror = () => {
                if (!disposed) setError('Не удалось подключиться к WebSocket');
            };

            socket.onclose = (event) => {
                authenticatedRef.current = false;
                activeRef.current.clear();
                if (disposed) return;
                if (event.code === 1008) {
                    setStatus('error');
                    setError('Доступ запрещён: проверьте сессию');
                    return;
                }
                retryCount += 1;
                setStatus('reconnecting');
                reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** (retryCount - 1), 15000));
            };
        };

        connect();

        return () => {
            disposed = true;
            authenticatedRef.current = false;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            socket?.close();
            socketRef.current = null;
        };
    }, [exchange, token]);

    const subscribe = (symbols: string[]) => {
        const additions = symbols.filter((symbol) => !desiredRef.current.has(symbol));
        additions.forEach((symbol) => desiredRef.current.add(symbol));
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN && authenticatedRef.current) {
            const pending = additions.filter((symbol) => !activeRef.current.has(symbol));
            if (pending.length > 0) {
                socket.send(JSON.stringify({action: 'subscribe', token, exchange, tickers: pending}));
                pending.forEach((symbol) => activeRef.current.add(symbol));
            }
        }
    };

    const unsubscribe = (symbols: string[]) => {
        symbols.forEach((symbol) => desiredRef.current.delete(symbol));
        const active = symbols.filter((symbol) => activeRef.current.has(symbol));
        const socket = socketRef.current;
        if (active.length > 0 && socket?.readyState === WebSocket.OPEN && authenticatedRef.current) {
            socket.send(JSON.stringify({action: 'unsubscribe', token, exchange, tickers: active}));
            active.forEach((symbol) => activeRef.current.delete(symbol));
        }
    };

    return {status, ticks, error, subscribe, unsubscribe};
}

export default useMarketWebSocket;