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

interface TickerRow {
    symbol: string;
    name: string;
    is_active?: boolean;
}

type TickerForm = TickerCreate & {is_active: boolean};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseTickerRows(value: unknown): TickerRow[] {
    const candidates = Array.isArray(value)
        ? value
        : isRecord(value) && Array.isArray(value.items)
            ? value.items
            : isRecord(value) && Array.isArray(value.tickers)
                ? value.tickers
            : [];

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

    const createTicker = useCreateTickerCreatePost({
        mutation: {
            onSuccess: () => {
                message.success('Тикер добавлен');
                setCreateOpen(false);
                form.resetFields();
                void refreshTickers();
            },
            onError: () => message.error('Не удалось добавить тикер'),
        },
    });
    const deleteTicker = useDeleteTickerSymbolDelete({
        mutation: {
            onSuccess: () => {
                message.success('Тикер удалён');
                void refreshTickers();
            },
            onError: () => message.error('Не удалось удалить тикер'),
        },
    });
    const updateTicker = useUpdateTickerSymbolPatch({
        mutation: {
            onSuccess: () => {
                message.success('Тикер обновлён');
                setCreateOpen(false);
                setEditing(null);
                form.resetFields();
                void refreshTickers();
            },
            onError: () => message.error('Не удалось обновить тикер'),
        },
    });

    const columns: TableProps<TickerRow>['columns'] = [
        {title: 'Символ', dataIndex: 'symbol', key: 'symbol'},
        {title: 'Название', dataIndex: 'name', key: 'name'},
        {
            title: 'Статус',
            dataIndex: 'is_active',
            key: 'status',
            render: (active: boolean | undefined) => active === undefined
                ? <Tag>Неизвестен</Tag>
                : <Tag color={active ? 'green' : 'default'}>{active ? 'Активен' : 'Отключён'}</Tag>,
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
                    }}>Изменить</Button>
                    <Popconfirm
                        title="Удалить тикер?"
                        description={`Будет удалён ${ticker.symbol}.`}
                        okText="Удалить"
                        cancelText="Отмена"
                        onConfirm={() => deleteTicker.mutate({symbol: ticker.symbol})}
                    >
                        <Button danger loading={deleteTicker.isPending && deleteTicker.variables?.symbol === ticker.symbol}>
                            Удалить
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
                    <Typography.Title level={2} className="mb-1">Тикеры</Typography.Title>
                    <Typography.Text type="secondary">{tickers.length} инструментов</Typography.Text>
                </div>
                <Button type="primary" onClick={openCreate}>Добавить тикер</Button>
            </div>
            <Table<TickerRow>
                rowKey="symbol"
                columns={columns}
                dataSource={tickers}
                loading={tickersQuery.isLoading}
                pagination={{pageSize: 10, showSizeChanger: false}}
                locale={{emptyText: tickersQuery.isError ? 'Не удалось загрузить тикеры' : 'Тикеров пока нет'}}
            />
            <Modal
                title={editing ? `Изменить ${editing.symbol}` : 'Новый тикер'}
                open={createOpen}
                onCancel={() => {setCreateOpen(false); setEditing(null);}}
                footer={null}
                destroyOnHidden
            >
                <Form<TickerForm> form={form} layout="vertical" onFinish={onCreate}>
                    {!editing && <Form.Item name="symbol" label="Символ" rules={[
                        {required: true, message: 'Укажите символ'},
                        {min: 2, max: 10, message: 'От 2 до 10 символов'},
                    ]}>
                        <Input maxLength={10} placeholder="BTCUSDT" />
                    </Form.Item>}
                    <Form.Item name="name" label="Название" rules={[
                        {required: true, message: 'Укажите название'},
                        {min: 2, max: 100, message: 'От 2 до 100 символов'},
                    ]}>
                        <Input maxLength={100} placeholder="Bitcoin / Tether" />
                    </Form.Item>
                    {editing && <Form.Item name="is_active" label="Активен" valuePropName="checked">
                        <Switch />
                    </Form.Item>}
                    <Space className="flex justify-end">
                        <Button onClick={() => {setCreateOpen(false); setEditing(null);}}>Отмена</Button>
                        <Button type="primary" htmlType="submit" loading={createTicker.isPending || updateTicker.isPending}>
                            {editing ? 'Сохранить' : 'Создать'}
                        </Button>
                    </Space>
                </Form>
            </Modal>
        </section>
    );
}

export default TickersPage;