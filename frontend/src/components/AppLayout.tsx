import {Button, Layout, Menu, Select, Space, Typography} from 'antd';
import {useQueryClient} from '@tanstack/react-query';
import {Link, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {languages, type Language} from '../i18n/translations';
import {useLanguageStore} from '../store/useLanguageStore';
import {useAuthStore} from '../store/useAuthStore';

const {Header, Content} = Layout;

function AppLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const username = useAuthStore((state) => state.username);
    const logout = useAuthStore((state) => state.logout);
    const language = useLanguageStore((state) => state.language);
    const setLanguage = useLanguageStore((state) => state.setLanguage);
    const t = useLanguageStore((state) => state.t);

    const handleLogout = () => {
        logout();
        queryClient.clear();
        navigate('/login', {replace: true});
    };

    return (
        <Layout className="min-h-screen">
            <Header className="flex items-center justify-between gap-5 border-b border-slate-200 bg-white px-6">
                <Link to="/dashboard" className="whitespace-nowrap text-lg font-semibold text-slate-900">{t('appName')}</Link>
                <Menu
                    mode="horizontal"
                    selectedKeys={[location.pathname]}
                    className="min-w-0 flex-1 border-0"
                    items={[
                        {key: '/dashboard', label: <Link to="/dashboard">{t('navOverview')}</Link>},
                        {key: '/tickers', label: <Link to="/tickers">{t('navTickers')}</Link>},
                    ]}
                />
                <Space>
                    <Select<Language>
                        value={language}
                        onChange={(value) => setLanguage(value)}
                        options={languages}
                        style={{width: 120}}
                        popupMatchSelectWidth={false}
                    />
                    <Typography.Text className="hidden sm:inline">{username ?? t('user')}</Typography.Text>
                    <Button onClick={handleLogout}>{t('logout')}</Button>
                </Space>
            </Header>
            <Content className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <Outlet />
            </Content>
        </Layout>
    );
}

export default AppLayout;