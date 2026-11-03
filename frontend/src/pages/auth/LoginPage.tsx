import {Button, Card, Form, Input, Typography, message} from 'antd';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {useLoginAuthLoginPost} from '../../api/generated';
import {useAuthStore} from '../../store/useAuthStore';

interface LoginForm {
    username: string;
    password: string;
}

interface LoginResponse {
    token?: string;
    access_token?: string;
}

function LoginPage() {
    const token = useAuthStore((state) => state.token);
    const setAuth = useAuthStore((state) => state.setAuth);
    const navigate = useNavigate();
    const {mutate: login, isPending} = useLoginAuthLoginPost({
        mutation: {
            onSuccess: (response, variables) => {
                const data = response as LoginResponse;
                const accessToken = data?.token ?? data?.access_token;
                if (!accessToken) {
                    message.error('Сервер не вернул токен доступа');
                    return;
                }
                setAuth(accessToken, 'user', variables.data.username);
                message.success('Вход выполнен');
                navigate('/dashboard', {replace: true});
            },
            onError: () => message.error('Не удалось войти. Проверьте логин и пароль.'),
        },
    });

    if (token) return <Navigate to="/dashboard" replace />;

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
            <Card className="w-full max-w-md shadow-sm" variant="borderless">
                <Typography.Title level={2}>Вход</Typography.Title>
                <Typography.Paragraph type="secondary">Войдите, чтобы открыть торговую панель.</Typography.Paragraph>
                <Form<LoginForm> layout="vertical" onFinish={(values) => login({data: values})} requiredMark={false}>
                    <Form.Item name="username" label="Логин" rules={[{required: true, message: 'Введите логин'}]}>
                        <Input autoComplete="username" size="large" />
                    </Form.Item>
                    <Form.Item name="password" label="Пароль" rules={[{required: true, message: 'Введите пароль'}]}>
                        <Input.Password autoComplete="current-password" size="large" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={isPending} block size="large">Войти</Button>
                </Form>
                <Typography.Paragraph className="mb-0 mt-5 text-center">
                    Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
                </Typography.Paragraph>
            </Card>
        </main>
    );
}

export default LoginPage;