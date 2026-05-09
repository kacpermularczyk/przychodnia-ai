import React, { useEffect, useState } from "react";
import BackendConnector from "./BackendConnector";
import { Box } from "@mui/material";
import { useForm } from "react-hook-form";
import MyTextField from "./forms/MyTextField";
import Popup from "./Popup"; // ✅ dopasuj ścieżkę

const ListOfVisits = () => {
    const [visits, setVisits] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 🔍 filtry (worker)
    const { control, watch } = useForm();
    const emailFilter = watch("email") || "";
    const dateFilter = watch("date") || "";
    const timeFilter = watch("time") || "";
    const statusFilter = watch("status") || "";
    const predictedDiagnosisFilter = watch("predictedDiagnosis") || "";
    const firstNameFilter = watch("first_name") || "";
    const lastNameFilter = watch("last_name") || "";
    const phoneFilter = watch("phone_number") || "";

    // 🧑‍⚕️ popup doctor
    const [openPopup, setOpenPopup] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState(null);

    const {
        control: doctorControl,
        watch: doctorWatch,
        reset: doctorReset,
    } = useForm({
        defaultValues: { diagnosis: "" },
    });

    const doctorDiagnosis = doctorWatch("diagnosis") || "";
    const [doctorNote, setDoctorNote] = useState("");

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingPayload, setPendingPayload] = useState(null);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const userResponse = await BackendConnector.get("user/");
                setUser(userResponse.data);

                const visitsResponse = await BackendConnector.get("listOfVisits/");
                setVisits(visitsResponse.data);
            } catch (error) {
                console.error("Błąd podczas pobierania danych:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <p>Ładowanie wizyt...</p>;

    const isWorker = user?.groups?.includes("worker");
    const isDoctor = user?.groups?.includes("doctor");

    const translateStatus = (status) => {
        switch (status) {
            case "pending":
                return { text: "Oczekuje", color: "#d4b106" };
            case "accepted":
                return { text: "Zaakceptowano", color: "green" };
            case "rejected":
                return { text: "Odrzucono", color: "red" };
            case "canceled":
                return { text: "Anulowano", color: "orange" };
            case "presence":
                return { text: "Obecność", color: "#1976d2" };
            case "absent":
                return { text: "Nieobecny", color: "#555" };
            default:
                return { text: status, color: "black" };
        }
    };

    const filteredVisits = visits.filter((v) => {
        const predictedDiagnosis = v.predicted_diagnosis?.predicted_diagnosis
            ? v.predicted_diagnosis.predicted_diagnosis.toLowerCase()
            : "brak potencjalnej diagnozy";

        return (
            v.user_email?.toLowerCase().includes(emailFilter.toLowerCase()) &&
            v.user_first_name?.toLowerCase().includes(firstNameFilter.toLowerCase()) &&
            v.user_last_name?.toLowerCase().includes(lastNameFilter.toLowerCase()) &&
            v.user_phone_number?.replace(/-/g, "").includes(phoneFilter.replace(/-/g, "")) &&
            v.date?.toLowerCase().includes(dateFilter.toLowerCase()) &&
            v.time?.toLowerCase().includes(timeFilter.toLowerCase()) &&
            translateStatus(v.status).text?.toLowerCase().includes(statusFilter.toLowerCase()) &&
            predictedDiagnosis.includes(predictedDiagnosisFilter.toLowerCase())
        );
    });

    const handleStatusChange = async (visit, newStatus) => {
        try {
            await BackendConnector.post(`listOfVisits/${visit.id}/update_status/`, {
                status: newStatus,
            });

            setVisits((prev) =>
                prev.map((v) => (v.id === visit.id ? { ...v, status: newStatus } : v))
            );
        } catch (error) {
            console.error("Błąd przy zmianie statusu:", error);
        }
    };

    const formatPhone = (number) => {
        if (!number) return "brak";
        return number.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
    };

    // 🧑‍⚕️ doctor: otwieranie / zamykanie popupa
    const handleOpenDoctorPopup = (visit) => {
        if (!isDoctor) return;
        setSelectedVisit(visit);
        doctorReset({ diagnosis: visit.diagnosis || "" });
        setDoctorNote(visit.note || "");
        setOpenPopup(true);
    };

    const handleCloseDoctorPopup = () => {
        setOpenPopup(false);
        setSelectedVisit(null);
        doctorReset({ diagnosis: "" });
        setDoctorNote("");
    };

    // 🧑‍⚕️ doctor: zapis = status presence + opcjonalnie diagnosis/note
    const handleDoctorSave = () => {
        if (!selectedVisit) return;

        const payload = { status: "presence" };

        if (doctorDiagnosis.trim()) payload.diagnosis = doctorDiagnosis.trim();
        if (doctorNote.trim()) payload.note = doctorNote.trim();

        const hasPredictedDiagnosis =
            !!selectedVisit.predicted_diagnosis?.predicted_diagnosis;

        if (hasPredictedDiagnosis) {
            // ⏸️ czekamy na odpowiedź z popupa
            setPendingPayload(payload);
            setConfirmOpen(true);
            return;
        }

        // brak potencjalnej diagnozy → normalny zapis
        sendDoctorUpdate(payload);
    };

    const sendDoctorUpdate = async (payload) => {
        try {
            await BackendConnector.post(
                `listOfVisits/${selectedVisit.id}/update_status/`,
                payload
            );

            setVisits((prev) =>
                prev.map((v) =>
                    v.id === selectedVisit.id
                        ? {
                            ...v,
                            status: "presence",
                            ...(payload.diagnosis !== undefined ? { diagnosis: payload.diagnosis } : {}),
                            ...(payload.note !== undefined ? { note: payload.note } : {}),
                        }
                        : v
                )
            );

            handleCloseDoctorPopup();
        } catch (error) {
            console.error("Błąd przy zapisie (doctor):", error);
        }
    };


    const isReadOnly =
        selectedVisit &&
        ["presence", "absent", "apsent"].includes(selectedVisit.status);

    return (
        <div>
            {/* 👇 pola wyszukiwania tylko dla grupy worker */}
            <>
                {(isWorker || isDoctor) && (
                    <Box sx={{ mb: 3, display: "flex", gap: 2 }}>
                        <MyTextField label="Szukaj po imieniu" name="first_name" control={control} />
                        <MyTextField label="Szukaj po nazwisku" name="last_name" control={control} />
                        <MyTextField label="Szukaj po e-mailu" name="email" control={control} />
                        <MyTextField label="Szukaj po telefonie" name="phone_number" control={control} />
                    </Box>
                )}

                <Box sx={{ mb: 3, display: "flex", gap: 2 }}>
                    <MyTextField label="Szukaj po dacie" name="date" control={control} />
                    <MyTextField label="Szukaj po godzinie" name="time" control={control} />
                    <MyTextField label="Szukaj po statusie" name="status" control={control} />
                    <MyTextField label="Szukaj po pot. diagnozie" name="predictedDiagnosis" control={control} />
                </Box>
            </>

            {filteredVisits.length === 0 ? (
                <p><b>Brak wizyt spełniających kryteria.</b></p>
            ) : (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        mt: 2,
                    }}
                >
                    <ul
                        style={{
                            width: "100%",
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                        }}
                    >
                        {filteredVisits.map((visit, index) => (
                            <Box
                                key={index}
                                onClick={() => handleOpenDoctorPopup(visit)}
                                sx={{
                                    background: "white",
                                    p: 3,
                                    borderRadius: 2,
                                    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
                                    mb: 3,
                                    width: "100%",
                                    cursor: isDoctor ? "pointer" : "default",
                                }}
                            >
                                <p>
                                    <b>Wizyta {index + 1}</b>{" "}
                                    {(() => {
                                        const { text, color } = translateStatus(visit.status);
                                        return (
                                            <span style={{ color, fontWeight: "bold" }}>
                                                ({text})
                                            </span>
                                        );
                                    })()}
                                </p>

                                {(isWorker || isDoctor) && (
                                    visit.user_is_guest ? (
                                        <p>
                                            Pacjent bez konta: <b>{visit.user_first_name} {visit.user_last_name}</b>
                                        </p>
                                    ) : (
                                        <p>
                                            Użytkownik: <b>{visit.user_first_name} {visit.user_last_name} ({visit.user_email})</b>
                                        </p>
                                    )
                                )}

                                {(isWorker || isDoctor) && (
                                    <p>
                                        Telefon: <b>{formatPhone(visit?.user_phone_number)}</b>
                                    </p>
                                )}

                                <p>
                                    dnia <b>{visit.date}</b> o godzinie <b>{visit.time}</b>
                                </p>

                                <p>
                                    Potencjalna diagnoza:{" "}
                                    <b>
                                        {visit.predicted_diagnosis?.predicted_diagnosis ||
                                            "Brak potencjalnej diagnozy"}
                                    </b>
                                </p>

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        marginTop: "12px",
                                        justifyContent: "flex-start",
                                    }}
                                >
                                    {/* 🟡 pending → zaakceptuj / odrzuć (tylko worker) */}
                                    {visit.status === "pending" && isWorker && (() => {
                                        const visitDateTime = new Date(`${visit.date}T${visit.time}`);
                                        const now = new Date();
                                        const canAccept = visitDateTime > now;

                                        return (
                                            <>
                                                {canAccept && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleStatusChange(visit, "accepted");
                                                        }}
                                                        style={{
                                                            backgroundColor: "green",
                                                            color: "white",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            padding: "8px 14px",
                                                            cursor: "pointer",
                                                            transition: "0.3s",
                                                            fontSize: "16px",
                                                        }}
                                                    >
                                                        Zaakceptuj
                                                    </button>
                                                )}

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStatusChange(visit, "rejected");
                                                    }}
                                                    style={{
                                                        backgroundColor: "red",
                                                        color: "white",
                                                        border: "none",
                                                        borderRadius: "6px",
                                                        padding: "8px 14px",
                                                        cursor: "pointer",
                                                        transition: "0.3s",
                                                        fontSize: "16px",
                                                    }}
                                                >
                                                    Odrzuć
                                                </button>
                                            </>
                                        );
                                    })()}

                                    {/* 🔵 accepted LUB pending → Anuluj (dla każdego) */}
                                    {(visit.status === "accepted" || visit.status === "pending") && !isDoctor && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStatusChange(visit, "canceled");
                                            }}
                                            style={{
                                                backgroundColor: "orange",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "6px",
                                                padding: "8px 14px",
                                                cursor: "pointer",
                                                transition: "0.3s",
                                                fontSize: "16px",
                                            }}
                                        >
                                            Anuluj
                                        </button>
                                    )}
                                </div>
                            </Box>
                        ))}
                    </ul>
                </Box>
            )}

            {/* 🧑‍⚕️ POPUP doctor */}
            {openPopup && isDoctor && selectedVisit && (
                <Popup title={`Wizyta dnia ${selectedVisit.date} ${selectedVisit.time}`} onClose={handleCloseDoctorPopup}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                        {/* 🔒 TRYB PODGLĄDU */}
                        {isReadOnly ? (
                            <>
                                <div style={{ textAlign: "left" }}>
                                    <p><b>Diagnoza:</b></p>
                                    <p>
                                        {selectedVisit.diagnosis || "Brak diagnozy"}
                                    </p>
                                </div>

                                <div style={{ textAlign: "left" }}>
                                    <p><b>Notatka:</b></p>
                                    <p
                                        style={{
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word",
                                            overflowWrap: "break-word"
                                        }}
                                    >
                                        {selectedVisit.note || "Brak notatki"}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* ✏️ TRYB EDYCJI */}
                                <MyTextField
                                    label="Diagnoza"
                                    name="diagnosis"
                                    control={doctorControl}
                                />

                                <textarea
                                    value={doctorNote}
                                    onChange={(e) => setDoctorNote(e.target.value)}
                                    placeholder="Notatka"
                                    rows={7}
                                    style={{
                                        width: "100%",
                                        borderRadius: "10px",
                                        padding: "12px",
                                        border: "1px solid #ccc",
                                        fontSize: "16px",
                                        resize: "vertical",
                                    }}
                                />

                                <button
                                    onClick={handleDoctorSave}
                                    style={{
                                        backgroundColor: "#1976d2",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "10px 16px",
                                        cursor: "pointer",
                                        fontSize: "16px",
                                        fontWeight: "600",
                                    }}
                                >
                                    Zapisz
                                </button>

                                <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>
                                    Możesz kliknąć „Zapisz” bez wpisywania diagnozy/notatki — wtedy tylko {" "}
                                    <b>potwierdzisz</b> obecność pacjenta na wizycie.
                                </p>
                            </>
                        )}
                    </div>

                </Popup>
            )}

            {confirmOpen && (
                <Popup
                    title="Potwierdzenie diagnozy"
                    onClose={() => setConfirmOpen(false)}
                >
                    <p>
                        Czy potencjalna diagnoza{" "}
                        <b>
                            {selectedVisit?.predicted_diagnosis?.predicted_diagnosis}
                        </b>{" "}
                        zgadzała się z diagnozą wystawioną przez lekarza?
                    </p>

                    <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "16px" }}>
                        <button
                            onClick={() => {
                                sendDoctorUpdate({ ...pendingPayload, is_same: true });
                                setConfirmOpen(false);
                            }}
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
                        >
                            Tak
                        </button>

                        <button
                            onClick={() => {
                                sendDoctorUpdate({ ...pendingPayload, is_same: false });
                                setConfirmOpen(false);
                            }}
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
                        >
                            Nie
                        </button>
                    </div>
                </Popup>
            )}

        </div>
    );
};

export default ListOfVisits;
