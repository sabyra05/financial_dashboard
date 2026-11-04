import {Button, Card, Form, Input, Typography, message} from 'antd';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {useLoginAuthLoginPost} from '../../api/generated';
import {useLanguageStore} from '../../store/useLanguageStore';
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
    const t = useLanguageStore((state) => state.t);
    const {mutate: login, isPending} = useLoginAuthLoginPost({
        mutation: {
            onSuccess: (response, variables) => {
                const data = response as LoginResponse;
                const accessToken = data?.token ?? data?.access_token;
                if (!accessToken) {
                    message.error(t('authTokenMissing'));
                    return;
                }
                setAuth(accessToken, 'user', variables.data.username);
                message.success(t('loginSuccess'));
                navigate('/dashboard', {replace: true});
            },
            onError: () => message.error(t('loginFailed')),
        },
    });

    if (token) return <Navigate to="/dashboard" replace />;

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
            <Card className="w-full max-w-md shadow-sm" variant="borderless">
                <Typography.Title level={2}>{t('loginTitle')}</Typography.Title>
                <Typography.Paragraph type="secondary">{t('loginSubtitle')}</Typography.Paragraph>
                <Form<LoginForm> layout="vertical" onFinish={(values) => login({data: values})} requiredMark={false}>
                    <Form.Item name="username" label={t('username')} rules={[{required: true, message: t('enterUsername')}]}> 
                        <Input autoComplete="username" size="large" />
                    </Form.Item>
                    <Form.Item name="password" label={t('password')} rules={[{required: true, message: t('enterPassword')}]}> 
                        <Input.Password autoComplete="current-password" size="large" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={isPending} block size="large">{t('loginButton')}</Button>
                </Form>
                <Typography.Paragraph className="mb-0 mt-5 text-center">
                    {t('noAccount')} <Link to="/register">{t('register')}</Link>
                </Typography.Paragraph>
            </Card>
        </main>
    );
}

export default LoginPage;