import { Box, Typography } from "@mui/material";

const MyMessage = ({ title, text, bgColor = 'rgba(0, 0, 0, 0.7)' }) => {
    return (
        <Box
            sx={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                width: '90%',
                maxWidth: '400px', // 👈 stała maksymalna szerokość
                backgroundColor: bgColor,
                color: '#fff',
                padding: '16px 20px',
                borderRadius: '5px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                animation: 'slideFromRight 0.6s ease-out forwards',
                '@keyframes slideFromRight': {
                    '0%': {
                        transform: 'translateX(150%)',
                        opacity: 0,
                    },
                    '100%': {
                        transform: 'translateX(0)',
                        opacity: 1,
                    },
                },
            }}
        >
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    textAlign: 'left',
                }}
            >
                {title}
            </Typography>
            <Typography
                variant="body2"
                sx={{
                    opacity: 0.9,
                    fontSize: '0.95rem',
                    lineHeight: 1.4,
                    textAlign: 'left',
                }}
            >
                {text}
            </Typography>
        </Box>
    );
};

export default MyMessage;
