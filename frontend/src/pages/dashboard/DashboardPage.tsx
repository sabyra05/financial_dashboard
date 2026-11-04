import {useEffect, useMemo, useState} from 'react';
import {Checkbox, Col, DatePicker, Row, Select, Table, Tag, Typography} from 'antd';
import type {TableProps} from 'antd';
import dayjs from 'dayjs';
import type {Dayjs} from 'dayjs';
import {useListTTickerListGet, useRecentDataTickerSymbolRecentGet, type TickerTSModel} from '../../api/generated';
import RealtimeChart from '../../components/RealtimeChart';
import useMarketWebSocket from '../../hooks/useMarketWebSocket';
import type {MarketTick} from '../../hooks/useMarketWebSocket';
import {useLanguageStore} from '../../store/useLanguageStore';
import {useAuthStore} from '../../store/useAuthStore';

const HISTORY_OPTIONS = [1, 2, 3, 6, 12, 24];

type HistoryMode = 'recent' | 'custom';

interface TickerOption {
    symbol: string;
    name: string;
}

function unwrapPayload(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        if (Array.isArray(record.payload)) return record.payload;
        if (Array.isArray(record.items)) return record.items;
        if (Array.isArray(record.tickers)) return record.tickers;
    }
    return [];
}

function parseTickerOptions(value: unknown): TickerOption[] {
    const rows = unwrapPayload(value);
    return rows.flatMap((row) => {
        if (typeof row !== 'object' || row === null || !('symbol' in row) || typeof row.symbol !== 'string') return [];
        return [{symbol: row.symbol, name: 'name' in row && typeof row.name === 'string' ? row.name : row.symbol}];
    });
}

function normalizeTickerSeries(symbol: string, rows: TickerTSModel[] | undefined): MarketTick[] {
    if (!Array.isArray(rows)) return [];

    return rows
        .filter((row) => typeof row?.symbol === 'string' && row.symbol.toUpperCase() === symbol.toUpperCase())
        .map((row) => ({
            symbol: row.symbol,
            exchange: row.exchange,
            amount: Number(row.amount ?? 0),
            total_qty: Number(row.total_qty ?? 0),
            min_price: Number(row.min_price ?? 0),
            max_price: Number(row.max_price ?? 0),
            avg_price: Number(row.avg_price ?? 0),
            min_total_price: Number(row.min_total_price ?? 0),
            max_total_price: Number(row.max_total_price ?? 0),
            avg_total_price: Number(row.avg_total_price ?? 0),
            time: row.time ? Math.floor(new Date(row.time).getTime() / 1000) : 0,
        }))
        .filter((row) => row.time > 0)
        .sort((left, right) => left.time - right.time);
}

function mergeChartTicks(history: MarketTick[], live: MarketTick[]) {
    const map = new Map<number, MarketTick>();

    [...history, ...live].forEach((tick) => {
        const existing = map.get(tick.time);
        if (!existing || tick.time >= existing.time) {
            map.set(tick.time, tick);
        }
    });

    return [...map.values()].sort((left, right) => left.time - right.time);
}

function parseRawTickerRows(raw: string): TickerTSModel[] {
    if (!raw.trim()) return [];

    const trimmed = raw.trim();

    const parseItem = (item: unknown): TickerTSModel | null => {
        if (!item) return null;
        if (typeof item === 'string') {
            try {
                return JSON.parse(item) as TickerTSModel;
            } catch {
                return null;
            }
        }
        if (typeof item === 'object') {
            return item as TickerTSModel;
        }
        return null;
    };

    if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
            return parsed
                .map(parseItem)
                .filter((item): item is TickerTSModel => item !== null);
        }
    }

    return trimmed
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => parseItem(line))
        .filter((item): item is TickerTSModel => item !== null);
}

