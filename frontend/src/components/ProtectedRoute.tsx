import {Navigate, Outlet} from 'react-router-dom';
import {useAuthStore} from '../store/useAuthStore';

function ProtectedRoute() {
    const token = useAuthStore((state) => state.token);
    return token ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;