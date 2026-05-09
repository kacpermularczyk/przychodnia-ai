import React, { useEffect, useState } from "react";
import BackendConnector from "./BackendConnector";
import "./Home.css";

export default function AiPanel() {
    const [selectedAlgo, setSelectedAlgo] = useState(""); // "nn" | "rf"
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [statsNN, setStatsNN] = useState([]); // [{train_label, count, known_count}]
    const [statsRF, setStatsRF] = useState([]); // [{train_label, count}]
    const [retraining, setRetraining] = useState(false);

    // --- NN inputs state ---
    const [nnValues, setNnValues] = useState({}); // { [label]: number }
    const [savingNN, setSavingNN] = useState(false);

    const fetchAlgorithmAndStats = async () => {
        setLoading(true);
        setError("");
        try {
            const { data } = await BackendConnector.get("system-settings/algorithm/");
            setSelectedAlgo(data.diagnosis_algorithm); // "nn" albo "rf"
            setStatsNN(data.stats_nn ?? []);
            setStatsRF(data.stats_rf ?? []);

            // Init NN input values from stats_nn
            const initNNValues = {};
            (data.stats_nn ?? []).forEach((r) => {
                const label = r.train_label ?? r.predicted_diagnosis;
                if (!label) return;
                const v = Number(r.count);
                initNNValues[label] = Number.isFinite(v) ? v : 0;
            });
            setNnValues(initNNValues);
        } catch (e) {
            console.error("❌ Błąd pobierania algorytmu:", e);
            setError("Nie udało się pobrać aktualnego algorytmu / statystyk.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlgorithmAndStats();
    }, []);

    const saveAlgorithm = async (algo) => {
        setSaving(true);
        setError("");
        setSuccess("");

        try {
            await BackendConnector.put("system-settings/algorithm/", {
                diagnosis_algorithm: algo,
            });
            setSelectedAlgo(algo);
            setSuccess("✅ Zapisano ustawienie algorytmu.");
        } catch (e) {
            console.error("❌ Błąd zapisu algorytmu:", e);

            if (e?.response?.status === 403) {
                setError("Brak uprawnień (wymagana grupa AiEngineer).");
            } else if (e?.response?.status === 400) {
                setError("Nieprawidłowa wartość algorytmu.");
            } else {
                setError("Nie udało się zapisać ustawienia.");
            }
        } finally {
            setSaving(false);
        }
    };

    const retrainRF = async () => {
        setRetraining(true);
        setError("");
        setSuccess("");

        try {
            const { data } = await BackendConnector.post("ai/retrain-rf/");

            setSuccess(
                `✅ Wytrenowano RF na ${data.trained_on} rekordach.`
            );

            await fetchAlgorithmAndStats(); // odśwież statystyki / ustawienia
        } catch (e) {
            console.error("❌ Retrain RF error:", e);

            const status = e?.response?.status;
            const detail = e?.response?.data?.detail;

            if (status === 403) {
                setError("Brak uprawnień (wymagana grupa AiEngineer).");
            } else if (status === 400) {
                setError(detail || "Nie udało się wytrenować RF (400).");
            } else if (detail) {
                setError(detail);
            } else {
                setError("Nie udało się wytrenować RF.");
            }
        } finally {
            setRetraining(false);
        }
    };

    const retrainNN = async () => {
        setSavingNN(true);
        setError("");
        setSuccess("");

        try {
            const { data } = await BackendConnector.post("ai/retrain-nn/", {
                values: nnValues, // { choroba: liczba }
            });

            setSuccess(`✅ Wytrenowano NN na ${data.trained_on} rekordach.`);

            await fetchAlgorithmAndStats();
        } catch (e) {
            console.error("❌ Retrain NN error:", e);

            const status = e?.response?.status;
            const detail = e?.response?.data?.detail;

            if (status === 403) {
                setError("Brak uprawnień (wymagana grupa AiEngineer).");
            } else if (status === 400) {
                setError(detail || "Nie udało się wytrenować NN (400).");
            } else if (detail) {
                setError(detail);
            } else {
                setError("Nie udało się wytrenować NN.");
            }
        } finally {
            setSavingNN(false);
        }
    };


    const handleChange = (e) => {
        const algo = e.target.value;
        setSelectedAlgo(algo);
        saveAlgorithm(algo);
    };

    const renderTable = (title, rows, isNN = false) => {
        const showKnown = rows.some((r) => r.known_count !== undefined);

        return (
            <div className="ai-stats">
                <h3>{title}</h3>

                {rows.length === 0 ? (
                    <p className="muted">Brak danych.</p>
                ) : (
                    <>
                        <table className="ai-table">
                            <thead>
                                <tr>
                                    <th>Diagnozy AI</th>
                                    <th>Liczba</th>
                                    {showKnown && <th>Znane przez algorytm</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, idx) => {
                                    const label = r.train_label ?? r.predicted_diagnosis ?? "";
                                    if (!label) return null;

                                    return (
                                        <tr key={`${label}-${idx}`}>
                                            <td>{label}</td>

                                            <td className={isNN ? "helper" : undefined}>
                                                {isNN ? (
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        value={nnValues[label] ?? 0}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const num = raw === "" ? 0 : Number(raw);
                                                            setNnValues((prev) => ({
                                                                ...prev,
                                                                [label]: Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : 0,
                                                            }));
                                                        }}
                                                        className="ai-input-number"
                                                    />
                                                ) : (
                                                    r.count
                                                )}
                                            </td>

                                            {showKnown && <td>{r.known_count ?? 0}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <br />

                        {isNN ? (
                            <button
                                onClick={retrainNN}
                                disabled={savingNN}
                                className="retrain-btn"
                            >
                                {savingNN ? "Zapisywanie..." : "Doucz NN"}
                            </button>
                        ) : (
                            <button
                                onClick={retrainRF}
                                disabled={retraining}
                                className="retrain-btn"
                            >
                                {retraining ? (
                                    <>
                                        <span className="retrain-spinner" />
                                        Trenuję model...
                                    </>
                                ) : (
                                    "Doucz RF"
                                )}
                            </button>
                        )}

                    </>
                )}
            </div>
        );
    };

    return (
        <div className="ai-panel">
            <h2>Panel AI</h2>

            {loading ? (
                <p>Ładowanie ustawień...</p>
            ) : (
                <>
                    <div className="radio-group">
                        <label className="radio-item">
                            <input
                                type="radio"
                                name="diagnosis_algorithm"
                                value="nn"
                                checked={selectedAlgo === "nn"}
                                onChange={handleChange}
                                disabled={saving}
                            />
                            <span>Sieć neuronowa (NN)</span>
                        </label>

                        <label className="radio-item">
                            <input
                                type="radio"
                                name="diagnosis_algorithm"
                                value="rf"
                                checked={selectedAlgo === "rf"}
                                onChange={handleChange}
                                disabled={saving}
                            />
                            <span>Random Forest (RF)</span>
                        </label>
                    </div>

                    {saving && <p>Zapisywanie...</p>}
                    {success && <p className="success">{success}</p>}
                    {error && <p className="error">{error}</p>}

                    <br />
                    <hr />

                    {renderTable("Statystyki NN", statsNN, true)}
                    <br />
                    <hr />

                    {renderTable("Statystyki RF", statsRF)}
                </>
            )}
        </div>
    );
}