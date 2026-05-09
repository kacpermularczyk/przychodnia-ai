import '../App.css'
import { Box } from '@mui/material'
import MyTextField from './forms/MyTextField'
import MyPasswordField from './forms/MyPasswordField'
import MyButton from './forms/MyButton'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import BackendConnector from './BackendConnector'
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"

const Register = () => {
    const navigate = useNavigate()

    // 🔹 Schemat walidacji
    const schema = yup.object({
        first_name: yup.string().required("Imię jest wymagane"),
        last_name: yup.string().required("Nazwisko jest wymagane"),
        phone_number: yup.string()
            .matches(/^\d{9}$/, "Numer telefonu musi składać się z dokładnie 9 cyfr")
            .required("Numer telefonu jest wymagany"),
        email: yup.string().email("Niepoprawny adres e-mail").required("Email jest wymagany"),
        password: yup.string()
            .required("Hasło jest wymagane")
            .min(7, "Hasło musi mieć minimum 7 znaków")
            .matches(/[A-Z]/, "Hasło musi mieć minimum jedną dużą literę")
            .matches(/[a-z]/, "Hasło musi mieć minimum jedną małą literę")
            .matches(/[0-9]/, "Hasło musi mieć minimum jedną cyfrę")
            .matches(/[!@#$%^&*(),.?\":{}|<>]/, "Hasło musi mieć minimum jeden znak specjalny"),
        password2: yup.string()
            .required("Potwierdzenie hasła jest wymagane")
            .oneOf([yup.ref("password"), null], "Hasła muszą się zgadzać"),
    });

    const { handleSubmit, control, setError } = useForm({
        resolver: yupResolver(schema),
    });

    // 🔹 Funkcja wysyłająca dane do backendu
    const submission = async (data) => {
        try {
            await BackendConnector.post("register/", {
                email: data.email,
                password: data.password,
                first_name: data.first_name,
                last_name: data.last_name,
                phone_number: data.phone_number,
            });
            navigate("/login");
        } catch (error) {
            // 🔹 Błąd emaila
            if (error.response?.data?.email) {
                let message = error.response.data.email[0];
                if (message.toLowerCase().includes("already exists")) {
                    message = "Użytkownik z tym adresem e-mail już istnieje.";
                }
                setError("email", {
                    type: "server",
                    message: message,
                });
            }

            // 🔹 Błąd numeru telefonu
            if (error.response?.data?.phone_number) {
                let message = error.response.data.phone_number[0];
                if (message.toLowerCase().includes("already exists")) {
                    message = "Użytkownik z tym numerem telefonu już istnieje.";
                }
                setError("phone_number", {
                    type: "server",
                    message: message,
                });
            }

            if (error.response?.data?.error) {
                const msg = error.response.data.error;

                setError("phone_number", {
                    type: "server",
                    message: msg,
                });

                setError("first_name", {
                    type: "server",
                    message: msg,
                });

                setError("last_name", {
                    type: "server",
                    message: msg,
                });
            }
        }
    };

    return (
        <div className="loginRegBg">
            <form onSubmit={handleSubmit(submission)}>
                <Box className="mainBox">
                    <Box className="itemBox">
                        <Box className="title">
                            Rejestracja
                        </Box>
                    </Box>

                    <Box className="gridBox">
                        <MyTextField label="Imię" name="first_name" control={control} />
                        <MyTextField label="Nazwisko" name="last_name" control={control} />
                        <MyTextField label="Email" name="email" control={control} />
                        <MyTextField label="Numer telefonu" name="phone_number" control={control} />
                        <MyPasswordField label="Hasło" name="password" control={control} />
                        <MyPasswordField label="Potwierdź hasło" name="password2" control={control} />
                    </Box>


                    <Box className="itemBox">
                        <MyButton type="submit" label="Zarejestruj się" />
                    </Box>

                    <Box className="itemBox">
                        <Link to="/login">Masz już konto? Zaloguj się!</Link>
                    </Box>
                </Box>
            </form>
        </div>
    );
};

export default Register;
