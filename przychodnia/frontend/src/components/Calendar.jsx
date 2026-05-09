import * as React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import dayjs from 'dayjs';

export default function Calendar({ onChange }) {
    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateCalendar
                onChange={onChange}
                minDate={dayjs()}
                maxDate={dayjs().add(30, 'day')}
                sx={{
                    border: '2px solid #1976d2',           // 🔵 niebieski border
                    borderRadius: '16px',
                    backgroundColor: '#f0f6ff',           // jasne niebieskawe tło
                    padding: '12px',
                    boxShadow: '0 3px 10px rgba(25, 118, 210, 0.15)', // delikatny cień
                    mx: 'auto',
                    mt: 2,
                    transform: 'scale(2)',
                    transformOrigin: 'top center',

                    // 🔹 Styl dni
                    '.MuiPickersDay-root': {
                        color: '#0d47a1',                  // ciemnoniebieskie liczby
                        fontWeight: 500,
                        '&.Mui-selected': {
                            backgroundColor: '#1976d2',    // niebieski przy wyborze
                            color: '#fff',
                            '&:hover': {
                                backgroundColor: '#1565c0',
                            },
                        },
                        '&:hover': {
                            backgroundColor: '#e3f2fd',    // jasny niebieski po najechaniu
                        },
                    },

                    // 🔹 Styl nagłówka (miesiąc i strzałki)
                    '.MuiPickersCalendarHeader-label': {
                        color: '#0d47a1',
                        fontWeight: 'bold',
                    },
                    '.MuiPickersArrowSwitcher-button': {
                        color: '#1976d2',
                        '&.Mui-disabled': {
                            color: '#90a4ae', // 🔸 szary dla zablokowanego przycisku
                            opacity: 0.7,
                            cursor: 'not-allowed',
                        },
                    },
                }}
            />
        </LocalizationProvider>
    );
}
