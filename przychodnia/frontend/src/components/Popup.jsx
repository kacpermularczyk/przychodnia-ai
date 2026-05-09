import React from "react";

const Popup = ({ title, onClose, children }) => {
    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.popup} onClick={(e) => e.stopPropagation()}>

                {/* ❌ Przycisk „X” w prawym górnym rogu */}
                <button style={styles.closeButton} onClick={onClose}>
                    ✖
                </button>

                {/* 🏷️ Tytuł */}
                <h2 style={styles.title}>{title}</h2>

                {/* 🧩 Zawartość ze scrollem */}
                <div style={styles.content}>
                    {children}
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5000,
        padding: "10px", // 🔹 trochę marginesu na małych ekranach
    },
    popup: {
        position: "relative",
        background: "#fff",
        borderRadius: "18px",
        width: "90%",
        maxWidth: "50em", // 🔹 ograniczenie szerokości — wygląda dobrze na wszystkich ekranach
        height: "80vh", // 🔹 nie wyjdzie poza ekran
        padding: "30px 40px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        animation: "popupFadeIn 0.2s ease-in-out",
    },
    closeButton: {
        position: "absolute",
        top: "15px",
        right: "15px",
        background: "transparent",
        border: "none",
        fontSize: "24px",
        fontWeight: "bold",
        color: "#333",
        cursor: "pointer",
        transition: "color 0.2s ease",
    },
    title: {
        fontSize: "24px",
        marginBottom: "20px",
        color: "#222",
        fontWeight: "600",
    },
    content: {
        flex: 1,
        overflowY: "auto",
        paddingRight: "6px",
    },
};

// ✨ Prosta animacja (można dodać w globalnym CSS)
const styleSheet = document.createElement("style");
styleSheet.innerHTML = `
@keyframes popupFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
`;
document.head.appendChild(styleSheet);

export default Popup;
