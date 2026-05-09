import '../App.css'
import { Box } from '@mui/material'
import MyTextField from './forms/MyTextField'
import MyPasswordField from './forms/MyPasswordField'
import MyButton from './forms/MyButton'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import BackendConnector from './BackendConnector'
import { useNavigate } from 'react-router-dom'
import MyMessage from './Message'
import { useState } from 'react'

const Login = () => {
    const navigate = useNavigate()
    const { handleSubmit, control } = useForm()
    const [showMessage, setShowMessage] = useState(false)

    const submission = (data) => {
        BackendConnector.post(
            `login/`, {
            email: data.email,
            password: data.password,
        })
            .then((response) => {
                console.log(response)
                localStorage.setItem('Token', response.data.token)
                navigate(`/book-appointment`)
            })
            .catch((error) => {
                setShowMessage(true)
                console.log("Błąd logowania", error)
                setTimeout(() => setShowMessage(false), 4000)
            })
    }

    return (
        <div className={"loginRegBg"}>

            {showMessage ? (
                <MyMessage
                    title="Błąd logowania"
                    text="Wystąpił problem podczas logowania"
                    bgColor="rgba(220, 53, 69, 0.9)"
                />
            ) : null}

            <form onSubmit={handleSubmit(submission)}>

                <Box className={"mainBox"}>

                    <Box className={"itemBox"}>
                        <Box className={"title"}>
                            Logowanie
                        </Box>
                    </Box>

                    <Box className={"itemBox"}>
                        <MyTextField
                            label={"Email"}
                            name={"email"}
                            control={control}
                        />
                    </Box>

                    <Box className={"itemBox"}>
                        <MyPasswordField
                            label={"Hasło"}
                            name={"password"}
                            control={control}
                        />
                    </Box>

                    <Box className={"itemBox"}>
                        <MyButton
                            type={"submit"}
                            label={"Zaloguj się"}
                        />
                    </Box>

                    <Box className={"itemBox"}>
                        <Link to="/Register">Nie masz konta? Zarejestruj się!</Link>
                    </Box>

                </Box>

            </form>

        </div>
    )
}

export default Login