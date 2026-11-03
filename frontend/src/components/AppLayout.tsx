import {Button, Layout, Menu, Space, Typography} from 'antd';
import {useQueryClient} from '@tanstack/react-query';
import {Link, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {useAuthStore} from '../store/useAuthStore';

const {Header, Content} = Layout;

function AppLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const username = useAuthStore((state) => state.username);
    const logout = useAuthStore((state) => state.logout);

    const handleLogout = () => {
        logout();
        queryClient.clear();
        navigate('/login', {replace: true});
    };

    return (
        <Layout className="min-h-screen">
            <Header className="flex items-center justify-between gap-5 border-b border-slate-200 bg-white px-6">
                <Link to="/dashboard" className="whitespace-nowrap text-lg font-semibold text-slate-900">FRTD</Link>
                <Menu
                    mode="horizontal"
                    selectedKeys={[location.pathname]}
                    className="min-w-0 flex-1 border-0"
                    items={[
                        {key: '/dashboard', label: <Link to="/dashboard">Обзор</Link>},
                        {key: '/tickers', label: <Link to="/tickers">Тикеры</Link>},
                    ]}
                />
                <Space>
                    <Typography.Text className="hidden sm:inline">{username ?? 'Пользователь'}</Typography.Text>
                    <Button onClick={handleLogout}>Выйти</Button>
                </Space>
            </Header>
            <Content className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <Outlet />
            </Content>
        </Layout>
    );
}

export default AppLayout;