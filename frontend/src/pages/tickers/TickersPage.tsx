import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography, message} from 'antd';
import type {TableProps} from 'antd';
import {
    useCreateTickerCreatePost,
    useDeleteTickerSymbolDelete,
    useListTTickerListGet,
    useUpdateTickerSymbolPatch,
} from '../../api/generated';
import type {TickerCreate} from '../../api/generated';
import {useLanguageStore} from '../../store/useLanguageStore';

interface TickerRow {
    symbol: string;
    name: string;
    is_active?: boolean;
}

type TickerForm = TickerCreate & {is_active: boolean};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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

function parseTickerRows(value: unknown): TickerRow[] {
    const candidates = unwrapPayload(value);

    return candidates.flatMap((candidate) => {
        if (!isRecord(candidate) || typeof candidate.symbol !== 'string') return [];
        return [{
            symbol: candidate.symbol,
            name: typeof candidate.name === 'string' ? candidate.name : candidate.symbol,
            is_active: typeof candidate.is_active === 'boolean' ? candidate.is_active : undefined,
        }];
    });
}

function TickersPage() {
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<TickerRow | null>(null);
    const [form] = Form.useForm<TickerForm>();
    const queryClient = useQueryClient();
    const tickersQuery = useListTTickerListGet();
    const tickers = parseTickerRows(tickersQuery.data);
    const refreshTickers = () => queryClient.invalidateQueries({queryKey: ['/ticker/list']});
    const t = useLanguageStore((state) => state.t);

    const createTicker = useCreateTickerCreatePost({
        mutation: {
            onSuccess: () => {
                message.success(t('tickerAdded'));
                setCreateOpen(false);
                form.resetFields();
                void refreshTickers();
            },
            onError: () => message.error(t('tickerAddFailed')),
        },
    });
    const deleteTicker = useDeleteTickerSymbolDelete({
        mutation: {
            onSuccess: () => {
                message.success(t('tickerDeleted'));
                void refreshTickers();
            },
            onError: () => message.error(t('tickerDeleteFailed')),
        },
    });
    const updateTicker = useUpdateTickerSymbolPatch({
        mutation: {
            onSuccess: () => {
                message.success(t('tickerUpdated'));
                setCreateOpen(false);
                setEditing(null);
                form.resetFields();
                void refreshTickers();
            },
            onError: () => message.error(t('tickerUpdateFailed')),
        },
    });

    const columns: TableProps<TickerRow>['columns'] = [
        {title: t('symbol'), dataIndex: 'symbol', key: 'symbol'},
        {title: t('tickerName'), dataIndex: 'name', key: 'name'},
        {
            title: t('status'),
            dataIndex: 'is_active',
            key: 'status',
            render: (active: boolean | undefined) => active === undefined
                ? <Tag>{t('unknown')}</Tag>
                : <Tag color={active ? 'green' : 'default'}>{active ? t('active') : t('disabled')}</Tag>,
        },
        {
            title: '',
            key: 'actions',
            align: 'right',
            render: (_, ticker) => (
                <Space>
                    <Button onClick={() => {
                        setEditing(ticker);
                        form.setFieldsValue({symbol: ticker.symbol, name: ticker.name, is_active: ticker.is_active ?? true});
                        setCreateOpen(true);
                    }}>{t('edit')}</Button>
                    <Popconfirm
                        title={t('removeTicker')}
                        description={t('deleteTickerQuestion', {symbol: ticker.symbol})}
                        okText={t('delete')}
                        cancelText={t('cancel')}
                        onConfirm={() => deleteTicker.mutate({symbol: ticker.symbol})}
                    >
                        <Button danger loading={deleteTicker.isPending && deleteTicker.variables?.symbol === ticker.symbol}>
                            {t('delete')}
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const onCreate = (values: TickerForm) => {
        if (editing) {
            updateTicker.mutate({symbol: editing.symbol, data: {name: values.name, is_active: values.is_active}});
            return;
        }
        createTicker.mutate({data: {name: values.name, symbol: values.symbol.trim().toUpperCase()}});
    };

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        setCreateOpen(true);
    };

    return (
        <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Typography.Title level={2} className="mb-1">{t('tickerPageTitle')}</Typography.Title>
                    <Typography.Text type="secondary">{t('instrumentsCount', {count: tickers.length})}</Typography.Text>
                </div>
                <Button type="primary" onClick={openCreate}>{t('addTicker')}</Button>
            </div>
            <Table<TickerRow>
                rowKey="symbol"
                columns={columns}
                dataSource={tickers}
                loading={tickersQuery.isLoading}
                pagination={{pageSize: 10, showSizeChanger: false}}
                locale={{emptyText: tickersQuery.isError ? t('noTickersError') : t('noTickers')}}
            />
            <Modal
                title={editing ? t('editTicker', {symbol: editing.symbol}) : t('newTicker')}
                open={createOpen}
                onCancel={() => {setCreateOpen(false); setEditing(null);}}
                footer={null}
                destroyOnHidden
            >
                <Form<TickerForm> form={form} layout="vertical" onFinish={onCreate}>
                    {!editing && <Form.Item name="symbol" label={t('symbol')} rules={[
                        {required: true, message: t('enterSymbol')},
                        {min: 2, max: 10, message: t('min2Chars')},
                    ]}>
                        <Input maxLength={10} placeholder="BTCUSDT" />
                    </Form.Item>}
                    <Form.Item name="name" label={t('tickerName')} rules={[
                        {required: true, message: t('enterName')},
                        {min: 2, max: 100, message: t('min2NameChars')},
                    ]}>
                        <Input maxLength={100} placeholder="Bitcoin / Tether" />
                    </Form.Item>
                    {editing && <Form.Item name="is_active" label={t('activeLabel')} valuePropName="checked">
                        <Switch />
                    </Form.Item>}
                    <Space className="flex justify-end">
                        <Button onClick={() => {setCreateOpen(false); setEditing(null);}}>{t('cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={createTicker.isPending || updateTicker.isPending}>
                            {editing ? t('save') : t('create')}
                        </Button>
                    </Space>
                </Form>
            </Modal>
        </section>
    );
}

export default TickersPage;