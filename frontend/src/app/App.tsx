import {ConfigProvider, Spin} from 'antd';
import {createBrowserRouter, Navigate, RouterProvider} from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import {useAuthStore} from '../store/useAuthStore';

const routeFallback = <div className="flex min-h-screen items-center justify-center"><Spin /></div>;

const router = createBrowserRouter([
    {path: '/', element: <RootRedirect />},
    {
        path: '/login',
        hydrateFallbackElement: routeFallback,
        lazy: async () => ({Component: (await import('../pages/auth/LoginPage')).default}),
    },
    {
        path: '/register',
        hydrateFallbackElement: routeFallback,
        lazy: async () => ({Component: (await import('../pages/auth/RegisterPage')).default}),
    },
    {
        element: <ProtectedRoute />,
        children: [{
            element: <AppLayout />,
            children: [
                {
                    path: '/dashboard',
                    hydrateFallbackElement: routeFallback,
                    lazy: async () => ({Component: (await import('../pages/dashboard/DashboardPage')).default}),
                },
                {
                    path: '/tickers',
                    hydrateFallbackElement: routeFallback,
                    lazy: async () => ({Component: (await import('../pages/tickers/TickersPage')).default}),
                },
            ],
        }],
    },
    {path: '*', element: <Navigate to="/" replace />},
]);

function RootRedirect() {
    const token = useAuthStore((state) => state.token);
    return <Navigate to={token ? '/dashboard' : '/login'} replace />;
}

function App() {
    return (
        <ConfigProvider theme={{token: {colorPrimary: '#1677a8', borderRadius: 6, fontSize: 14}}}>
            <RouterProvider router={router} />
        </ConfigProvider>
    );
}

export default App;
