import React, { useEffect, useState } from "react";
import BackendConnector from "./BackendConnector";
import Calendar from "./Calendar";
import Popup from "./Popup";
import MyMessage from "./Message";
import "./Home.css";
import { useForm } from "react-hook-form";
import MyTextField from "./forms/MyTextField";
import logo from "../assets/logo.png";

const BookAppointment = () => {
    const [selectedDate, setSelectedDate] = useState(null);
    const [visits, setVisits] = useState([]);
    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState(null);
    const [showFormPopup, setShowFormPopup] = useState(false);
    const [selectedTime, setSelectedTime] = useState(null);
    const [formData, setFormData] = useState({});
    const [features, setFeatures] = useState([]);
    const [showChoicePopup, setShowChoicePopup] = useState(false);
    const [user, setUser] = useState(null);
    const [showWorkerPopup, setShowWorkerPopup] = useState(false);
    const isWorker = user?.groups?.includes("worker");

    const { control, watch } = useForm({
        defaultValues: { search: "" },
    });

    const {
        control: workerControl,
        handleSubmit: handleWorkerSubmit,
        reset: resetWorkerForm
    } = useForm({
        defaultValues: {
            first_name: "",
            last_name: "",
            phone: "",
        }
    });


    // 🔹 Pobierz cechy z backendu po załadowaniu
    useEffect(() => {
        const fetchFeatures = async () => {
            try {
                const { data } = await BackendConnector.get("features/");
                setFeatures(data.features || []);
            } catch (error) {
                console.error("❌ Błąd pobierania cech:", error);
            }
        };
        fetchFeatures();
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userResponse = await BackendConnector.get("user/");
                setUser(userResponse.data);
            } catch (error) {
                console.error("❌ Błąd pobierania usera:", error);
            }
        };

        fetchUser();
    }, []);


    useEffect(() => {
        document.body.style.overflow =
            showPopup || showFormPopup || showChoicePopup ? "hidden" : "auto";
        return () => (document.body.style.overflow = "auto");
    }, [showPopup, showFormPopup, showChoicePopup]);

    const timeSlots = [
        "08:00", "08:30", "09:00", "09:30",
        "10:00", "10:30", "11:00", "11:30",
        "12:00", "12:30", "13:00", "13:30",
        "14:00", "14:30"
    ];

    const handleDateChange = async (newDate) => {
        const formattedDate = newDate.format("YYYY-MM-DD");
        setSelectedDate(formattedDate);
        await fetchVisits(formattedDate);
    };

    const fetchVisits = async (date, silent = false) => {
        try {
            const { data } = await BackendConnector.get(`visits/?date=${date}`);
            setVisits(data);

            if (!silent) {  // 👈 tylko jeśli nie jest tryb cichy
                setShowPopup(true);
            }
        } catch (error) {
            console.error("❌ Błąd pobierania wizyt:", error);
        }
    };

    const handleBook = (time) => {
        setSelectedTime(time);
        setShowPopup(false);

        if (isWorker) {
            setShowWorkerPopup(true);   // 👉 pracownik dostaje formularz danych pacjenta
        } else {
            setShowChoicePopup(true);   // 👉 zwykły user — popup z wyborem
        }
    };


    const handleCheckboxChange = (feature) => {
        setFormData((prev) => ({
            ...prev,
            [feature]: !prev[feature],
        }));
    };

    const handleSubmit = async () => {
        try {
            const { data } = await BackendConnector.post("visits/", {
                date: selectedDate,
                time: selectedTime,
                symptoms: formData,
            });

            // 🧠 Pobieramy diagnozę z odpowiedzi backendu
            const diagnosis = data.predicted_diagnosis?.predicted_diagnosis;

            setMessage(
                diagnosis
                    ? {
                        title: "Wizyta zarezerwowana!",
                        text: `Przewidywana diagnoza: ${diagnosis}`,
                        color: "rgba(40, 167, 69, 0.9)",
                    }
                    : {
                        title: "Sukces!",
                        text: "Wizyta została zarezerwowana!",
                        color: "rgba(40, 167, 69, 0.9)",
                    }
            );

            setShowFormPopup(false);
            await fetchVisits(selectedDate, true);
            setShowPopup(false);
        } catch (error) {
            console.error("Błąd rezerwacji:", error);
            setMessage({
                title: "Błąd!",
                text: "Wystąpił problem z rezerwacją wizyty.",
                color: "rgba(220, 53, 69, 0.9)",
            });
        }

        setTimeout(() => setMessage(null), 7000);
    };


    const isTimeBooked = (time) =>
        visits.some(v => v.time && v.time.slice(0, 5) === time);

    const searchValue = watch("search");
    const filteredFeatures = features.filter((feature) =>
        feature.toLowerCase().includes(searchValue.toLowerCase())
    );

    const isPastTime = (time) => {
        if (!selectedDate) return false;

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

        // jeśli to nie dzisiaj → nie jest przeszłe
        if (selectedDate !== todayStr) return false;

        // Parsowanie godziny slotu
        const [hh, mm] = time.split(":").map(Number);

        const slotDate = new Date();
        slotDate.setHours(hh, mm, 0, 0);

        return slotDate < now; // true jeśli czas minął
    };

    return (
        <div className="home">
            {message && (
                <MyMessage
                    title={message.title}
                    text={message.text}
                    bgColor={message.color}
                />
            )}

            {/* Popup z godzinami */}
            {showPopup && (
                <Popup
                    title={`🗓 Wizyty dnia: ${selectedDate}`}
                    onClose={() => setShowPopup(false)}
                >
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>🕒 Godzina</th>
                                <th style={styles.th}>👤 Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timeSlots.map((time) => {
                                const booked = isTimeBooked(time);
                                return (
                                    <tr key={time}>
                                        <td style={styles.td}>{time}</td>
                                        <td style={styles.td}>
                                            {booked ? (
                                                <span style={{ color: "#d00000", fontWeight: "bold" }}>
                                                    zajęte
                                                </span>
                                            ) : isPastTime(time) ? (
                                                <span style={{ color: "#d00000", fontWeight: "bold" }}>
                                                    niedostępne
                                                </span>
                                            ) : (
                                                <button
                                                    style={styles.button}
                                                    onClick={() => handleBook(time)}
                                                >
                                                    wolne
                                                </button>
                                            )}

                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Popup>
            )}








            {showWorkerPopup && (
                <Popup
                    title="Dane pacjenta"
                    onClose={() => setShowWorkerPopup(false)}
                >
                    <form
                        onSubmit={handleWorkerSubmit(async (data) => {
                            try {
                                const response = await BackendConnector.post("visits/", {
                                    date: selectedDate,
                                    time: selectedTime,
                                    first_name: data.first_name,
                                    last_name: data.last_name,
                                    phone: data.phone,
                                    symptoms: {}, // worker zapisuje bez objawów
                                });

                                setMessage({
                                    title: "Wizyta zapisana!",
                                    text: "Pacjent został zapisany na wizytę.",
                                    color: "rgba(40, 167, 69, 0.9)",
                                });

                                setShowWorkerPopup(false);
                                resetWorkerForm();
                                await fetchVisits(selectedDate, true);
                            } catch (error) {
                                console.error("Błąd rezerwacji:", error);
                                setMessage({
                                    title: "Błąd!",
                                    text: "Nie udało się zapisać wizyty.",
                                    color: "rgba(220, 53, 69, 0.9)",
                                });
                            }

                            setTimeout(() => setMessage(null), 7000);
                        })}
                        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
                    >
                        <MyTextField
                            control={workerControl}
                            name="first_name"
                            label="Imię"
                        />

                        <MyTextField
                            control={workerControl}
                            name="last_name"
                            label="Nazwisko"
                        />

                        <MyTextField
                            control={workerControl}
                            name="phone"
                            label="Telefon (9 cyfr)"
                        />

                        <button
                            type="submit"
                            style={styles.submitButton}
                        >
                            Zapisz na wizytę
                        </button>
                    </form>
                </Popup>
            )}











            {showChoicePopup && (
                <Popup
                    title={`🤔 Czy chcesz uzyskać potencjalną diagnozę?`}
                    onClose={() => setShowChoicePopup(false)}
                >
                    <div style={{ textAlign: "center", fontSize: "18px" }}>

                        <hr />

                        <p class="popup-choice-text">
                            Możesz zarezerwować wizytę z podaniem objawów lub bez nich.
                            Jeśli zdecydujesz się wypełnić formularz objawów, nasz system spróbuje przewidzieć
                            potencjalną diagnozę na podstawie wprowadzonych danych.
                            <br /><br />
                            Zaznaczając tę opcję, wyrażasz zgodę na przetwarzanie podanych informacji medycznych
                            w celu poprawy jakości usług oraz dalszego uczenia algorytmu diagnostycznego.
                            Dane zostaną zapisane w naszej bazie danych i będą widoczne wyłącznie dla
                            lekarza prowadzącego oraz upoważnionych pracowników przychodni.
                            <br /><br />
                            Możesz również zarezerwować wizytę bez wypełniania formularza – w takim przypadku
                            system nie przetworzy żadnych danych zdrowotnych.
                        </p>

                        <hr />

                        <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "25px" }}>
                            <button
                                style={{
                                    backgroundColor: "#28a745",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 18px",
                                    fontSize: "16px",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                }}
                                onClick={() => {
                                    setShowChoicePopup(false);
                                    setShowFormPopup(true); // 👉 idziemy do formularza objawów
                                }}
                            >
                                Tak
                            </button>
                            <button
                                style={{
                                    backgroundColor: "#d00000",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 18px",
                                    fontSize: "16px",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                }}
                                onClick={async () => {
                                    setShowChoicePopup(false);
                                    // 👉 rezerwujemy bez objawów
                                    try {
                                        const { data } = await BackendConnector.post("visits/", {
                                            date: selectedDate,
                                            time: selectedTime,
                                            symptoms: {},
                                        });

                                        setMessage({
                                            title: "Wizyta zarezerwowana!",
                                            text: "Wizyta została zapisana bez podania objawów.",
                                            color: "rgba(40, 167, 69, 0.9)",
                                        });

                                        await fetchVisits(selectedDate, true);
                                    } catch (error) {
                                        console.error("Błąd rezerwacji:", error);
                                        setMessage({
                                            title: "Błąd!",
                                            text: "Nie udało się zarezerwować wizyty.",
                                            color: "rgba(220, 53, 69, 0.9)",
                                        });
                                    }

                                    setTimeout(() => setMessage(null), 7000);
                                }}
                            >
                                Nie
                            </button>
                        </div>
                    </div>
                </Popup>
            )
            }




            {/* Popup z formularzem objawów */}
            {
                showFormPopup && (
                    <Popup
                        title={`🦷 Formularz objawów (${selectedDate} • ${selectedTime})`}
                        onClose={() => setShowFormPopup(false)}
                    >
                        {features.length === 0 ? (
                            <p>Ładowanie listy objawów...</p>
                        ) : (
                            <form style={styles.form}>
                                {/* 🔎 Pole wyszukiwania objawów */}
                                <MyTextField
                                    control={control}
                                    name="search"
                                    label="Wyszukaj objaw"
                                />

                                {/* ✅ Lista przefiltrowanych objawów */}
                                {filteredFeatures.length > 0 ? (
                                    filteredFeatures.map((feature) => (
                                        <label key={feature} style={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={formData[feature] || false}
                                                onChange={() => handleCheckboxChange(feature)}
                                            />
                                            {feature}
                                        </label>
                                    ))
                                ) : (
                                    <p style={{ opacity: 0.7, fontStyle: "italic" }}>
                                        Brak wyników wyszukiwania
                                    </p>
                                )}

                                <button
                                    type="button"
                                    style={styles.submitButton}
                                    onClick={handleSubmit}
                                >
                                    Zarezerwuj wizytę
                                </button>
                            </form>
                        )}
                    </Popup>
                )
            }

            {/* Sekcje informacyjne */}
            <header className="header">
                <img
                    src={logo}
                    alt="Logo przychodni"
                    style={{ width: "230px", height: "auto" }}
                />
                <div>
                    <h1>„Twój zdrowy uśmiech”</h1>
                    <p>Gabinet stomatologiczny w Sosnowcu</p>
                </div>
            </header>

            <section className="about">
                <h2>Rezerwacja wizyty</h2>
                <p>
                    Wybierz dzień w kalendarzu który Cię interesuje, pokaże się lista godzin w tym dniu, wybierz tą która Ci odpowiada. Po wybraniu godziny będziesz mógł/mogła od razu zarezerwować wizytę lub wypełnić formularz z objawami. Jeśli wypełnisz formularz dostaniesz potencjalną diagnozę na podstawie podanych objawów. Pomoże nam to udoskonalić algorytm przewidujący choroby. Dziękujemy za korzystanie usług naszej przychodni.
                </p>
            </section>

            <section className="callendar-field">
                <Calendar onChange={handleDateChange} />
            </section>

            <section className="contact">
                <h2>W razie problemów, prosimy o kontakt</h2>
                <p>📍 ul. Ulicowska 25, Sosnowiec</p>
                <p>✉️ kontakt@zdrowyUsmiech.pl</p>
                <p>📞 123 456 789</p>
            </section>

            <footer className="footer">
                <p>Zdjęcie użyte w ramach loga pochodzi z Pixabay.</p>
            </footer>
        </div >
    );
};

// 🎨 Style
const styles = {
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "20px",
    },
    th: {
        backgroundColor: "#007bff",
        color: "#fff",
        padding: "12px",
    },
    td: {
        padding: "12px",
        borderBottom: "1px solid #ccc",
    },
    button: {
        backgroundColor: "#28a745",
        color: "#fff",
        border: "none",
        borderRadius: "6px",
        padding: "8px 14px",
        fontSize: "16px",
        cursor: "pointer",
        fontWeight: "bold",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "10px",
        fontSize: "18px",
    },
    checkboxLabel: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    submitButton: {
        backgroundColor: "#007bff",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: "10px 18px",
        fontSize: "16px",
        fontWeight: "bold",
        cursor: "pointer",
        marginTop: "20px",
        alignSelf: "center",
    },
};

export default BookAppointment;
