import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'admin' | 'user' | null;

interface AuthState {
    token: string | null;
    role: UserRole;
    username: string | null;
    setAuth: (token: string, role?: UserRole, username?: string | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            role: null,
            username: null,

            setAuth: (token: string, role: UserRole = null, username: string | null = null) =>
                set({
                    token,
                    role,
                    username,
                }),

            logout: () =>
                set({
                    token: null,
                    role: null,
                    username: null,
                }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);