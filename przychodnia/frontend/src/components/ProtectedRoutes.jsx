import { useEffect, useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import BackendConnector from "./BackendConnector";


const useAuthUser = () => {
    const [user, setUser] = useState(null);
    const [initialized, setInitialized] = useState(false);

    const token = localStorage.getItem("Token");

    useEffect(() => {
        if (!token) {
            setInitialized(true);
            return;
        }

        BackendConnector.get("user/")
            .then((res) => setUser(res.data))
            .catch(() => setUser(null))
            .finally(() => setInitialized(true));
    }, [token]);

    return { token, user, initialized };
};


/* ROUTING */


export const GuestRoute = () => {
    const token = localStorage.getItem("Token");
    return token ? <Navigate to="/" replace /> : <Outlet />;
};

export const ProtectedRoute = () => {
    const { token, initialized } = useAuthUser();

    if (!token) return <Navigate to="/login" replace />;
    if (!initialized) return null;

    return <Outlet />;
};

export const AllowGroupsRoute = ({
    allowedGroups = [],
    redirectTo = "/",
}) => {
    const { token, user, initialized } = useAuthUser();

    if (!token) return <Navigate to="/login" replace />;
    if (!initialized) return null;

    const groups = user?.groups ?? [];
    const isAllowed = allowedGroups.some((g) => groups.includes(g));

    if (!isAllowed) return <Navigate to={redirectTo} replace />;

    return <Outlet />;
};

export const BlockGroupsRoute = ({
    blockedGroups = [],
    redirectTo = "/",
}) => {
    const { token, user, initialized } = useAuthUser();

    if (!token) return <Navigate to="/login" replace />;
    if (!initialized) return null;

    const groups = user?.groups ?? [];
    const isBlocked = blockedGroups.some((g) => groups.includes(g));

    if (isBlocked) return <Navigate to={redirectTo} replace />;

    return <Outlet />;
};