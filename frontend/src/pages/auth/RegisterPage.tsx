import {Button, Card, Form, Input, Typography, message} from 'antd';
import {Link, Navigate, useNavigate} from 'react-router-dom';
import {useRegistrateAuthRegistratePost} from '../../api/generated';
import type {UserCreate} from '../../api/generated';
import {useAuthStore} from '../../store/useAuthStore';

interface RegisterForm extends UserCreate {
    confirmPassword: string;
}

function RegisterPage() {
    const token = useAuthStore((state) => state.token);
    const navigate = useNavigate();
    const {mutate: register, isPending} = useRegistrateAuthRegistratePost({
        mutation: {
            onSuccess: () => {
                message.success('Аккаунт создан. Теперь войдите.');
                navigate('/login', {replace: true});
            },
            onError: () => message.error('Не удалось создать аккаунт. Возможно, логин уже занят.'),
        },
    });

    if (token) return <Navigate to="/dashboard" replace />;

    const onFinish = ({username, password}: RegisterForm) => {
        register({data: {username, password, role: 'user'}});
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
            <Card className="w-full max-w-md shadow-sm" variant="borderless">
                <Typography.Title level={2}>Регистрация</Typography.Title>
                <Form<RegisterForm> layout="vertical" onFinish={onFinish} requiredMark={false}>
                    <Form.Item name="username" label="Логин" rules={[
                        {required: true, message: 'Введите логин'},
                        {min: 2, message: 'Минимум 2 символа'},
                        {max: 100, message: 'Максимум 100 символов'},
                    ]}>
                        <Input autoComplete="username" size="large" />
                    </Form.Item>
                    <Form.Item name="password" label="Пароль" rules={[
                        {required: true, message: 'Введите пароль'},
                        {min: 3, message: 'Минимум 3 символа'},
                    ]}>
                        <Input.Password autoComplete="new-password" size="large" />
                    </Form.Item>
                    <Form.Item name="confirmPassword" label="Повторите пароль" dependencies={['password']} rules={[
                        {required: true, message: 'Повторите пароль'},
                        ({getFieldValue}) => ({
                            validator(_, value: string) {
                                return !value || getFieldValue('password') === value
                                    ? Promise.resolve()
                                    : Promise.reject(new Error('Пароли не совпадают'));
                            },
                        }),
                    ]}>
                        <Input.Password autoComplete="new-password" size="large" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={isPending} block size="large">Создать аккаунт</Button>
                </Form>
                <Typography.Paragraph className="mb-0 mt-5 text-center">
                    Уже зарегистрированы? <Link to="/login">Войти</Link>
                </Typography.Paragraph>
            </Card>
        </main>
    );
}

export default RegisterPage;