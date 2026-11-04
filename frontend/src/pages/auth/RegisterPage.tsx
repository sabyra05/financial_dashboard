import {Button, Card, Form, Input, Typography, message} from 'antd';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {useRegistrateAuthRegistratePost} from '../../api/generated';
import type {UserCreate} from '../../api/generated';
import {useLanguageStore} from '../../store/useLanguageStore';
import {useAuthStore} from '../../store/useAuthStore';

interface RegisterForm extends UserCreate {
    confirmPassword: string;
}

function RegisterPage() {
    const token = useAuthStore((state) => state.token);
    const navigate = useNavigate();
    const t = useLanguageStore((state) => state.t);
    const {mutate: register, isPending} = useRegistrateAuthRegistratePost({
        mutation: {
            onSuccess: () => {
                message.success(t('accountCreated'));
                navigate('/login', {replace: true});
            },
            onError: () => message.error(t('accountCreateFailed')),
        },
    });

    if (token) return <Navigate to="/dashboard" replace />;

    const onFinish = ({username, password}: RegisterForm) => {
        register({data: {username, password, role: 'user'}});
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
            <Card className="w-full max-w-md shadow-sm" variant="borderless">
                <Typography.Title level={2}>{t('registerTitle')}</Typography.Title>
                <Form<RegisterForm> layout="vertical" onFinish={onFinish} requiredMark={false}>
                    <Form.Item name="username" label={t('username')} rules={[
                        {required: true, message: t('enterUsername')},
                        {min: 2, message: t('min2Chars')},
                        {max: 100, message: t('max100Chars')},
                    ]}>
                        <Input autoComplete="username" size="large" />
                    </Form.Item>
                    <Form.Item name="password" label={t('password')} rules={[
                        {required: true, message: t('enterPassword')},
                        {min: 3, message: t('min3Chars')},
                    ]}>
                        <Input.Password autoComplete="new-password" size="large" />
                    </Form.Item>
                    <Form.Item name="confirmPassword" label={t('repeatPassword')} dependencies={['password']} rules={[
                        {required: true, message: t('repeatPassword')},
                        ({getFieldValue}) => ({
                            validator(_, value: string) {
                                return !value || getFieldValue('password') === value
                                    ? Promise.resolve()
                                    : Promise.reject(new Error(t('passwordsMatch')));
                            },
                        }),
                    ]}>
                        <Input.Password autoComplete="new-password" size="large" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={isPending} block size="large">{t('createAccount')}</Button>
                </Form>
                <Typography.Paragraph className="mb-0 mt-5 text-center">
                    {t('alreadyRegistered')} <Link to="/login">{t('loginLink')}</Link>
                </Typography.Paragraph>
            </Card>
        </main>
    );
}

export default RegisterPage;