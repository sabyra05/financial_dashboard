import {useState} from 'react';
import {Checkbox, Col, Row, Select, Table, Tag, Typography} from 'antd';
import type {TableProps} from 'antd';
import {useListTTickerListGet} from '../../api/generated';
import RealtimeChart from '../../components/RealtimeChart';
import useMarketWebSocket from '../../hooks/useMarketWebSocket';
import type {MarketTick} from '../../hooks/useMarketWebSocket';

interface TickerOption {
    symbol: string;
    name: string;
}

function parseTickerOptions(value: unknown): TickerOption[] {
    const rows = Array.isArray(value)
        ? value
        : typeof value === 'object' && value !== null && 'items' in value && Array.isArray(value.items)
            ? value.items
            : typeof value === 'object' && value !== null && 'tickers' in value && Array.isArray(value.tickers)
                ? value.tickers
            : [];
    return rows.flatMap((row) => {
        if (typeof row !== 'object' || row === null || !('symbol' in row) || typeof row.symbol !== 'string') return [];
        return [{symbol: row.symbol, name: 'name' in row && typeof row.name === 'string' ? row.name : row.symbol}];
    });
}

function DashboardPage() {
    const tickerQuery = useListTTickerListGet();
    const tickers = parseTickerOptions(tickerQuery.data);
    const [selected, setSelected] = useState<string[]>([]);
    const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>();
    const chartSymbol = selectedChartSymbol ?? tickers[0]?.symbol;
    const {status, ticks, error, subscribe, unsubscribe} = useMarketWebSocket();

    const onSubscriptionsChange = (next: string[]) => {
        subscribe(next.filter((symbol) => !selected.includes(symbol)));
        unsubscribe(selected.filter((symbol) => !next.includes(symbol)));
        setSelected(next);
    };

    const marketHistory = ticks.filter((tick) => selected.includes(tick.symbol));
    const latestByTicker = new Map(marketHistory.map((tick) => [`${tick.exchange}:${tick.symbol}`, tick]));
    const visibleTicks = [...latestByTicker.values()];
    const chartTicks = marketHistory
        .filter((tick) => tick.symbol === chartSymbol)
        .sort((left, right) => left.time - right.time);

    const columns: TableProps<MarketTick>['columns'] = [
        {title: 'Символ', dataIndex: 'symbol', key: 'symbol'},
        {title: 'Биржа', dataIndex: 'exchange', key: 'exchange'},
        {title: 'Средняя цена', dataIndex: 'avg_price', key: 'avg_price', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
        {title: 'Минимум', dataIndex: 'min_price', key: 'min_price', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
        {title: 'Максимум', dataIndex: 'max_price', key: 'max_price', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
        {title: 'Объём', dataIndex: 'total_qty', key: 'total_qty', align: 'right', render: (value: number) => value.toLocaleString(undefined, {maximumFractionDigits: 8})},
    ];

    const statusColor = status === 'connected' ? 'green' : status === 'error' ? 'red' : 'gold';
    const statusLabel = {
        disconnected: 'Отключено',
        connecting: 'Подключение',
        authenticating: 'Авторизация',
        connected: 'Подключено',
        reconnecting: 'Переподключение',
        error: 'Ошибка',
    }[status];

    return (
        <section>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Typography.Title level={2} className="mb-1">Рынок в реальном времени</Typography.Title>
                    <Typography.Text type="secondary">Поток рыночных данных</Typography.Text>
                </div>
                <Tag color={statusColor}>{statusLabel}</Tag>
            </div>
            {error && <Typography.Paragraph type="danger">{error}</Typography.Paragraph>}
            <Row gutter={[16, 16]}>
                <Col xs={24}>
                    <div className="border-b border-slate-200 pb-4">
                        <Typography.Text strong className="mb-3 block">Подписки</Typography.Text>
                        {tickerQuery.isLoading ? <Typography.Text type="secondary">Загрузка тикеров…</Typography.Text> : (
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
                        <Typography.Title level={4} className="mb-0">График средней цены</Typography.Title>
                        <Select
                            aria-label="Выбрать тикер для графика"
                            value={chartSymbol}
                            onChange={setSelectedChartSymbol}
                            options={tickers.map((ticker) => ({label: ticker.symbol, value: ticker.symbol}))}
                            placeholder="Выберите тикер"
                            style={{width: 180}}
                            disabled={tickers.length === 0}
                        />
                    </div>
                    <div className="mt-3 border-y border-slate-200 py-3">
                        {chartTicks.length > 0
                            ? <RealtimeChart ticks={chartTicks} />
                            : <div className="flex h-[340px] items-center justify-center text-slate-500">Ожидаем данные по выбранному тикеру</div>}
                    </div>
                </Col>
                <Col xs={24}>
                    <Typography.Title level={4}>Последние котировки</Typography.Title>
                    <Table<MarketTick>
                        rowKey={(tick) => `${tick.exchange}:${tick.symbol}`}
                        columns={columns}
                        dataSource={visibleTicks}
                        pagination={false}
                        scroll={{x: 760}}
                        locale={{emptyText: 'Выберите тикеры, чтобы получать котировки'}}
                    />
                </Col>
            </Row>
        </section>
    );
}

export default DashboardPage;