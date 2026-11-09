import Axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

console.log('API_BASE_URL:', API_BASE_URL);

export const AXIOS_INSTANCE = Axios.create({
    baseURL: API_BASE_URL,
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