function DashboardPage() {
    const tickerQuery = useListTTickerListGet();
    const tickers = parseTickerOptions(tickerQuery.data);
    const [selected, setSelected] = useState<string[]>([]);
    const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>();
    const [historyHours, setHistoryHours] = useState<number>(3);
    const [historyMode, setHistoryMode] = useState<HistoryMode>('recent');
    const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [customRangeData, setCustomRangeData] = useState<TickerTSModel[]>([]);
    const [customRangeLoading, setCustomRangeLoading] = useState(false);
    const [customRangeError, setCustomRangeError] = useState<string | null>(null);
    const chartSymbol = selectedChartSymbol ?? tickers[0]?.symbol;
    const token = useAuthStore((state) => state.token);
    const t = useLanguageStore((state) => state.t);
    const {status, ticks, error, subscribe, unsubscribe} = useMarketWebSocket();

    useEffect(() => {
        if (!tickers.length) {
            setSelected([]);
            return;
        }

        setSelected((current) => {
            if (current.length > 0) return current;
            return tickers.slice(0, Math.min(5, tickers.length)).map((ticker) => ticker.symbol);
        });

        setSelectedChartSymbol((current) => current ?? tickers[0]?.symbol);
    }, [tickers]);

    useEffect(() => {
        if (!chartSymbol || historyMode !== 'recent') return;
        const end = dayjs();
        const start = end.clone().subtract(historyHours, 'hour');
        setCustomRange([start, end]);
    }, [chartSymbol, historyHours, historyMode]);

    const recentHistoryQuery = useRecentDataTickerSymbolRecentGet(chartSymbol ?? '', {
        hours: historyHours,
        exchange: 'binance',
    }, {
        query: {
            enabled: Boolean(chartSymbol) && historyMode === 'recent',
        },
    });

    useEffect(() => {
        if (!chartSymbol || historyMode !== 'custom' || !customRange || !token) return;

        let disposed = false;

        const fetchCustomRange = async () => {
            setCustomRangeLoading(true);
            setCustomRangeError(null);

            try {
                const [start, end] = customRange;
                const query = new URLSearchParams({
                    start: start.toISOString(),
                    end: end.toISOString(),
                    exchange: 'binance',
                });

                const response = await fetch(`http://127.0.0.1:8000/ticker/${encodeURIComponent(chartSymbol)}/raw?${query.toString()}`, {
                    headers: {
                        token,
                    },
                });

                if (!response.ok) {
                    const details = `${t('loadRangeError')}: ${response.status}`;
                    if (!disposed) {
                        setCustomRangeData([]);
                        setCustomRangeError(details);
                    }
                    return;
                }

                const text = await response.text();
                const rows = parseRawTickerRows(text);

                if (!disposed) {
                    setCustomRangeData(rows);
                }

            } catch (error) {
                if (!disposed) {
                    setCustomRangeData([]);
                    setCustomRangeError(error instanceof Error ? error.message : 'Не удалось загрузить диапазон');
                }
            } finally {
                if (!disposed) {
                    setCustomRangeLoading(false);
                }
            }
        };

        void fetchCustomRange();

        return () => {
            disposed = true;
        };
    }, [chartSymbol, customRange, historyMode, token, t]);

    useEffect(() => {
        if (!selected.length || !token) return;
        subscribe(selected);
    }, [selected, token, subscribe]);

    const normalizedSelected = useMemo(
        () => [...new Set(selected.map((symbol) => symbol.trim().toUpperCase()))],
        [selected]
    );

    useEffect(() => {
        if (!normalizedSelected.length || !token) return;
        subscribe(normalizedSelected);
    }, [normalizedSelected, token, subscribe]);

    const onSubscriptionsChange = (next: string[]) => {
        const normalizedNext = [...new Set(next.map((symbol) => symbol.trim().toUpperCase()))];
        const oldSet = new Set(normalizedSelected);
        const newSet = new Set(normalizedNext);

        subscribe([...newSet].filter((symbol) => !oldSet.has(symbol)));
        unsubscribe([...oldSet].filter((symbol) => !newSet.has(symbol)));
        setSelected(normalizedNext);
    };

    const marketHistory = ticks.filter((tick) => selected.includes(tick.symbol));
    const latestByTicker = new Map(marketHistory.map((tick) => [`${tick.exchange}:${tick.symbol}`, tick]));
    const visibleTicks = [...latestByTicker.values()];

    const recentHistory = useMemo(
        () => normalizeTickerSeries(chartSymbol ?? '', recentHistoryQuery.data?.payload as TickerTSModel[] | undefined),
        [chartSymbol, recentHistoryQuery.data]
    );

    const chartHistory = useMemo(
        () => normalizeTickerSeries(chartSymbol ?? '', customRangeData),
        [chartSymbol, customRangeData]
    );

    const chartTicks = useMemo(() => {
        const liveTicks = ticks.filter((tick) => tick.symbol === chartSymbol);
        const baseSeries = historyMode === 'recent' ? recentHistory : chartHistory;
        return mergeChartTicks(baseSeries, liveTicks).filter((tick) => tick.symbol === chartSymbol);
    }, [chartHistory, chartSymbol, historyMode, recentHistory, ticks]);

    const columns: TableProps<MarketTick>['columns'] = [
        {title: t('quoteSymbol'), dataIndex: 'symbol', key: 'symbol'},
        {title: t('quoteExchange'), dataIndex: 'exchange', key: 'exchange'},
        {title: t('averagePrice'), dataIndex: 'avg_price', key: 'avg_price', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
        {title: t('minimum'), dataIndex: 'min_price', key: 'min_price', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
        {title: t('maximum'), dataIndex: 'max_price', key: 'max_price', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
        {title: t('volume'), dataIndex: 'total_qty', key: 'total_qty', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
    ];

    const statusColor = status === 'connected' ? 'green' : status === 'error' ? 'red' : 'gold';
    const statusLabel = {
        disconnected: t('disconnected'),
        connecting: t('connecting'),
        authenticating: t('authenticating'),
        connected: t('connected'),
        reconnecting: t('reconnecting'),
        error: t('error'),
    }[status];

    return (
        <section>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Typography.Title level={2} className="mb-1">{t('marketRealtime')}</Typography.Title>
                    <Typography.Text type="secondary">{t('marketStream')}</Typography.Text>
                </div>
                <Tag color={statusColor}>{statusLabel}</Tag>
            </div>
            {error && <Typography.Paragraph type="danger">{error}</Typography.Paragraph>}
            <Row gutter={[16, 16]}>
                <Col xs={24}>
                    <div className="border-b border-slate-200 pb-4">
                        <Typography.Text strong className="mb-3 block">{t('subscriptions')}</Typography.Text>
                        {tickerQuery.isLoading ? <Typography.Text type="secondary">{t('loadingTickers')}</Typography.Text> : (
                            <Checkbox.Group
                                options={tickers.map((ticker) => ({label: `${ticker.symbol} · ${ticker.name}`, value: ticker.symbol}))}
                                value={selected}
                                onChange={(values) => onSubscriptionsChange(values as string[])}
                            />
                        )}
                    </div>
                </Col>
                <Col xs={24}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Typography.Title level={4} className="mb-0">{t('chartPrice')}</Typography.Title>
                        <div className="flex flex-wrap items-center gap-3">
                            <Select
                                aria-label={t('selectTicker')}
                                value={chartSymbol}
                                onChange={setSelectedChartSymbol}
                                options={tickers.map((ticker) => ({label: ticker.symbol, value: ticker.symbol}))}
                                placeholder={t('selectTicker')}
                                style={{width: 180}}
                                disabled={tickers.length === 0}
                            />
                            <Select
                                value={historyMode}
                                onChange={(mode: HistoryMode) => setHistoryMode(mode)}
                                options={[
                                    {label: t('recentHours'), value: 'recent'},
                                    {label: t('customPeriod'), value: 'custom'},
                                ]}
                                style={{width: 190}}
                            />
                            {historyMode === 'recent' && (
                                <Select
                                    aria-label={t('chooseLastHours')}
                                    value={historyHours}
                                    onChange={setHistoryHours}
                                    options={HISTORY_OPTIONS.map((value) => ({label: t('lastHours', {value}), value}))}
                                    style={{width: 160}}
                                />
                            )}
                            {historyMode === 'custom' && (
                                <DatePicker.RangePicker
                                    showTime
                                    format="DD.MM.YYYY HH:mm"
                                    value={customRange}
                                    onChange={(value) => {
                                        if (value && value[0] && value[1]) {
                                            setCustomRange([value[0], value[1]]);
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                    <div className="mt-3 border-y border-slate-200 py-3">
                        {customRangeLoading && <div className="mb-2 text-sm text-slate-500">{t('loadingRange')}</div>}
                        {customRangeError && <div className="mb-2 text-sm text-red-500">{customRangeError}</div>}
                        {chartTicks.length > 0
                            ? <RealtimeChart ticks={chartTicks} />
                            : <div className="flex h-85 items-center justify-center text-slate-500">{t('chartWaiting')}</div>}
                    </div>
                </Col>
                <Col xs={24}>
                    <Typography.Title level={4}>{t('lastQuotes')}</Typography.Title>
                    <Table<MarketTick>
                        rowKey={(tick) => `${tick.exchange}:${tick.symbol}`}
                        columns={columns}
                        dataSource={visibleTicks}
                        pagination={false}
                        scroll={{x: 760}}
                        locale={{emptyText: t('noQuotes')}}
                    />
                </Col>
            </Row>
        </section>
    );
}

export default DashboardPage;
