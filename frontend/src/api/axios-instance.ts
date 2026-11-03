import Axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const AXIOS_INSTANCE = Axios.create({
    baseURL: 'http://127.0.0.1:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

AXIOS_INSTANCE.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;

        if (token) {
            config.headers.set('token', token);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const customAxiosInstance = <T>(
    config: AxiosRequestConfig,
    options?: AxiosRequestConfig
): Promise<T> => {
    const source = Axios.CancelToken.source();

    const promise = AXIOS_INSTANCE({
        ...config,
        ...options,
        cancelToken: source.token,
    }).then(({ data }: AxiosResponse<T>) => data) as Promise<T> & { cancel: () => void };

    promise.cancel = () => {
        source.cancel('Query was cancelled');
    };

    return promise;
};

export default customAxiosInstance;