import axios from 'axios'

const baseUrl = 'http://127.0.0.1:8000/'

const BackendConnector = axios.create({
    baseURL: baseUrl,
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
        accept: "application/json"
    }
})

BackendConnector.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('Token')
        if (token) {
            config.headers.Authorization = `Token ${token}`
        } else {
            config.headers.Authorization = ``
        }
        return config;
    }
)

BackendConnector.interceptors.response.use(
    (response) => {
        return response
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('Token')
        }

        return Promise.reject(error);
    }
)

export default BackendConnector;